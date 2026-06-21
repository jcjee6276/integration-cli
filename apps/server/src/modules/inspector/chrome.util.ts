import * as fs from 'fs';

/**
 * macOS / Windows / Linux 기본 Chrome 실행 경로 후보.
 * JC_CHROME_PATH env로 override 가능.
 */
export const CHROME_CANDIDATES = [
  process.env.JC_CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

/** 설치된 Chrome 실행 파일 경로를 후보 중에서 찾는다. 없으면 null. */
export function resolveChromePath(candidates: string[] = CHROME_CANDIDATES): string | null {
  try {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}
