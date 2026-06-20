import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer-core';
import { SourceMapConsumer } from 'source-map';
import type { RawIndexMap, RawSourceMap } from 'source-map';

export type InspectorState = 'idle' | 'connecting' | 'active';

/** in-page 헬퍼가 보내는 원시 payload */
interface InspectorRawPayload {
  source?: { fileName: string; lineNumber?: number; columnNumber?: number };
  frame?: { url: string; line: number; column: number };
  componentName?: string;
  notFound?: boolean;
  tagName?: string;
  text?: string;
}

export interface InspectorElementEvent {
  /** source map으로 resolve된 절대경로. notFound면 undefined */
  fileName?: string;
  line?: number;
  column?: number;
  /** JSX 요소가 끝나는 줄 (AST 파싱 성공 시). 범위 하이라이트용 */
  endLine?: number;
  componentName?: string;
  /** resolve 실패 시 true — 텍스트/태그만 전달 */
  notFound?: boolean;
  tagName?: string;
  text?: string;
}

export interface InspectorStatusEvent {
  state: InspectorState;
  appUrl?: string;
  error?: string;
}

const BINDING_NAME = '__jcInspect';

/**
 * 클릭한 DOM에서 React fiber의 _debugStack(번들 위치) + _debugOwner(컴포넌트명)을
 * 추출하는 in-page overlay 헬퍼. addScriptToEvaluateOnNewDocument + 현재 페이지 즉시 주입.
 * 번들 위치 → 원본 파일/라인 매핑은 서버에서 source map으로 수행.
 *
 * - mousemove: hover outline
 * - click(capture): fiber 탐색 → { frame, componentName } → window.__jcInspect(payload)
 * - 우하단 토글 pill / Esc: 캡처 ON·OFF (OFF면 페이지 정상 동작)
 */
