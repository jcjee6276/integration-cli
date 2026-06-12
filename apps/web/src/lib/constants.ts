// 프로덕션(프리빌드 배포)에서는 프록시 뒤에서 same-origin으로 호출하고,
// 로컬 개발에서는 별도 포트의 서버(3001)로 직접 호출한다.
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");
export const CLAUDE_WS_NAMESPACE = "/agents/claude";
export const GEMINI_WS_NAMESPACE = "/agents/gemini";
export const CODEX_WS_NAMESPACE = "/agents/codex";
