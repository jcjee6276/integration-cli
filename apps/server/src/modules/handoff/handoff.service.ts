import { EventEmitter } from 'events';
import * as path from 'path';

import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { ClaudePtyManager } from '../agents/claude/claude-pty.manager';
import { CodexSessionManager } from '../agents/codex/codex-session.manager';
import { GeminiSessionManager } from '../agents/gemini/gemini-session.manager';
import { ConversationService } from '../conversations/conversation.service';
import { AgentModel, ConversationType } from '../conversations/enums/conversation.enum';
import type { CreateAgentHandoffDto, HandoffAgentId } from './dto/create-agent-handoff.dto';
import type { CreateBatchHandoffDto } from './dto/create-batch-handoff.dto';

export interface HandoffResult {
  agentId: HandoffAgentId;
  sessionId: string;
  promptId: string;
  route: string;
}

type TextEvent = { sessionId: string; text?: string };
type ResultEvent = { sessionId: string };
type ErrorEvent = { sessionId?: string; message?: string };

const ROUTE_BY_AGENT: Record<HandoffAgentId, string> = {
  claude: '/claude',
  gemini: '/gemini',
  codex: '/codex',
};

const MODEL_BY_AGENT: Record<HandoffAgentId, AgentModel> = {
  claude: AgentModel.CLAUDE,
  gemini: AgentModel.GEMINI,
  codex: AgentModel.CODEX,
};

@Injectable()
export class HandoffService implements OnModuleDestroy {
  private readonly logger = new Logger(HandoffService.name);
  private readonly cleanups = new Map<string, () => void>();

  constructor(
    private readonly claudeManager: ClaudePtyManager,
    private readonly geminiManager: GeminiSessionManager,
    private readonly codexManager: CodexSessionManager,
    private readonly conversationService: ConversationService,
  ) {}