const OVERLAY_SCRIPT = `
(() => {
  try {
    if (window.__jcInspectInstalled) return;
    window.__jcInspectInstalled = true;

    const HL_ID = '__jc-inspect-highlight';
    function ensureHighlight() {
      let el = document.getElementById(HL_ID);
      if (!el) {
        el = document.createElement('div');
        el.id = HL_ID;
        el.style.cssText = [
          'position:fixed',
          'z-index:2147483647',
          'pointer-events:none',
          'background:rgba(16,185,129,0.18)',
          'border:1px solid rgba(16,185,129,0.85)',
          'border-radius:2px',
          'transition:all 40ms ease-out',
          'display:none',
        ].join(';');
        document.documentElement.appendChild(el);
      }
      return el;
    }

    function moveHighlight(target) {
      try {
        const el = ensureHighlight();
        if (!target || !target.getBoundingClientRect) {
          el.style.display = 'none';
          return;
        }
        const r = target.getBoundingClientRect();
        el.style.display = 'block';
        el.style.top = r.top + 'px';
        el.style.left = r.left + 'px';
        el.style.width = r.width + 'px';
        el.style.height = r.height + 'px';
      } catch (e) {}
    }

    function getFiber(node) {
      try {
        const key = Object.keys(node).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
        );
        return key ? node[key] : null;
      } catch (e) {
        return null;
      }
    }

    // React 18 + Vite/Babel dev transform은 jsxDEV의 fileName/lineNumber를
    // fiber._debugSource에 직접 보관한다. 이 값이 있으면 source map보다 정확하다.
    function readDebugSource(fiber) {
      try {
        let c = fiber;
        while (c) {
          const source = c._debugSource;
          if (source && source.fileName) {
            return {
              fileName: source.fileName,
              lineNumber: source.lineNumber,
              columnNumber: source.columnNumber,
            };
          }
          c = c.return;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    // React 19(Turbopack)는 _debugSource를 제거 → _debugStack(번들 위치) + _debugOwner(컴포넌트)
    function readComponentName(fiber) {
      try {
        let c = fiber;
        while (c) {
          const t = (c._debugOwner && c._debugOwner.type) || c.type;
          if (typeof t === 'function' && (t.displayName || t.name)) return t.displayName || t.name;
          c = c.return;
        }
        return undefined;
      } catch (e) {
        return undefined;
      }
    }

    // _debugStack에서 jsxDEV 호출부(요소의 번들 위치) 프레임을 추출
    function readFrame(fiber) {
      try {
        let c = fiber;
        while (c) {
          const stack = c._debugStack && (c._debugStack.stack || '');
          if (stack) {
            const lines = stack.split('\\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].indexOf('jsxDEV') !== -1 || lines[i].indexOf('jsx-dev-runtime') !== -1) {
                const next = lines[i + 1] || '';
                const m =
                  next.match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/) ||
                  next.match(/(https?:\\/\\/\\S+):(\\d+):(\\d+)/);
                if (m) return { url: m[1], line: Number(m[2]), column: Number(m[3]) };
              }
            }
            // jsxDEV 라벨이 없으면 첫 앱 청크 프레임 사용
            for (let i = 0; i < lines.length; i++) {
              if (
                (lines[i].indexOf('/_next/static/chunks/') !== -1 ||
                  lines[i].indexOf('/src/') !== -1 ||
                  lines[i].indexOf('/@fs/') !== -1) &&
                lines[i].indexOf('react-dom') === -1 &&
                lines[i].indexOf('react-server-dom') === -1 &&
                lines[i].indexOf('/node_modules/') === -1
              ) {
                const m =
                  lines[i].match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/) ||
                  lines[i].match(/(https?:\\/\\/\\S+):(\\d+):(\\d+)/);
                if (m) return { url: m[1], line: Number(m[2]), column: Number(m[3]) };
              }
            }
          }
          c = c.return;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    function buildPayload(target) {
      try {
        const fiber = getFiber(target);
        const source = fiber ? readDebugSource(fiber) : null;
        const frame = source ? null : fiber ? readFrame(fiber) : null;
        const componentName = fiber ? readComponentName(fiber) : undefined;
        if (source || frame) return { source, frame, componentName };
        return {
          notFound: true,
          componentName,
          tagName: target && target.tagName ? target.tagName.toLowerCase() : undefined,
          text: target && target.textContent ? target.textContent.trim().slice(0, 80) : undefined,
        };
      } catch (e) {
        return { notFound: true };
      }
    }

    // ── 캡처 토글 (modifier 대신) ─────────────────────────────────────────
    // Mac에서 Ctrl/Cmd/Option/Shift+클릭은 새 탭·창·컨텍스트메뉴 등 브라우저 고유
    // 동작이라 modifier로 "일반 동작 통과"가 불가능. 대신 캡처 자체를 토글한다.
    let captureEnabled = true;
    const PILL_ID = '__jc-inspect-toggle';

    // 앱이 app-router면 React가 <html>/<body>를 관리하므로 hydration 때 주입 노드가
    // 제거될 수 있다. ensurePill은 idempotent하게 매번 상태를 반영하고, interval로
    // 사라지면 다시 생성한다(highlight가 mousemove마다 재생성되는 것과 동일한 전략).
    function ensurePill() {
      try {
        let pill = document.getElementById(PILL_ID);
        if (!pill) {
          pill = document.createElement('button');
          pill.id = PILL_ID;
          pill.type = 'button';
          pill.style.cssText = [
            'position:fixed',
            'bottom:16px',
            'right:16px',
            'z-index:2147483647',
            'padding:8px 12px',
            'border-radius:9999px',
            'border:none',
            'font:600 12px/1 ui-sans-serif,system-ui,sans-serif',
            'color:#fff',
            'cursor:pointer',
            'box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)',
          ].join(';');
          pill.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setEnabled(!captureEnabled);
          });
          (document.body || document.documentElement).appendChild(pill);
        }
        pill.textContent = captureEnabled ? '🔍 요소 선택: 켜짐' : '⏸ 요소 선택: 꺼짐 (Esc)';
        pill.style.background = captureEnabled ? '#059669' : '#6b7280';
        return pill;
      } catch (e) {
        return null;
      }
    }

    function setEnabled(v) {
      captureEnabled = v;
      if (!v) moveHighlight(null);
      ensurePill();
    }

    function isOwnUi(node) {
      try {
        const pill = document.getElementById(PILL_ID);
        return Boolean(pill && (node === pill || pill.contains(node)));
      } catch (e) {
        return false;
      }
    }

    function onMove(e) {
      if (isOwnUi(e.target)) return;
      if (!captureEnabled) {
        moveHighlight(null);
        return;
      }
      moveHighlight(e.target);
    }

    function onClick(e) {
      try {
        // 토글 버튼 클릭은 자체 핸들러에 맡김
        if (isOwnUi(e.target)) return;
        // 캡처 꺼짐 → 페이지 정상 동작 (modifier 불필요)
        if (!captureEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        window.${BINDING_NAME}(JSON.stringify(buildPayload(e.target)));
      } catch (err) {}
    }

    function onKeyDown(e) {
      // Esc로 캡처 토글 (modifier 충돌 없음)
      if (e.key === 'Escape') setEnabled(!captureEnabled);
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    ensurePill();
    // hydration 등으로 pill이 제거되면 다시 생성
    setInterval(ensurePill, 1000);
  } catch (e) {}
})();
`;

