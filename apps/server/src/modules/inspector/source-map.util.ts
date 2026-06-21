import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { SourceMapConsumer } from 'source-map';
import type { RawIndexMap, RawSourceMap } from 'source-map';

import type { ResolvedSource } from './inspector.types';

/** typescript는 선택 의존성(미설치 시 범위 계산만 생략). CJS require로 지연 로드(jest/prod 모두 동작). */
let tsCache: typeof import('typescript') | null | undefined;
function loadTs(): typeof import('typescript') | null {
  if (tsCache !== undefined) return tsCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tsCache = require('typescript') as typeof import('typescript');
  } catch {
    tsCache = null;
  }
  return tsCache;
}

/** file:// / webpack:// 스킴을 가능한 만큼 정리해 디스크 경로로 변환 */
export function toAbsolutePath(source: string): string {
  try {
    if (source.startsWith('file://')) return fileURLToPath(source);
    return source.replace(/^webpack:\/\/_N_E\//, '').replace(/^webpack:\/\//, '');
  } catch {
    return source;
  }
}

/** source map의 source 항목(baseDir/sourceRoot 기준)을 절대 디스크 경로로 변환 */
export function resolveSourcePath(
  baseDir: string,
  sourceRoot: string | undefined,
  source: string,
): string {
  try {
    if (source.startsWith('file://')) return fileURLToPath(source);

    const cleaned = source
      .replace(/^webpack:\/\/_N_E\//, '')
      .replace(/^webpack:\/\//, '')
      .replace(/^\.\//, '');
    if (path.isAbsolute(cleaned)) return cleaned;

    return path.resolve(baseDir, sourceRoot ?? '', cleaned);
  } catch {
    return source;
  }
}

/** 디스크 파일의 sourceMappingURL(inline data URI 또는 인접 .map)을 읽어 파싱 */
export function readDiskSourceMap(
  absPath: string,
): { raw: RawSourceMap | RawIndexMap; baseDir: string; sourceRoot?: string } | null {
  try {
    if (!absPath || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;

    const content = fs.readFileSync(absPath, 'utf8');
    const match = content.match(/\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/m);
    if (!match) return null;

    const url = match[1];
    let raw: RawSourceMap | RawIndexMap;
    let baseDir = path.dirname(absPath);

    const dataMatch = url.match(/^data:application\/json[^,]*;base64,(.*)$/);
    if (dataMatch) {
      raw = JSON.parse(Buffer.from(dataMatch[1], 'base64').toString('utf8'));
    } else if (url.startsWith('data:application/json,')) {
      raw = JSON.parse(decodeURIComponent(url.slice('data:application/json,'.length)));
    } else {
      const mapPath = path.resolve(baseDir, decodeURIComponent(url));
      if (!fs.existsSync(mapPath)) return null;
      raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      baseDir = path.dirname(mapPath);
    }

    const sourceRoot = (raw as RawSourceMap).sourceRoot;
    return { raw, baseDir, sourceRoot };
  } catch {
    return null;
  }
}

/**
 * absPath가 source map을 가진 생성 파일(dist/*.cjs 등)이면 그 map으로 한 단계 더
 * 내려가며 더 이상 map이 없는 진짜 원본 파일에 도달할 때까지 반복(최대 8홉).
 */
export async function chainThroughDiskMaps(
  absPath: string,
  line: number | undefined,
  column: number | undefined,
): Promise<ResolvedSource> {
  let currentPath = absPath;
  let currentLine = line;
  let currentColumn = column;

  for (let depth = 0; depth < 8; depth++) {
    const found = readDiskSourceMap(currentPath);
    if (!found || currentLine == null) break;

    let consumer: SourceMapConsumer | null = null;
    try {
      consumer = await new SourceMapConsumer(found.raw);
      const next = consumer.originalPositionFor({
        line: currentLine,
        column: currentColumn ?? 0,
      });
      if (!next.source) break;

      const nextPath = resolveSourcePath(found.baseDir, found.sourceRoot, next.source);
      if (!nextPath || nextPath === currentPath) break;

      currentPath = nextPath;
      currentLine = next.line ?? undefined;
      currentColumn = next.column ?? undefined;
    } catch {
      break;
    } finally {
      consumer?.destroy();
    }
  }

  return { fileName: currentPath, line: currentLine, column: currentColumn };
}

/**
 * 원본 파일을 TS AST로 파싱해 (line, column)을 감싸는 JSX 요소의 시작~끝 줄을 구한다.
 * typescript 미설치/파싱 실패 시 null (호출부에서 시작 줄만 사용).
 */
export async function resolveElementRange(
  fileName: string,
  line: number | undefined,
  column: number | undefined,
): Promise<{ startLine: number; endLine: number } | null> {
  try {
    if (!line || !fs.existsSync(fileName)) return null;

    const ts = loadTs();
    if (!ts) return null;
    const content = fs.readFileSync(fileName, 'utf8');
    const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    // column이 줄 길이를 넘으면 getPositionOfLineAndCharacter가 throw → 직접 안전하게 계산
    const lineStarts = sf.getLineStarts();
    const li = line - 1;
    if (li < 0 || li >= lineStarts.length) return null;
    const lineStart = lineStarts[li];
    const lineEnd = li + 1 < lineStarts.length ? lineStarts[li + 1] - 1 : content.length;
    const clampedCol = Math.max(0, Math.min(column ?? 0, Math.max(0, lineEnd - lineStart - 1)));
    const pos = lineStart + clampedCol;

    // pos를 포함하는 가장 깊은 노드 탐색
    let deepest: import('typescript').Node = sf;
    const visit = (node: import('typescript').Node) => {
      if (pos >= node.getStart(sf) && pos < node.getEnd()) {
        deepest = node;
        node.forEachChild(visit);
      }
    };
    sf.forEachChild(visit);

    // 감싸는 JSX 요소까지 상향
    let jsx: import('typescript').Node | undefined = deepest;
    while (jsx) {
      if (ts.isJsxElement(jsx) || ts.isJsxSelfClosingElement(jsx) || ts.isJsxFragment(jsx)) break;
      jsx = jsx.parent;
    }
    if (!jsx) return null;

    const startLine = sf.getLineAndCharacterOfPosition(jsx.getStart(sf)).line + 1;
    const endLine = sf.getLineAndCharacterOfPosition(jsx.getEnd()).line + 1;
    return { startLine, endLine };
  } catch {
    return null;
  }
}
