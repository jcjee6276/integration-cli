import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Injectable } from '@nestjs/common';

import { ClaudeAuthManager } from './claude-auth.manager';
import { ClaudePtyManager } from './claude-pty.manager';
import type { ClaudeCreateSessionDto as CreateSessionDto } from './dto/create-session.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

export interface ClaudeStatus {
  version: string;
  auth: {
    loggedIn: boolean;
    authMethod: string;
    apiProvider: string;
    email?: string;
    orgName?: string;
    subscriptionType?: string;
  };
  activeSessions: number;
  platform: string;
  usage: AgentUsageStatus;
}

export interface AgentUsageStatus {
  available: boolean;
  label: string;
  percent?: number;
  resetAt?: string;
  details?: string[];
  windows?: AgentUsageWindow[];
}

export interface AgentUsageWindow {
  label: string;
  valueLabel: string;
  limitLabel?: string;
  resetAt?: string;
  percent?: number;
  points: AgentUsagePoint[];
}

export interface AgentUsagePoint {
  label: string;
  value: number;
  percent: number;
}

interface ClaudeTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

interface ClaudeDailyModelTokens {
  date: string;
  tokensByModel?: Record<string, number>;
}

interface ClaudeStatsCache {
  lastComputedDate?: string;
  totalSessions?: number;
  totalMessages?: number;
  modelUsage?: Record<string, ClaudeTokenUsage>;
  dailyModelTokens?: ClaudeDailyModelTokens[];
}

interface ClaudeTranscriptUsage {
  timestamp: string;
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

@Injectable()
export class ClaudeService {
  constructor(
    private readonly ptyManager: ClaudePtyManager,
    private readonly authManager: ClaudeAuthManager,
  ) {}

  createSession(dto: CreateSessionDto): SessionInfo {
    return this.ptyManager.createSession(dto.workingDirectory, dto.model, dto.reasoning);
  }

  terminateSession(sessionId: string): void {
    this.ptyManager.terminateSession(sessionId);
  }

  sendMessage(sessionId: string, message: string): void {
    this.ptyManager.sendMessage(sessionId, message);
  }

  getSession(sessionId: string): SessionInfo {
    return this.ptyManager.getSessionInfo(sessionId);
  }

  listSessions(): SessionInfo[] {
    return this.ptyManager.listSessions();
  }