/**
 * macOS / Windows / Linux 기본 Chrome 실행 경로 후보.
 * JC_CHROME_PATH env로 override 가능.
 */
const CHROME_CANDIDATES = [
  process.env.JC_CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

@Injectable()
export class InspectorService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(InspectorService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;
  private state: InspectorState = 'idle';
  /** 번들 URL → SourceMapConsumer 캐시 (세션 종료 시 destroy) */
  private readonly sourceMaps = new Map<string, Promise<SourceMapConsumer | null>>();

  getState(): InspectorState {
    return this.state;
  }

  async start(appUrl: string): Promise<InspectorStatusEvent> {
    try {
      await this.stop();

      this.setState({ state: 'connecting', appUrl });

      // 동적 import — puppeteer-core 미설치 환경에서 모듈 로드 실패 방지
      const puppeteer = (await import('puppeteer-core')).default;
      const executablePath = this.resolveChromePath();
      if (!executablePath) {
        throw new Error(
          'Chrome 실행 파일을 찾지 못했습니다. JC_CHROME_PATH 환경변수로 경로를 지정해 주세요.',
        );
      }

      this.browser = await puppeteer.launch({
        headless: false,
        executablePath,
        defaultViewport: null,
        args: ['--no-first-run', '--no-default-browser-check'],
      });

      const pages = await this.browser.pages();
      this.page = pages[0] ?? (await this.browser.newPage());

      await this.page.exposeFunction(BINDING_NAME, (payload: string) => {
        void this.handleElementPayload(payload);
      });
      await this.page.evaluateOnNewDocument(OVERLAY_SCRIPT);

      await this.page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      // 이미 로드된 현재 페이지에도 즉시 주입 (goto 이전 상태 대비)
      await this.page.evaluate(OVERLAY_SCRIPT);

      // 사용자가 Chrome 창을 직접 닫은 경우 정리
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.page = null;
        this.setState({ state: 'idle' });
      });

      this.setState({ state: 'active', appUrl });
      this.logger.log(`Inspector session started: ${appUrl}`);
      return { state: this.state, appUrl };
    } catch (err) {
      const error = err instanceof Error ? err.message : '인스펙터를 시작하지 못했습니다';
      this.logger.error(`Inspector start failed: ${error}`);
      await this.stop();
      this.setState({ state: 'idle', error });
      return { state: 'idle', error };
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (err) {
      this.logger.warn(
        `Inspector browser close failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.browser = null;
      this.page = null;
      await this.clearSourceMaps();
      if (this.state !== 'idle') this.setState({ state: 'idle' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  private async handleElementPayload(payload: string): Promise<void> {
    try {
      const data = JSON.parse(payload) as InspectorRawPayload;

      if (data.source?.fileName) {
        const sourceFile = this.toAbsolutePath(data.source.fileName);
        const range = await this.resolveElementRange(
          sourceFile,
          data.source.lineNumber,
          data.source.columnNumber,
        );
        const line = range?.startLine ?? data.source.lineNumber;
        const column = data.source.columnNumber;

        this.emit('inspector:element', {
          fileName: sourceFile,
          line,
          column,
          endLine: range?.endLine,
          componentName: data.componentName,
        } satisfies InspectorElementEvent);
        return;
      }

      if (data.notFound || !data.frame) {
        this.emit('inspector:element', {
          notFound: true,
          componentName: data.componentName,
          tagName: data.tagName,
          text: data.text,
        } satisfies InspectorElementEvent);
        return;
      }

      const resolved = await this.resolveFrame(data.frame);
      if (!resolved) {
        this.emit('inspector:element', {
          notFound: true,
          componentName: data.componentName,
        } satisfies InspectorElementEvent);
        return;
      }

      const range = await this.resolveElementRange(
        resolved.fileName,
        resolved.line,
        resolved.column,
      );
      const line = range?.startLine ?? resolved.line;

      this.emit('inspector:element', {
        fileName: resolved.fileName,
        line,
        column: resolved.column,
        endLine: range?.endLine,
        componentName: data.componentName,
      } satisfies InspectorElementEvent);
    } catch (err) {
      this.logger.warn(
        `Inspector payload handle failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** 번들 frame(url:line:column)을 source map으로 원본 파일/라인에 매핑 */
  private async resolveFrame(frame: {
    url: string;
    line: number;
    column: number;
  }): Promise<{ fileName: string; line?: number; column?: number } | null> {
    try {
      const consumer = await this.getSourceMap(frame.url);
      if (!consumer) return null;

      // source map column은 0-base, V8 stack column은 1-base
      const original = consumer.originalPositionFor({
        line: frame.line,
        column: Math.max(0, frame.column - 1),
      });
      if (!original.source) return null;

      // 1단계 결과가 또 다른 생성 파일(dist/*.cjs 등)이면 그 파일의 source map을
      // 디스크에서 읽어 원본까지 재귀적으로 따라간다.
      return this.chainThroughDiskMaps(
        this.toAbsolutePath(original.source),
        original.line ?? undefined,
        original.column ?? undefined,
      );
    } catch (err) {
      this.logger.warn(
        `Inspector frame resolve failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * 원본 파일을 TS AST로 파싱해 (line, column)을 감싸는 JSX 요소의 시작~끝 줄을 구한다.
   * typescript 미설치/파싱 실패 시 null (호출부에서 시작 줄만 사용).
   */
  private async resolveElementRange(
    fileName: string,
    line: number | undefined,
    column: number | undefined,
  ): Promise<{ startLine: number; endLine: number } | null> {
    try {
      if (!line || !fs.existsSync(fileName)) return null;

      const ts = await import('typescript');
      const content = fs.readFileSync(fileName, 'utf8');
      const sf = ts.createSourceFile(
        fileName,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      // column이 줄 길이를 넘으면 getPositionOfLineAndCharacter가 throw하므로 직접 안전하게 계산
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
        if (ts.isJsxElement(jsx) || ts.isJsxSelfClosingElement(jsx) || ts.isJsxFragment(jsx)) {
          break;
        }
        jsx = jsx.parent;
      }
      if (!jsx) return null;

      const startLine = sf.getLineAndCharacterOfPosition(jsx.getStart(sf)).line + 1;
      const endLine = sf.getLineAndCharacterOfPosition(jsx.getEnd()).line + 1;
      return { startLine, endLine };
    } catch (err) {
      this.logger.warn(
        `Inspector element range resolve failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * absPath가 source map을 가진 생성 파일이면 그 map으로 한 단계 더 내려가며
   * 더 이상 map이 없는 진짜 원본 파일에 도달할 때까지 반복.
   */
  private async chainThroughDiskMaps(
    absPath: string,
    line: number | undefined,
    column: number | undefined,
  ): Promise<{ fileName: string; line?: number; column?: number }> {
    let currentPath = absPath;
    let currentLine = line;
    let currentColumn = column;

    for (let depth = 0; depth < 8; depth++) {
      const found = this.readDiskSourceMap(currentPath);
      if (!found || currentLine == null) break;

      let consumer: SourceMapConsumer | null = null;
      try {
        consumer = await new SourceMapConsumer(found.raw);
        const next = consumer.originalPositionFor({
          line: currentLine,
          column: currentColumn ?? 0,
        });
        if (!next.source) break;

        const nextPath = this.resolveSourcePath(found.baseDir, found.sourceRoot, next.source);
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

  /** 디스크 파일의 sourceMappingURL(inline data URI 또는 인접 .map)을 읽어 파싱 */
  private readDiskSourceMap(
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
    } catch (err) {
      this.logger.warn(
        `Inspector disk source map read failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** source map의 source 항목을 절대 디스크 경로로 변환 */
  private resolveSourcePath(
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
        this.logger.warn(
          `Inspector source map load failed: ${err instanceof Error ? err.message : err}`,
        );
        return null;
      }
    })();

    this.sourceMaps.set(bundleUrl, loading);
    return loading;
  }

  private toAbsolutePath(source: string): string {
    try {
      if (source.startsWith('file://')) return fileURLToPath(source);
      // webpack:// 등 스킴 제거 — 가능한 만큼만 정리
      return source.replace(/^webpack:\/\/_N_E\//, '').replace(/^webpack:\/\//, '');
    } catch {
      return source;
    }
  }

  private async clearSourceMaps(): Promise<void> {
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

  private setState(event: InspectorStatusEvent): void {
    this.state = event.state;
    this.emit('inspector:status', event);
  }

  private resolveChromePath(): string | null {
    try {
      for (const candidate of CHROME_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    } catch {
      return null;
    }
  }
}
