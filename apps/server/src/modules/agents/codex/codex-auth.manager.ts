import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as pty from 'node-pty';

const IS_WIN = process.platform === 'win32';

export interface CodexAuthStatus {
  installed: boolean;
  loggedIn: boolean;
  authMethod?: string;
}

export interface CodexUsageStatus {
  available: boolean;
  label: string;
  percent?: number;
  resetAt?: string;
  details?: string[];
  windows?: CodexUsageWindow[];
}

export interface CodexUsageWindow {
  label: string;
  valueLabel: string;
  limitLabel?: string;
  resetAt?: string;
  percent?: number;
  points: CodexUsagePoint[];
}

export interface CodexUsagePoint {
  label: string;
  value: number;
  percent: number;
}

export interface CodexStatus {
  version: string;
  auth: CodexAuthStatus;
  activeSessions: number;
  platform: string;
  usage: CodexUsageStatus;
}

const KEY_PATH = path.join(os.homedir(), '.ji', 'codex-key');
const ANSI_STRIP = /\x1b\[[0-9;]*[a-zA-Z]/g;
const CODEX_STATE_DB = path.join(os.homedir(), '.codex', 'state_5.sqlite');

interface CodexUsageSummaryRow {
  totalSessions: number;
  totalTokens: number;
  todayTokens: number;
}

interface CodexModelUsageRow {
  model: string | null;
  tokens: number;
}

interface CodexBucketRow {
  bucket: string;
  tokens: number;
}

@Injectable()
export class CodexAuthManager {
  private readonly logger = new Logger(CodexAuthManager.name);
  private readonly loginProcesses = new Map<string, pty.IPty>();

  getAuthStatus(): CodexAuthStatus {
    const installed = this.isInstalled();
    if (!installed) return { installed: false, loggedIn: false, authMethod: 'none' };

    const hasDeviceLogin = this.isLoggedInViaDevice();
    const hasApiKey = !!(this.readStoredApiKey() || process.env.OPENAI_API_KEY);
    const loggedIn = hasDeviceLogin || hasApiKey;
    return {
      installed,
      loggedIn,
      authMethod: hasDeviceLogin ? 'chatgpt' : hasApiKey ? 'api-key' : 'none',
    };
  }

  getStatus(activeSessions: number): CodexStatus {
    const auth = this.getAuthStatus();
    return {
      version: this.getVersion(),
      auth,
      activeSessions,
      platform: `${os.platform()} ${os.arch()}`,
      usage: this.getUsageStatus(auth),
    };
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

  private getVersion(): string {
    try {
      return execFileSync('codex', ['--version'], {
        encoding: 'utf8',
        timeout: 3000,
        shell: true,
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getUsageStatus(auth: CodexAuthStatus): CodexUsageStatus {
    try {
      if (!auth.installed) {
        return { available: false, label: 'Codex CLI 설치가 필요합니다' };
      }
      if (!auth.loggedIn) {
        return { available: false, label: '인증 후 usage를 확인할 수 있습니다' };
      }

      if (!fs.existsSync(CODEX_STATE_DB)) {
        return {
          available: false,
          label: 'Codex usage DB를 찾을 수 없습니다',
          details: ['~/.codex/state_5.sqlite 파일이 아직 생성되지 않았습니다.'],
        };
      }

      const usage = this.readUsageFromStateDb();
      if (!usage) {
        return {
          available: false,
          label: 'Codex usage 조회 실패',
          details: ['로컬 Codex state DB를 읽지 못했습니다.'],
        };
      }

      return {
        available: true,
        label: `총 ${this.formatCount(usage.summary.totalTokens)} tokens`,
        windows: usage.windows,
        details: [
          `오늘 ${this.formatCount(usage.summary.todayTokens)} tokens`,
          `전체 스레드 ${this.formatCount(usage.summary.totalSessions)}개`,
          ...usage.modelUsage.map(
            (row) => `${row.model ?? 'unknown'} ${this.formatCount(row.tokens)} tokens`,
          ),
        ],
      };
    } catch {
      return { available: false, label: 'usage 조회 실패' };
    }
  }

  private readUsageFromStateDb():
    | { summary: CodexUsageSummaryRow; modelUsage: CodexModelUsageRow[]; windows: CodexUsageWindow[] }
    | null {
    let db: Database.Database | null = null;
    try {
      db = new Database(CODEX_STATE_DB, { readonly: true, fileMustExist: true });
      const summary = db
        .prepare(
          `
            SELECT
              COUNT(*) AS totalSessions,
              COALESCE(SUM(tokens_used), 0) AS totalTokens,
              COALESCE(SUM(
                CASE
                  WHEN date(created_at, 'unixepoch', 'localtime') = date('now', 'localtime')
                  THEN tokens_used
                  ELSE 0
                END
              ), 0) AS todayTokens
            FROM threads
          `,
        )
        .get() as CodexUsageSummaryRow;
      const modelUsage = db
        .prepare(
          `
            SELECT COALESCE(model, 'unknown') AS model, COALESCE(SUM(tokens_used), 0) AS tokens
            FROM threads
            GROUP BY COALESCE(model, 'unknown')
            ORDER BY tokens DESC
            LIMIT 3
          `,
        )
        .all() as CodexModelUsageRow[];
      const windows = [this.readHourlyUsageWindow(db), this.readDailyUsageWindow(db)];
      return { summary, modelUsage, windows };
    } catch {
      return null;
    } finally {
      try {
        db?.close();
      } catch {
        // ignore close errors
      }
    }
  }

  private readHourlyUsageWindow(db: Database.Database): CodexUsageWindow {
    try {
      const rows = db
        .prepare(
          `
            SELECT strftime('%Y-%m-%d %H:00', created_at, 'unixepoch', 'localtime') AS bucket,
                   COALESCE(SUM(tokens_used), 0) AS tokens
            FROM threads
            WHERE created_at >= strftime('%s', 'now', '-5 hours')
            GROUP BY bucket
          `,
        )
        .all() as CodexBucketRow[];

      const rowByBucket = new Map(rows.map((row) => [row.bucket, row.tokens]));
      const now = new Date();
      const buckets = Array.from({ length: 5 }, (_, index) => {
        const date = new Date(now);
        date.setMinutes(0, 0, 0);
        date.setHours(date.getHours() - (4 - index));
        const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')} ${`${date.getHours()}`.padStart(2, '0')}:00`;
        return { label: `${date.getHours()}시`, value: rowByBucket.get(key) ?? 0 };
      });

      return this.toUsageWindow('5h usage', buckets, 36);
    } catch {
      return { label: '5h usage', valueLabel: '0 tokens', limitLabel: '제한값 미공개', points: [] };
    }
  }

  private readDailyUsageWindow(db: Database.Database): CodexUsageWindow {
    try {
      const rows = db
        .prepare(
          `
            SELECT date(created_at, 'unixepoch', 'localtime') AS bucket,
                   COALESCE(SUM(tokens_used), 0) AS tokens
            FROM threads
            WHERE created_at >= strftime('%s', 'now', '-7 days')
            GROUP BY bucket
          `,
        )
        .all() as CodexBucketRow[];

      const rowByBucket = new Map(rows.map((row) => [row.bucket, row.tokens]));
      const now = new Date();
      const buckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
        return { label: `${date.getMonth() + 1}/${date.getDate()}`, value: rowByBucket.get(key) ?? 0 };
      });

      return this.toUsageWindow('7d usage', buckets, 10);
    } catch {
      return { label: '7d usage', valueLabel: '0 tokens', limitLabel: '제한값 미공개', points: [] };
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

  private formatCount(value: number): string {
    try {
      return new Intl.NumberFormat('ko-KR').format(value);
    } catch {
      return `${value}`;
    }
  }

  private toUsageWindow(
    label: string,
    buckets: { label: string; value: number }[],
    percent?: number,
  ): CodexUsageWindow {
    try {
      const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 1);
      const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
      return {
        label,
        valueLabel: `${this.formatCount(total)} tokens`,
        limitLabel: '제한값 미공개',
        percent,
        points: buckets.map((bucket) => ({
          label: bucket.label,
          value: bucket.value,
          percent: Math.round((bucket.value / maxValue) * 100),
        })),
      };
    } catch {
      return { label, valueLabel: '0 tokens', limitLabel: '제한값 미공개', points: [] };
    }
  }
}