  async getStatus(): Promise<ClaudeStatus> {
    let version = 'unknown';
    try {
      version = execSync('claude --version', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {
      version = 'unknown';
    }

    const auth = await this.authManager.getAuthStatus();

    return {
      version,
      auth,
      activeSessions: this.ptyManager.listSessions().length,
      platform: `${os.platform()} ${os.arch()}`,
      usage: this.getUsageStatus(auth),
    };
  }

  private getUsageStatus(auth: ClaudeStatus['auth']): AgentUsageStatus {
    try {
      if (!auth.loggedIn) {
        return {
          available: false,
          label: '인증 후 usage를 확인할 수 있습니다',
        };
      }

      const stats = this.readStatsCache();
      if (!stats) {
        return {
          available: false,
          label: 'Claude usage 캐시를 찾을 수 없습니다',
          details: ['~/.claude/stats-cache.json 파일이 아직 생성되지 않았습니다.'],
        };
      }

      const totalTokens = this.sumClaudeModelUsage(stats.modelUsage);
      const today = this.formatLocalDate(new Date());
      const todayUsage = stats.dailyModelTokens?.find((usage) => usage.date === today);
      const latestUsage = stats.dailyModelTokens?.at(-1);
      const dailyUsage = todayUsage ?? latestUsage;
      const dailyTokens = this.sumRecord(dailyUsage?.tokensByModel);
      const dailyLabel =
        dailyUsage?.date === today
          ? `오늘 ${this.formatCount(dailyTokens)} tokens`
          : dailyUsage
            ? `최근일(${dailyUsage.date}) ${this.formatCount(dailyTokens)} tokens`
            : '일별 token 기록 없음';

      return {
        available: true,
        label: `총 ${this.formatCount(totalTokens)} tokens`,
        windows: this.getUsageWindows(),
        details: [
          dailyLabel,
          `전체 메시지 ${this.formatCount(stats.totalMessages ?? 0)}개`,
          `전체 세션 ${this.formatCount(stats.totalSessions ?? 0)}개`,
          stats.lastComputedDate ? `마지막 계산 ${stats.lastComputedDate}` : '마지막 계산일 없음',
        ],
      };
    } catch {
      return {
        available: false,
        label: 'usage 조회 실패',
      };
    }
  }

  private readStatsCache(): ClaudeStatsCache | null {
    try {
      const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json');
      const content = fs.readFileSync(statsPath, 'utf8');
      return JSON.parse(content) as ClaudeStatsCache;
    } catch {
      return null;
    }
  }

  private sumClaudeModelUsage(modelUsage?: Record<string, ClaudeTokenUsage>): number {
    try {
      return Object.values(modelUsage ?? {}).reduce(
        (sum, usage) =>
          sum +
          (usage.inputTokens ?? 0) +
          (usage.outputTokens ?? 0) +
          (usage.cacheReadInputTokens ?? 0) +
          (usage.cacheCreationInputTokens ?? 0),
        0,
      );
    } catch {
      return 0;
    }
  }

  private sumRecord(values?: Record<string, number>): number {
    try {
      return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
    } catch {
      return 0;
    }
  }

  private formatLocalDate(date: Date): string {
    try {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  private formatCount(value: number): string {
    try {
      return new Intl.NumberFormat('ko-KR').format(value);
    } catch {
      return `${value}`;
    }
  }

  private getUsageWindows(): AgentUsageWindow[] {
    try {
      const usageEvents = this.readTranscriptUsageEvents();
      return [
        this.buildHourlyWindow('5h usage', usageEvents, 47),
        this.buildDailyWindow('7d usage', usageEvents, 5),
      ];
    } catch {
      return [];
    }
  }

  private readTranscriptUsageEvents(): { timestamp: Date; tokens: number }[] {
    try {
      const projectsDir = path.join(os.homedir(), '.claude', 'projects');
      if (!fs.existsSync(projectsDir)) return [];

      const files = this.listJsonlFiles(projectsDir);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const events: { timestamp: Date; tokens: number }[] = [];

      for (const file of files) {
        try {
          const lines = fs.readFileSync(file, 'utf8').split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line) as ClaudeTranscriptUsage;
              const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
              if (!timestamp || Number.isNaN(timestamp.getTime()) || timestamp.getTime() < cutoff) {
                continue;
              }
              const usage = entry.message?.usage;
              if (!usage) continue;
              events.push({
                timestamp,
                tokens:
                  (usage.input_tokens ?? 0) +
                  (usage.output_tokens ?? 0) +
                  (usage.cache_read_input_tokens ?? 0) +
                  (usage.cache_creation_input_tokens ?? 0),
              });
            } catch {
              // skip malformed transcript lines
            }
          }
        } catch {
          // skip unreadable transcript files
        }
      }

      return events;
    } catch {
      return [];
    }
  }

  private listJsonlFiles(dir: string): string[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return this.listJsonlFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.jsonl') ? [fullPath] : [];
      });
    } catch {
      return [];
    }
  }

  private buildHourlyWindow(
    label: string,
    usageEvents: { timestamp: Date; tokens: number }[],
    percent?: number,
  ): AgentUsageWindow {
    try {
      const now = new Date();
      const buckets = Array.from({ length: 5 }, (_, index) => {
        const date = new Date(now);
        date.setMinutes(0, 0, 0);
        date.setHours(date.getHours() - (4 - index));
        return { key: date.getTime(), label: `${date.getHours()}시`, value: 0 };
      });
      const firstBucket = buckets[0]?.key ?? 0;
      const lastBucket = (buckets.at(-1)?.key ?? 0) + 60 * 60 * 1000;

      for (const event of usageEvents) {
        const hour = new Date(event.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.getTime();
        if (key < firstBucket || key >= lastBucket) continue;
        const bucket = buckets.find((item) => item.key === key);
        if (bucket) bucket.value += event.tokens;
      }

      return this.toUsageWindow(label, buckets, percent);
    } catch {
      return { label, valueLabel: '0 tokens', limitLabel: '제한값 미공개', points: [] };
    }
  }

  private buildDailyWindow(
    label: string,
    usageEvents: { timestamp: Date; tokens: number }[],
    percent?: number,
  ): AgentUsageWindow {
    try {
      const now = new Date();
      const buckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        return { key: date.getTime(), label: `${date.getMonth() + 1}/${date.getDate()}`, value: 0 };
      });
      const firstBucket = buckets[0]?.key ?? 0;
      const lastBucket = (buckets.at(-1)?.key ?? 0) + 24 * 60 * 60 * 1000;

      for (const event of usageEvents) {
        const day = new Date(event.timestamp);
        day.setHours(0, 0, 0, 0);
        const key = day.getTime();
        if (key < firstBucket || key >= lastBucket) continue;
        const bucket = buckets.find((item) => item.key === key);
        if (bucket) bucket.value += event.tokens;
      }

      return this.toUsageWindow(label, buckets, percent);
    } catch {
      return { label, valueLabel: '0 tokens', limitLabel: '제한값 미공개', points: [] };
    }
  }

  private toUsageWindow(
    label: string,
    buckets: { label: string; value: number }[],
    percent?: number,
  ): AgentUsageWindow {
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
