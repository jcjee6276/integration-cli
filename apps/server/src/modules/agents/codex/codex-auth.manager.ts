import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

export interface CodexAuthStatus {
  installed: boolean;
  loggedIn: boolean;
}

const KEY_PATH = path.join(os.homedir(), '.ji', 'codex-key');

@Injectable()
export class CodexAuthManager {
  private readonly logger = new Logger(CodexAuthManager.name);

  getAuthStatus(): CodexAuthStatus {
    const installed = this.isInstalled();
    if (!installed) return { installed: false, loggedIn: false };

    const loggedIn = !!(this.readStoredApiKey() || process.env.OPENAI_API_KEY);
    return { installed, loggedIn };
  }

  saveApiKey(apiKey: string): void {
    const dir = path.dirname(KEY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEY_PATH, apiKey, { mode: 0o600 });
    this.logger.log('Saved Codex API key');
  }

  getEnvForCodex(): NodeJS.ProcessEnv {
    const apiKey = this.readStoredApiKey() ?? process.env.OPENAI_API_KEY;
    return apiKey ? { ...process.env, OPENAI_API_KEY: apiKey } : process.env;
  }

  private isInstalled(): boolean {
    try {
      execFileSync('codex', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private readStoredApiKey(): string | null {
    try {
      return fs.readFileSync(KEY_PATH, 'utf8').trim() || null;
    } catch {
      return null;
    }
  }
}
