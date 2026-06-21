export type InspectorState = 'idle' | 'connecting' | 'active';

/** CDP Network 도메인에서 누적하는 요청 레코드 */
export interface NetRecord {
  id: string;
  method?: string;
  url?: string;
  name?: string;
  type?: string;
  status?: number;
  statusText?: string;
  mime?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  startTime?: number;
  durationMs?: number;
  size?: number;
  failed?: boolean;
  errorText?: string;
  done?: boolean;
  timing?: NetTiming | null;
}

export interface NetTiming {
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  total: number;
}

/** in-page 헬퍼가 보내는 원시 payload */
export interface InspectorRawPayload {
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

export type ConsoleLevel = 'log' | 'info' | 'warning' | 'error' | 'debug' | 'exception';

/** CDP Runtime에서 수집하는 콘솔/예외 레코드 */
export interface ConsoleRecord {
  id: string;
  level: ConsoleLevel;
  text: string;
  timestamp: number;
  /** 스택 최상단 앱 프레임(번들 위치, V8 스타일 1-base) — 클릭 시 소스 점프용 */
  frame?: { url: string; line: number; column: number };
}

/** 번들 frame → 원본 파일/라인 매핑 결과 */
export interface ResolvedSource {
  fileName: string;
  line?: number;
  column?: number;
}

/** 소스 위치 + JSX 요소 범위(끝 줄) */
export interface ResolvedElement {
  fileName: string;
  line?: number;
  column?: number;
  endLine?: number;
}