  async create(dto: CreateAgentHandoffDto): Promise<HandoffResult> {
    try {
      const promptId = uuidv4();
      const prompt = this.buildPrompt(dto);
      const sessionId = this.createSession(dto.agentId, dto.projectPath);

      this.captureAgentResponse(dto.agentId, sessionId, promptId);
      await this.saveConversation(
        dto.agentId,
        sessionId,
        promptId,
        prompt,
        ConversationType.USER_MESSAGE,
      );
      this.sendMessage(dto.agentId, sessionId, prompt);

      return {
        agentId: dto.agentId,
        sessionId,
        promptId,
        route: `${ROUTE_BY_AGENT[dto.agentId]}?sessionId=${encodeURIComponent(sessionId)}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '핸드오프를 시작하지 못했습니다';
      this.logger.warn(`Agent handoff failed: ${message}`);
      throw new BadRequestException(message);
    }
  }

  onModuleDestroy(): void {
    try {
      for (const cleanup of this.cleanups.values()) cleanup();
      this.cleanups.clear();
    } catch {}
  }

  private createSession(agentId: HandoffAgentId, projectPath?: string): string {
    try {
      const workingDirectory = projectPath?.trim() || process.cwd();
      if (agentId === 'claude') return this.claudeManager.createSession(workingDirectory).id;
      if (agentId === 'gemini') return this.geminiManager.createSession(workingDirectory).id;
      return this.codexManager.createSession(workingDirectory).id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '세션을 생성하지 못했습니다');
    }
  }

  private sendMessage(agentId: HandoffAgentId, sessionId: string, prompt: string): void {
    try {
      if (agentId === 'claude') {
        this.claudeManager.sendMessage(sessionId, prompt);
        return;
      }
      if (agentId === 'gemini') {
        this.geminiManager.sendMessage(sessionId, prompt);
        return;
      }
      this.codexManager.sendMessage(sessionId, prompt);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '메시지를 전송하지 못했습니다');
    }
  }

  private captureAgentResponse(agentId: HandoffAgentId, sessionId: string, promptId: string): void {
    try {
      const emitter = this.getEmitter(agentId);
      const textEvent = agentId === 'codex' ? 'session:text' : 'text-delta';
      const resultEvent = agentId === 'codex' ? 'session:result' : 'result';
      const exitEvent = agentId === 'codex' ? 'session:exit' : 'exit';
      let output = '';
      let saved = false;

      const cleanup = () => {
        try {
          emitter.off(textEvent, onText);
          emitter.off(resultEvent, onResult);
          emitter.off(exitEvent, onExit);
          emitter.off('error', onError);
          this.cleanups.delete(sessionId);
        } catch {}
      };

      const save = () => {
        try {
          if (saved) return;
          saved = true;
          cleanup();
          const content = output.trim();
          if (!content) return;
          void this.saveConversation(
            agentId,
            sessionId,
            promptId,
            content,
            ConversationType.AGENT_MESSAGE,
          );
        } catch {}
      };

      const onText = (event: TextEvent) => {
        try {
          if (event.sessionId !== sessionId) return;
          output += event.text ?? '';
        } catch {}
      };

      const onResult = (event: ResultEvent) => {
        try {
          if (event.sessionId !== sessionId) return;
          save();
        } catch {}
      };

      const onExit = (event: ResultEvent) => {
        try {
          if (event.sessionId !== sessionId) return;
          save();
        } catch {}
      };

      const onError = (event: ErrorEvent) => {
        try {
          if (event.sessionId && event.sessionId !== sessionId) return;
          if (event.message) output += `\n${event.message}`;
          save();
        } catch {}
      };

      emitter.on(textEvent, onText);
      emitter.on(resultEvent, onResult);
      emitter.on(exitEvent, onExit);
      emitter.on('error', onError);
      this.cleanups.set(sessionId, cleanup);
    } catch (err) {
      this.logger.warn(
        `Agent response capture failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private getEmitter(agentId: HandoffAgentId): EventEmitter {
    if (agentId === 'claude') return this.claudeManager;
    if (agentId === 'gemini') return this.geminiManager;
    return this.codexManager;
  }

  private saveConversation(
    agentId: HandoffAgentId,
    sessionId: string,
    promptId: string,
    content: string,
    type: ConversationType,
  ): Promise<unknown> {
    return this.conversationService.create({
      sessionId,
      promptId,
      content,
      agentModel: MODEL_BY_AGENT[agentId],
      type,
    });
  }

  /** 여러 이슈를 단일 세션·단일 프롬프트로 위임 (일관성↑·토큰↓) */
  async createBatch(dto: CreateBatchHandoffDto): Promise<HandoffResult & { count: number }> {
    try {
      const promptId = uuidv4();
      const prompt = this.buildBatchPrompt(dto);
      const sessionId = this.createSession(dto.agentId, dto.projectPath);

      this.captureAgentResponse(dto.agentId, sessionId, promptId);
      await this.saveConversation(
        dto.agentId,
        sessionId,
        promptId,
        prompt,
        ConversationType.USER_MESSAGE,
      );
      this.sendMessage(dto.agentId, sessionId, prompt);

      return {
        agentId: dto.agentId,
        sessionId,
        promptId,
        route: `${ROUTE_BY_AGENT[dto.agentId]}?sessionId=${encodeURIComponent(sessionId)}`,
        count: dto.items.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '일괄 핸드오프를 시작하지 못했습니다';
      this.logger.warn(`Agent batch handoff failed: ${message}`);
      throw new BadRequestException(message);
    }
  }

  private buildBatchPrompt(dto: CreateBatchHandoffDto): string {
    try {
      const intro =
        dto.instruction?.trim() ||
        '아래 이슈들을 한 세션에서 순서대로 진단하고 고쳐줘. 관련된 이슈는 묶어서 처리하고, 각 항목 처리 후 무엇을 바꿨는지 간단히 보고해줘.';

      const items = dto.items.map((it, i) => {
        const loc = it.filePath
          ? `\n   파일: ${it.filePath}${it.line ? `:${it.line}${it.endLine && it.endLine !== it.line ? `-${it.endLine}` : ''}` : ''}`
          : '';
        const detail = it.detail?.trim() ? `\n   상세: ${it.detail.trim()}` : '';
        return `${i + 1}. [${it.route || '-'}] ${it.title}${loc}${detail}`;
      });

      return [
        intro,
        '',
        '---',
        `Project root: ${dto.projectPath?.trim() || 'unknown'}`,
        `이슈 ${dto.items.length}건:`,
        ...items,
      ].join('\n');
    } catch {
      return dto.items.map((it) => `- ${it.title}`).join('\n');
    }
  }

  private buildPrompt(dto: CreateAgentHandoffDto): string {
    try {
      const fileName = dto.fileName?.trim() || path.basename(dto.filePath);
      const lineRange = dto.line
        ? dto.endLine && dto.endLine !== dto.line
          ? `${dto.line}-${dto.endLine}`
          : `${dto.line}`
        : 'unknown';
      const selectedText = dto.selectedText?.trim();

      return [
        dto.request.trim(),
        '',
        '---',
        'Context from Project Code Viewer',
        `Project root: ${dto.projectPath?.trim() || 'unknown'}`,
        `File: ${dto.filePath}`,
        `Focused line: ${lineRange}`,
        `File name: ${fileName}`,
        selectedText ? ['', 'Selected source:', '```', selectedText, '```'].join('\n') : '',
      ]
        .filter(Boolean)
        .join('\n');
    } catch {
      return dto.request.trim();
    }
  }
}
