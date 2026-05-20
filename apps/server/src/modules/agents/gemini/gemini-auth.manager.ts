import { execFileSync, spawn } from 'child_process';

import { Injectable, Logger } from '@nestjs/common';

export interface GeminiAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  installed: boolean;
  email?: string;
}

@Injectable()
export class GeminiAuthManager {
  private readonly logger = new Logger(GeminiAuthManager.name);

  async getAuthStatus(): Promise<GeminiAuthStatus> {
    const installed = this.isInstalled();
    if (!installed) {
      return { loggedIn: false, authMethod: 'unknown', installed: false };
    }

    return new Promise((resolve) => {
      const proc = spawn('gemini', ['auth', 'status', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let output = '';
      proc.stdout.on('data', (d: Buffer) => (output += d.toString()));
      proc.stderr.on('data', (d: Buffer) => (output += d.toString()));

      proc.on('close', (code) => {
        try {
          const parsed = JSON.parse(output.trim()) as Omit<GeminiAuthStatus, 'installed'>;
          resolve({ installed: true, ...parsed });
        } catch {
          // gemini auth status 가 JSON을 지원하지 않는 경우 텍스트로 파싱
          const loggedIn = code === 0 && /logged.?in|authenticated/i.test(output);
          const emailMatch = output.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          resolve({
            loggedIn,
            authMethod: loggedIn ? 'oauth' : 'unknown',
            installed: true,
            ...(emailMatch ? { email: emailMatch[0] } : {}),
          });
        }
      });

      proc.on('error', () => {
        resolve({ loggedIn: false, authMethod: 'unknown', installed: true });
      });
    });
  }

  private isInstalled(): boolean {
    try {
      execFileSync('gemini', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
