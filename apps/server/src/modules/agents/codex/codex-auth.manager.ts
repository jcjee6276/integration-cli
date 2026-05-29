import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import * as pty from 'node-pty';

const IS_WIN = process.platform === 'win32';

export interface CodexAuthStatus {
  installed: boolean;
  loggedIn: boolean;
}

const KEY_PATH = path.join(os.homedir(), '.ji', 'codex-key');
const ANSI_STRIP = /\x1b\[[0-9;]*[a-zA-Z]/g;

@Injectable()
export class CodexAuthManager {
  private readonly logger = new Logger(CodexAuthManager.name);
  private readonly loginProcesses = new Map<string, pty.IPty>();

  getAuthStatus(): CodexAuthStatus {
    const installed = this.isInstalled();
    if (!installed) return { installed: false, loggedIn: false };

    const loggedIn = this.isLoggedInViaDevice() || !!(this.readStoredApiKey() || process.env.OPENAI_API_KEY);
    return { installed, loggedIn };
  }

  saveApiKey(apiKey: string): void {
    const dir = path.dirname(KEY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEY_PATH, apiKey, { mode: 0o600 });
    this.logger.log('Saved Codex API key');
  }

  startLogin(
    clientId: string,
    onOutput: (text: string) => void,
    onDone: (success: boolean) => void,
  ): void {
    this.cancelLogin(clientId);

    const proc = pty.spawn(IS_WIN ? 'codex.cmd' : 'codex', ['login', '--device-auth'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      env: process.env as Record<string, string>,
    });

    this.loginProcesses.set(clientId, proc);
    this.logger.log(`Started Codex device login for client ${clientId} (pid: ${proc.pid})`);

    proc.onData((data) => onOutput(data.replace(ANSI_STRIP, '')));

    proc.onExit(({ exitCode }) => {
      this.loginProcesses.delete(clientId);
      this.logger.log(`Codex login for ${clientId} exited with code ${exitCode}`);
      onDone(exitCode === 0);
    });
  }

  cancelLogin(clientId: string): void {
    const proc = this.loginProcesses.get(clientId);
    if (proc) {
      try { proc.kill(); } catch { /* ignore */ }
      this.loginProcesses.delete(clientId);
    }
  }

  getEnvForCodex(): NodeJS.ProcessEnv {
    const apiKey = this.readStoredApiKey() ?? process.env.OPENAI_API_KEY;
    return apiKey ? { ...process.env, OPENAI_API_KEY: apiKey } : process.env;
  }

  private isInstalled(): boolean {
    try {
      execFileSync('codex', ['--version'], { stdio: 'ignore', shell: true });
      return true;
    } catch {
      return false;
    }
  }

  private isLoggedInViaDevice(): boolean {
    try {
      execFileSync('codex', ['login', 'status'], {
        timeout: 5000,
        stdio: 'ignore',
        shell: true,
      });
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
