import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { CDPSession, Page } from 'puppeteer-core';

import type { ConsoleLevel, ConsoleRecord } from './inspector.types';

const MAX_CONSOLE_RECORDS = 300;

interface RemoteObject {
  type: string;
  subtype?: string;
  value?: unknown;
  description?: string;
  unserializableValue?: string;
}
interface CallFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}
interface ConsoleApiEvent {
  type: string;
  args: RemoteObject[];
  timestamp: number;
  stackTrace?: { callFrames: CallFrame[] };
}
interface ExceptionEvent {
  timestamp: number;
  exceptionDetails: {
    text: string;
    exception?: RemoteObject;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
    stackTrace?: { callFrames: CallFrame[] };
  };
}

/** CDP console API type → 패널 표시 레벨 */
export function consoleLevel(type: string): ConsoleLevel {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
    case 'verbose':
      return 'debug';
    default:
      return 'log';
  }
}

/** RemoteObject 인자들을 사람이 읽는 한 줄 텍스트로 */
export function buildArgText(args: RemoteObject[] = []): string {
  try {
    return args
      .map((a) => {
        if (a.value !== undefined) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
        return a.description ?? a.unserializableValue ?? a.subtype ?? a.type;
      })
      .join(' ')
      .slice(0, 500);
  } catch {
    return '';
  }
}

/** 스택에서 소스 점프에 쓸 최상단 앱 프레임(http(s)) 선택. CDP는 0-base → V8 1-base로 변환 */
export function pickTopFrame(
  callFrames: CallFrame[] = [],
): { url: string; line: number; column: number } | undefined {
  for (const f of callFrames) {
    if (f.url && /^https?:\/\//.test(f.url)) {
      return { url: f.url, line: f.lineNumber + 1, column: f.columnNumber + 1 };
    }
  }
  return undefined;
}

/**
 * CDP Runtime 도메인으로 console.* 호출과 uncaught 예외를 수집한다.
 * 단일 인스펙터 세션 기준(싱글톤). 패널은 snapshot/clear, 점프는 getById로 프레임 조회.
 */
@Injectable()
export class ConsoleCollectorService {
  private readonly logger = new Logger(ConsoleCollectorService.name);
  private cdp: CDPSession | null = null;
  private readonly records: ConsoleRecord[] = [];

  async attach(page: Page): Promise<void> {
    try {
      const client = await page.target().createCDPSession();
      this.cdp = client;
      await client.send('Runtime.enable');
      client.on('Runtime.consoleAPICalled', (e) => this.onConsole(e));
      client.on('Runtime.exceptionThrown', (e) => this.onException(e));
    } catch (err) {
      this.logger.warn(`Console capture setup failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  snapshot(): ConsoleRecord[] {
    return this.records.map((r) => ({ ...r }));
  }

  getById(id: string): ConsoleRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  clear(): void {
    this.records.length = 0;
  }

  detach(): void {
    this.cdp = null;
    this.records.length = 0;
  }

  private push(rec: ConsoleRecord): void {
    this.records.push(rec);
    if (this.records.length > MAX_CONSOLE_RECORDS) this.records.shift();
  }

  private onConsole(e: ConsoleApiEvent): void {
    try {
      this.push({
        id: randomUUID(),
        level: consoleLevel(e.type),
        text: buildArgText(e.args),
        timestamp: e.timestamp,
        frame: pickTopFrame(e.stackTrace?.callFrames),
      });
    } catch {}
  }

  private onException(e: ExceptionEvent): void {
    try {
      const d = e.exceptionDetails;
      const text = d.exception?.description ?? d.text ?? 'Uncaught error';
      let frame = pickTopFrame(d.stackTrace?.callFrames);
      if (!frame && d.url && /^https?:\/\//.test(d.url)) {
        frame = { url: d.url, line: (d.lineNumber ?? 0) + 1, column: (d.columnNumber ?? 0) + 1 };
      }
      this.push({
        id: randomUUID(),
        level: 'exception',
        text: String(text).slice(0, 1000),
        timestamp: e.timestamp,
        frame,
      });
    } catch {}
  }
}
