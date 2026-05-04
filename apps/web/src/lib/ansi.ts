// ─── ANSI 이스케이프 제거 ────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;?]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B[^[\]]/g;

export function stripAnsi(raw: string): string {
  return raw
    .replace(ANSI_RE, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// ─── Claude CLI 노이즈 패턴 ──────────────────────────────────────────────────

/** 한 줄 전체가 노이즈인 경우 */
const NOISE_LINE_PATTERNS: RegExp[] = [
  // 스피너 · 진행 표시
  /Skedaddling…/,
  /thinking/i,
  // 토큰 카운터
  /[↑↓]\s*\d+\s*tokens/,
  // 키보드 힌트
  /esc to interrupt/i,
  /ctrl\+[a-z] to/i,
  /Tab to amend/i,
  // 구분선 (─ 계열 문자가 줄의 60% 이상)
  /^[─━═\-\s❯◀▶]+$/,
  // 스피너 아이콘만 있는 줄
  /^[✽✶✢✻·●\s]+$/,
  // 메모리 알림
  /Recalled \d+ memor/i,
];

/** 줄 내 특정 패턴 제거 (줄 자체는 유지) */
const INLINE_NOISE_PATTERNS: RegExp[] = [
  // 타이밍 정보: (3s · ↓ 109 tokens · thinking)
  /\(\d+s\s*·[^)]+\)/g,
  // ⎿ 출력 마커
  /⎿\s*/g,
  // 특수 스피너 아이콘
  /[✽✶✢✻]/g,
];

/** 구분선인지 판단 (─ 계열 50% 이상) */
function isSeparatorLine(line: string): boolean {
  if (line.trim().length < 5) return false;
  const dashCount = (line.match(/[─━═\-]/g) ?? []).length;
  return dashCount / line.length > 0.5;
}

// ─── 권한 요청 감지 ──────────────────────────────────────────────────────────

export interface PermissionPrompt {
  tool: string;
  command: string;
  warning?: string;
}

/**
 * Claude CLI 권한 요청 블록을 감지한다.
 *
 * 패턴:
 *   Bash command
 *   <command>
 *   Contains simple_expansion          ← 선택적 경고
 *   Do you want to proceed? ❯ 1. Yes …
 */
export function detectPermissionPrompt(text: string): PermissionPrompt | null {
  const match = text.match(
    /(\w+)\s+command\s*\n([^\n]+)\n(?:([^\n]+)\n)?Do you want to proceed\?/i,
  );
  if (!match) return null;
  return { tool: match[1], command: match[2].trim(), warning: match[3]?.trim() };
}

// ─── 메인 클리너 ─────────────────────────────────────────────────────────────

export function cleanCliOutput(raw: string): string {
  const text = stripAnsi(raw);
  const lines = text.split("\n");
  const result: string[] = [];

  for (let line of lines) {
    // 구분선 전체 제거
    if (isSeparatorLine(line)) continue;

    // 노이즈 줄 전체 제거
    if (NOISE_LINE_PATTERNS.some((p) => p.test(line.trim()))) continue;

    // 줄 내 노이즈 패턴 제거
    for (const p of INLINE_NOISE_PATTERNS) {
      line = line.replace(p, "");
    }

    result.push(line);
  }

  return (
    result
      .join("\n")
      // 3줄 이상 연속 빈 줄 → 2줄로 축소
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
