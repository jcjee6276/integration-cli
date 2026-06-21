import { Injectable, Logger } from '@nestjs/common';
import type { CDPSession, Page } from 'puppeteer-core';

import type { NetRecord, NetTiming } from './inspector.types';

const MAX_NET_RECORDS = 500;

interface RawTiming {
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  sslStart: number;
  sslEnd: number;
  sendStart: number;
  sendEnd: number;
  receiveHeadersEnd: number;
}

interface ReqEvent {
  requestId: string;
  request: { method: string; url: string; headers: Record<string, string>; postData?: string };
  type?: string;
  timestamp: number;
}
interface ResEvent {
  requestId: string;
  response: {
    status: number;
    statusText: string;
    mimeType: string;
    headers: Record<string, string>;
    timing?: RawTiming;
  };
  type?: string;
}
interface FinEvent {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}
interface FailEvent {
  requestId: string;
  timestamp: number;
  errorText: string;
}

/** CDP ResourceTiming → 사람이 읽는 ms 단위 구간 */
export function computeTiming(t?: RawTiming): NetTiming | null {
  try {
    if (!t) return null;
    const d = (a: number, b: number) => (a >= 0 && b >= 0 && b >= a ? b - a : 0);
    return {
      dns: d(t.dnsStart, t.dnsEnd),
      connect: d(t.connectStart, t.connectEnd),
      ssl: d(t.sslStart, t.sslEnd),
      send: d(t.sendStart, t.sendEnd),
      wait: d(t.sendEnd, t.receiveHeadersEnd),
      total: 0,
    };
  } catch {
    return null;
  }
}

/** URL에서 목록에 표시할 짧은 이름(마지막 경로 세그먼트 또는 호스트) */
export function urlName(url?: string): string {
  try {
    if (!url) return '';
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).at(-1);
    return seg || u.hostname;
  } catch {
    return url ?? '';
  }
}

/**
 * CDP Network 도메인 이벤트를 구독해 요청 레코드를 누적한다.
 * 단일 인스펙터 세션 기준(싱글톤). 패널은 snapshot/getBody/clear를 폴링/조회.
 */
@Injectable()
export class NetworkCollectorService {
  private readonly logger = new Logger(NetworkCollectorService.name);
  private cdp: CDPSession | null = null;
  private readonly records = new Map<string, NetRecord>();

  async attach(page: Page): Promise<void> {
    try {
      const client = await page.target().createCDPSession();
      this.cdp = client;
      await client.send('Network.enable');
      client.on('Network.requestWillBeSent', (e) => this.onRequest(e));
      client.on('Network.responseReceived', (e) => this.onResponse(e));
      client.on('Network.loadingFinished', (e) => this.onFinished(e));
      client.on('Network.loadingFailed', (e) => this.onFailed(e));
    } catch (err) {
      this.logger.warn(`Network capture setup failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** 패널이 폴링하는 스냅샷 (응답 바디는 제외 — 펼칠 때 별도 조회) */
  snapshot(): NetRecord[] {
    try {
      return Array.from(this.records.values()).map((r) => ({ ...r }));
    } catch {
      return [];
    }
  }

  async getBody(id: string): Promise<{ body: string; base64Encoded: boolean } | null> {
    try {
      if (!this.cdp) return null;
      const res = await this.cdp.send('Network.getResponseBody', { requestId: id });
      return { body: res.body, base64Encoded: res.base64Encoded };
    } catch {
      return null;
    }
  }

  clear(): void {
    this.records.clear();
  }

  detach(): void {
    this.cdp = null;
    this.records.clear();
  }

  private onRequest(e: ReqEvent): void {
    try {
      const rec: NetRecord = this.records.get(e.requestId) ?? { id: e.requestId };
      rec.method = e.request.method;
      rec.url = e.request.url;
      rec.name = urlName(e.request.url);
      rec.requestHeaders = e.request.headers;
      if (e.request.postData) rec.postData = e.request.postData;
      if (e.type) rec.type = e.type;
      if (rec.startTime == null) rec.startTime = e.timestamp;
      if (rec.status == null) rec.status = 0;
      this.records.set(e.requestId, rec);
      this.cap();
    } catch {}
  }

  private onResponse(e: ResEvent): void {
    try {
      const rec: NetRecord = this.records.get(e.requestId) ?? { id: e.requestId };
      rec.status = e.response.status;
      rec.statusText = e.response.statusText;
      rec.mime = e.response.mimeType;
      rec.responseHeaders = e.response.headers;
      if (e.type) rec.type = e.type;
      rec.timing = computeTiming(e.response.timing);
      this.records.set(e.requestId, rec);
    } catch {}
  }

  private onFinished(e: FinEvent): void {
    try {
      const rec = this.records.get(e.requestId);
      if (!rec) return;
      rec.size = e.encodedDataLength;
      rec.durationMs = rec.startTime != null ? (e.timestamp - rec.startTime) * 1000 : undefined;
      rec.done = true;
      if (rec.timing) rec.timing.total = rec.durationMs ?? rec.timing.total;
    } catch {}
  }

  private onFailed(e: FailEvent): void {
    try {
      const rec = this.records.get(e.requestId);
      if (!rec) return;
      rec.failed = true;
      rec.errorText = e.errorText;
      rec.durationMs = rec.startTime != null ? (e.timestamp - rec.startTime) * 1000 : undefined;
      rec.done = true;
    } catch {}
  }

  private cap(): void {
    try {
      while (this.records.size > MAX_NET_RECORDS) {
        const first = this.records.keys().next().value;
        if (first === undefined) break;
        this.records.delete(first);
      }
    } catch {}
  }
}
