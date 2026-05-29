import { execFileSync, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { JI_PATHS } from '../../../common/ji-paths';
import { Injectable, Logger } from '@nestjs/common';

const IS_WIN = process.platform === 'win32';

export type GeminiAuthType = 'api-key' | 'gca';

export interface GeminiAuthStatus {
  loggedIn: boolean;
  authMethod: GeminiAuthType | 'unknown';
  installed: boolean;
}

interface GeminiSettings {
  selectedAuthType?: GeminiAuthType | string;
  [key: string]: unknown;
}

const SETTINGS_PATH = JI_PATHS.agents.gemini.settings;
const API_KEY_PATH  = JI_PATHS.agents.gemini.apiKey;
const GCA_CREDS_PATH = path.join(
  os.homedir(),
  '.config',
  'gcloud',
  'application_default_credentials.json',
);

@Injectable()
export class GeminiAuthManager {
  private readonly logger = new Logger(GeminiAuthManager.name);
  private readonly loginProcesses = new Map<string, ChildProcess>();

  // ─── Status ────────────────────────────────────────────────────────────────

  async getAuthStatus(): Promise<GeminiAuthStatus> {
    if (!this.isInstalled()) {
      return { loggedIn: false, authMethod: 'unknown', installed: false };
    }

    const settings = this.readSettings();
    const authType = settings?.selectedAuthType as GeminiAuthType | undefined;

    if (authType === 'api-key') {
      const hasKey = !!(this.readStoredApiKey() || process.env.GEMINI_API_KEY);
      return { loggedIn: hasKey, authMethod: 'api-key', installed: true };
    }

    if (authType === 'gca') {
      const hasGca = fs.existsSync(GCA_CREDS_PATH);
      return { loggedIn: hasGca, authMethod: 'gca', installed: true };
    }

    return { loggedIn: false, authMethod: 'unknown', installed: true };
  }

  // ─── API Key ───────────────────────────────────────────────────────────────

  saveApiKey(apiKey: string): void {
    this.ensureGeminiDir();
    this.writeSettings({ selectedAuthType: 'api-key' });
    fs.writeFileSync(API_KEY_PATH, apiKey, { mode: 0o600 });
    this.logger.log('Saved Gemini API key config');
  }

  getEnvForGemini(): NodeJS.ProcessEnv {
    const apiKey = this.readStoredApiKey() ?? process.env.GEMINI_API_KEY;
    return apiKey ? { ...process.env, GEMINI_API_KEY: apiKey } : process.env;
  }

  // ─── GCA Login (gcloud auth application-default login) ────────────────────

  startGcaLogin(
    clientId: string,
    onOutput: (text: string) => void,
    onDone: (success: boolean) => void,
  ): void {
    this.cancelLogin(clientId);

    const proc = spawn(IS_WIN ? 'gcloud.cmd' : 'gcloud', ['auth', 'application-default', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    this.loginProcesses.set(clientId, proc);
    this.logger.log(`Started gcloud auth for client ${clientId} (pid: ${proc.pid})`);

    proc.stdout.on('data', (chunk: Buffer) => onOutput(chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => onOutput(chunk.toString()));

    proc.on('close', (code) => {
      this.loginProcesses.delete(clientId);
      const success = code === 0;
      if (success) this.writeSettings({ selectedAuthType: 'gca' });
      this.logger.log(`gcloud auth for ${clientId} exited with code ${code}`);
      onDone(success);
    });

    proc.on('error', (err) => {
      this.loginProcesses.delete(clientId);
      this.logger.error(`gcloud auth error for ${clientId}: ${err.message}`);
      onDone(false);
    });
  }

  cancelLogin(clientId: string): void {
    const proc = this.loginProcesses.get(clientId);
    if (proc) {
      proc.kill();
      this.loginProcesses.delete(clientId);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private isInstalled(): boolean {
    try {
      execFileSync('gemini', ['--version'], { stdio: 'ignore', shell: true });
      return true;
    } catch {
      return false;
    }
  }

  private ensureGeminiDir(): void {
    if (!fs.existsSync(JI_PATHS.agents.gemini.dir)) {
      fs.mkdirSync(JI_PATHS.agents.gemini.dir, { recursive: true });
    }
  }

  private readSettings(): GeminiSettings | null {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) as GeminiSettings;
    } catch {
      return null;
    }
  }

  private writeSettings(patch: Partial<GeminiSettings>): void {
    this.ensureGeminiDir();
    const current = this.readSettings() ?? {};
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...patch }, null, 2));
  }

  private readStoredApiKey(): string | null {
    try {
      return fs.readFileSync(API_KEY_PATH, 'utf8').trim() || null;
    } catch {
      return null;
    }
  }
}
