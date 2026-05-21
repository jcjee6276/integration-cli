const QUOTA_PATTERNS = [
  // Gemini
  /exhausted your daily quota/i,
  /you exceeded your current quota/i,
  /TerminalQuotaError/,
  /daily quota/i,
  /quota exceeded/i,
  /generativelanguage.*free_tier/i,
  // Claude
  /usage limit reached/i,
  /rate.?limit/i,
  /insufficient.?credit/i,
  /credit balance/i,
  /overloaded_error/i,
  /too many requests/i,
  // HTTP 429
  /\b429\b/,
];

export function isQuotaExceeded(text: string): boolean {
  return QUOTA_PATTERNS.some((p) => p.test(text));
}
