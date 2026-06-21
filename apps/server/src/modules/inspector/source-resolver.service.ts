import { Injectable, Logger } from '@nestjs/common';
import { SourceMapConsumer } from 'source-map';
import type { RawIndexMap, RawSourceMap } from 'source-map';

import type { InspectorRawPayload, ResolvedElement } from './inspector.types';
import {
  chainThroughDiskMaps,
  resolveElementRange,
  toAbsolutePath,
} from './source-map.util';

/**
 * 인스펙트된 페이지에서 받은 위치(번들 frame 또는 dev _debugSource)를
 * 원본 파일/라인/요소 범위로 매핑한다.
 *
 * - frame(번들 청크 url:line:col): dev 서버의 .map을 fetch → source map → 디스크 체이닝
 * - debugSource(절대경로): 스킴 정리 후 바로 AST 범위 계산
 */
@Injectable()
export class SourceResolverService {
  private readonly logger = new Logger(SourceResolverService.name);
  /** 번들 URL → SourceMapConsumer 캐시 (세션 종료 시 destroy) */
  private readonly sourceMaps = new Map<string, Promise<SourceMapConsumer | null>>();

  /** React dev fiber._debugSource(절대경로) → 요소 범위 */
  async resolveDebugSource(source: {
    fileName: string;
    lineNumber?: number;
    columnNumber?: number;
  }): Promise<ResolvedElement> {
    const fileName = toAbsolutePath(source.fileName);
    const range = await resolveElementRange(fileName, source.lineNumber, source.columnNumber);
    return {
      fileName,
      line: range?.startLine ?? source.lineNumber,
      column: source.columnNumber,
      endLine: range?.endLine,
    };
  }

  /** 번들 frame(url:line:column) → source map → 원본 파일/요소 범위 */
  async resolveFrame(frame: {
    url: string;
    line: number;
    column: number;
  }): Promise<ResolvedElement | null> {
    try {
      const consumer = await this.getSourceMap(frame.url);
      if (!consumer) return null;

      // source map column은 0-base, V8 stack column은 1-base
      const original = consumer.originalPositionFor({
        line: frame.line,
        column: Math.max(0, frame.column - 1),
      });
      if (!original.source) return null;

      const resolved = await chainThroughDiskMaps(
        toAbsolutePath(original.source),
        original.line ?? undefined,
        original.column ?? undefined,
      );

      const range = await resolveElementRange(resolved.fileName, resolved.line, resolved.column);
      return {
        fileName: resolved.fileName,
        line: range?.startLine ?? resolved.line,
        column: resolved.column,
        endLine: range?.endLine,
      };
    } catch (err) {
      this.logger.warn(`Frame resolve failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /** payload(source 우선, 없으면 frame) → 요소 매핑. 실패 시 null */
  async resolvePayload(payload: InspectorRawPayload): Promise<ResolvedElement | null> {
    if (payload.source?.fileName) return this.resolveDebugSource(payload.source);
    if (payload.frame) return this.resolveFrame(payload.frame);
    return null;
  }

  /** 세션 종료 시 소스맵 캐시 정리 */
  async clear(): Promise<void> {
    try {
      for (const promise of this.sourceMaps.values()) {
        const consumer = await promise;
        consumer?.destroy();
      }
    } catch {
    } finally {
      this.sourceMaps.clear();
    }
  }

  private getSourceMap(bundleUrl: string): Promise<SourceMapConsumer | null> {
    const cached = this.sourceMaps.get(bundleUrl);
    if (cached) return cached;

    const loading = (async () => {
      try {
        const res = await fetch(`${bundleUrl}.map`);
        if (!res.ok) return null;
        const raw = (await res.json()) as RawSourceMap | RawIndexMap;
        return await new SourceMapConsumer(raw);
      } catch (err) {
        this.logger.warn(`Source map load failed: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    })();

    this.sourceMaps.set(bundleUrl, loading);
    return loading;
  }
}
