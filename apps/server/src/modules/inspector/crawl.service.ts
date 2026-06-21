import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import type { Browser } from 'puppeteer-core';

import { resolveChromePath } from './chrome.util';
import { ConsoleCollectorService } from './console-collector.service';
import { NetworkCollectorService } from './network-collector.service';
import { SourceResolverService } from './source-resolver.service';

export type CrawlIssueKind = 'console-error' | 'exception' | 'network';

export interface CrawlIssue {
  route: string;
  kind: CrawlIssueKind;
  title: string;
  detail?: string;
  /** 소스맵으로 매핑된 원본 위치 (가능할 때) */
  fileName?: string;
  line?: number;
  endLine?: number;
  /** network 이슈용 */
  url?: string;
  status?: number;
}

export interface RouteResult {
  route: string;
  url: string;
  issues: CrawlIssue[];
  error?: string;
}

export interface CrawlReport {
  appUrl: string;
  routes: RouteResult[];
  totalIssues: number;
}

export interface CrawlProgress {
  index: number;
  total: number;
  route: string;
  issueCount: number;
}

const MAX_ROUTES = 40;
const ROUTE_TIMEOUT_MS = 20000;
const SETTLE_MS = 700;
const PAGE_FILE = /^page\.(t|j)sx?$/;
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist']);

/**
 * 실행 중인 로컬 앱의 여러 라우트를 자동 순회하며 콘솔 에러·예외·실패 네트워크 요청을
 * 수집하고, 소스맵으로 원본 위치까지 매핑한 감사 리포트를 만든다.
 * (perf·과다 리렌더는 후속 확장 여지)
 */
@Injectable()
export class CrawlService extends EventEmitter {
  private readonly logger = new Logger(CrawlService.name);

  constructor(private readonly sourceResolver: SourceResolverService) {
    super();
  }

  /** Next App Router의 app 디렉토리에서 정적 라우트를 추출 (동적 [..] 세그먼트는 제외) */
  discoverRoutes(projectPath: string): string[] {
    try {
      const appDir = [path.join(projectPath, 'app'), path.join(projectPath, 'src', 'app')].find(
        (d) => {
          try {
            return fs.existsSync(d) && fs.statSync(d).isDirectory();
          } catch {
            return false;
          }
        },
      );
      if (!appDir) return ['/'];

      const routes = new Set<string>();
      const walk = (dir: string, depth: number) => {
        if (depth > 12) return;
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.isFile() && PAGE_FILE.test(entry.name)) {
            routes.add(this.dirToRoute(appDir, dir));
          } else if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
            walk(path.join(dir, entry.name), depth + 1);
          }
        }
      };
      walk(appDir, 0);

      const list = Array.from(routes)
        .filter((r) => !r.includes('[')) // 동적 세그먼트 제외 (MVP)
        .sort();
      return (list.length ? list : ['/']).slice(0, MAX_ROUTES);
    } catch (err) {
      this.logger.warn(`Route discovery failed: ${err instanceof Error ? err.message : err}`);
      return ['/'];
    }
  }

  private dirToRoute(appDir: string, dir: string): string {
    const rel = path.relative(appDir, dir).split(path.sep);
    const segs = rel.filter((s) => s && !(s.startsWith('(') && s.endsWith(')'))); // route group 제거
    return '/' + segs.join('/');
  }

  async crawl(appUrl: string, projectPath?: string, routes?: string[]): Promise<CrawlReport> {
    const targetRoutes = (
      routes && routes.length ? routes : projectPath ? this.discoverRoutes(projectPath) : ['/']
    ).slice(0, MAX_ROUTES);

    const report: CrawlReport = { appUrl, routes: [], totalIssues: 0 };
    let browser: Browser | null = null;

    try {
      const puppeteer = (await import('puppeteer-core')).default;
      const executablePath = resolveChromePath();
      if (!executablePath) throw new Error('Chrome 실행 파일을 찾지 못했습니다.');

      browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox'] });

      for (let i = 0; i < targetRoutes.length; i++) {
        const route = targetRoutes[i];
        const result = await this.crawlRoute(browser, appUrl, route);
        report.routes.push(result);
        report.totalIssues += result.issues.length;
        this.emit('crawl:progress', {
          index: i + 1,
          total: targetRoutes.length,
          route,
          issueCount: result.issues.length,
        } satisfies CrawlProgress);
      }

      this.logger.log(`Crawl done: ${targetRoutes.length} routes, ${report.totalIssues} issues`);
      return report;
    } catch (err) {
      this.logger.warn(`Crawl failed: ${err instanceof Error ? err.message : err}`);
      throw err;
    } finally {
      try {
        await browser?.close();
      } catch {}
    }
  }

  private async crawlRoute(browser: Browser, appUrl: string, route: string): Promise<RouteResult> {
    const url = this.joinUrl(appUrl, route);
    const consoleCol = new ConsoleCollectorService();
    const netCol = new NetworkCollectorService();
    const page = await browser.newPage();

    try {
      await consoleCol.attach(page);
      await netCol.attach(page);

      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: ROUTE_TIMEOUT_MS });
      } catch {
        // networkidle 타임아웃이어도 그때까지 수집된 이슈는 보고
      }
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const issues: CrawlIssue[] = [];

      // 콘솔 에러 / 예외
      for (const rec of consoleCol.snapshot()) {
        if (rec.level !== 'error' && rec.level !== 'exception') continue;
        const issue: CrawlIssue = {
          route,
          kind: rec.level === 'exception' ? 'exception' : 'console-error',
          title: rec.text.split('\n')[0].slice(0, 160),
          detail: rec.text.slice(0, 1000),
        };
        if (rec.frame) {
          const resolved = await this.sourceResolver.resolveFrame(rec.frame);
          if (resolved) {
            issue.fileName = resolved.fileName;
            issue.line = resolved.line;
            issue.endLine = resolved.endLine;
          }
        }
        issues.push(issue);
      }

      // 실패 네트워크 요청 (4xx/5xx/failed)
      for (const rec of netCol.snapshot()) {
        const status = rec.status ?? 0;
        if (!rec.failed && status < 400) continue;
        issues.push({
          route,
          kind: 'network',
          title: `${rec.method ?? 'GET'} ${rec.failed ? 'FAILED' : status} ${rec.name ?? ''}`.trim(),
          detail: rec.errorText ?? rec.statusText,
          url: rec.url,
          status: rec.failed ? undefined : status,
        });
      }

      return { route, url, issues };
    } catch (err) {
      return { route, url, issues: [], error: err instanceof Error ? err.message : String(err) };
    } finally {
      consoleCol.detach();
      netCol.detach();
      try {
        await page.close();
      } catch {}
    }
  }

  private joinUrl(appUrl: string, route: string): string {
    const base = appUrl.replace(/\/+$/, '');
    const r = route.startsWith('/') ? route : '/' + route;
    return base + (r === '/' ? '/' : r);
  }
}
