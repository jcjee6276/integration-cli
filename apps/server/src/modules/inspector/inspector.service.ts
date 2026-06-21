import { EventEmitter } from 'events';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer-core';

import { resolveChromePath } from './chrome.util';
import type {
  InspectorRawPayload,
  InspectorState,
  InspectorStatusEvent,
  InspectorElementEvent,
} from './inspector.types';
import { NetworkCollectorService } from './network-collector.service';
import {
  BINDING_NAME,
  NET_BINDINGS,
  NETWORK_SCRIPT,
  OVERLAY_SCRIPT,
  PERF_SCRIPT,
  REACT_SCRIPT,
} from './scripts';
import { SourceResolverService } from './source-resolver.service';

export type {
  InspectorState,
  InspectorStatusEvent,
  InspectorElementEvent,
} from './inspector.types';

/**
 * 인스펙터 세션 오케스트레이터.
 * - Chrome 기동/종료(puppeteer-core) 및 in-page 스크립트 주입
 * - 요소 클릭 payload 수신 → SourceResolverService로 소스 매핑 후 이벤트 emit
 * - Network 수집은 NetworkCollectorService에 위임, 패널용 바인딩 노출
 * 세부 로직은 source-resolver / network-collector / scripts / chrome.util 로 분리.
 */
@Injectable()
export class InspectorService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(InspectorService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;
  private state: InspectorState = 'idle';

  constructor(
    private readonly sourceResolver: SourceResolverService,
    private readonly network: NetworkCollectorService,
  ) {
    super();
  }

  getState(): InspectorState {
    return this.state;
  }

  async start(appUrl: string): Promise<InspectorStatusEvent> {
    try {
      await this.stop();
      this.setState({ state: 'connecting', appUrl });

      // 동적 import — puppeteer-core 미설치 환경에서 모듈 로드 실패 방지
      const puppeteer = (await import('puppeteer-core')).default;
      const executablePath = resolveChromePath();
      if (!executablePath) {
        throw new Error(
          'Chrome 실행 파일을 찾지 못했습니다. JC_CHROME_PATH 환경변수로 경로를 지정해 주세요.',
        );
      }

      this.browser = await puppeteer.launch({
        headless: false,
        executablePath,
        defaultViewport: null,
        args: ['--no-first-run', '--no-default-browser-check'],
      });

      const pages = await this.browser.pages();
      this.page = pages[0] ?? (await this.browser.newPage());

      await this.page.exposeFunction(BINDING_NAME, (payload: string) => {
        void this.handleElementPayload(payload);
      });
      // Network 패널용 바인딩 (인스펙트된 창의 패널이 폴링/조회)
      await this.page.exposeFunction(NET_BINDINGS.sync, () => this.network.snapshot());
      await this.page.exposeFunction(NET_BINDINGS.body, (id: string) => this.network.getBody(id));
      await this.page.exposeFunction(NET_BINDINGS.clear, () => {
        this.network.clear();
        return true;
      });

      await this.network.attach(this.page);

      // React 모니터는 React보다 먼저 훅을 잡아야 하므로 가장 먼저 주입
      const scripts = [REACT_SCRIPT, OVERLAY_SCRIPT, NETWORK_SCRIPT, PERF_SCRIPT];
      for (const script of scripts) await this.page.evaluateOnNewDocument(script);

      await this.page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      // 이미 로드된 현재 페이지에도 즉시 주입 (goto 이전 상태 대비)
      for (const script of scripts) await this.page.evaluate(script);

      // 사용자가 Chrome 창을 직접 닫은 경우 정리
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.page = null;
        this.network.detach();
        this.setState({ state: 'idle' });
      });

      this.setState({ state: 'active', appUrl });
      this.logger.log(`Inspector session started: ${appUrl}`);
      return { state: this.state, appUrl };
    } catch (err) {
      const error = err instanceof Error ? err.message : '인스펙터를 시작하지 못했습니다';
      this.logger.error(`Inspector start failed: ${error}`);
      await this.stop();
      this.setState({ state: 'idle', error });
      return { state: 'idle', error };
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.browser) await this.browser.close();
    } catch (err) {
      this.logger.warn(
        `Inspector browser close failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.browser = null;
      this.page = null;
      this.network.detach();
      await this.sourceResolver.clear();
      if (this.state !== 'idle') this.setState({ state: 'idle' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /** in-page overlay가 보낸 클릭 요소 payload → 소스 매핑 후 emit */
  private async handleElementPayload(payload: string): Promise<void> {
    try {
      const data = JSON.parse(payload) as InspectorRawPayload;

      if (data.source?.fileName || data.frame) {
        const resolved = await this.sourceResolver.resolvePayload(data);
        if (resolved) {
          this.emit('inspector:element', {
            ...resolved,
            componentName: data.componentName,
          } satisfies InspectorElementEvent);
          return;
        }
      }

      this.emit('inspector:element', {
        notFound: true,
        componentName: data.componentName,
        tagName: data.tagName,
        text: data.text,
      } satisfies InspectorElementEvent);
    } catch (err) {
      this.logger.warn(
        `Inspector payload handle failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private setState(event: InspectorStatusEvent): void {
    this.state = event.state;
    this.emit('inspector:status', event);
  }
}
