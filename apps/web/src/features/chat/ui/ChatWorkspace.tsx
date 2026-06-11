"use client";

import type { RefObject } from "react";

import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
import type { PermissionPrompt } from "@/lib/ansi";
import type { ConnectionStatus, UnifiedSessionState } from "../hooks/useUnifiedSessions";
import type { AgentModelSettings, AgentModelSettingsByAgent } from "../lib/agentModelOptions";
import { AGENT_META } from "./AgentSelectModal";
import type { AgentId } from "./AgentSelectModal";
import { AgentModelPicker } from "./AgentModelPicker";
import { ChatInput } from "./ChatInput";
import { ChatMessage, StreamingMessage, SystemMessage } from "./ChatMessage";
import { PermissionCard } from "./PermissionCard";

interface ChatWorkspaceProps {
  selectedSession: UnifiedSessionState | null;
  selectedSessionDir: string;
  overallConnectionStatus: ConnectionStatus;
  currentDir: string;
  error: string | null;
  inputDisabled: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  modelSettingsByAgent: AgentModelSettingsByAgent;
  onTerminateSession: (sessionId: string) => void;
  onSend: (text: string) => void;
  onSendMessage: (sessionId: string, text: string) => void;
  onDirChange: (path: string) => void;
  onModelSettingsChange: (agentId: AgentId, settings: AgentModelSettings) => void;
}

function parsePermissionPrompt(content: string): PermissionPrompt | null {
  try {
    const parsed = JSON.parse(content) as Partial<PermissionPrompt>;
    if (typeof parsed.tool !== "string" || typeof parsed.command !== "string") {
      return null;
    }
    return {
      tool: parsed.tool,
      command: parsed.command,
      warning: typeof parsed.warning === "string" ? parsed.warning : undefined,
    };
  } catch {
    return null;
  }
}

export function ChatWorkspace({
  selectedSession,
  selectedSessionDir,
  overallConnectionStatus,
  currentDir,
  error,
  inputDisabled,
  bottomRef,
  modelSettingsByAgent,
  onTerminateSession,
  onSend,
  onSendMessage,
  onDirChange,
  onModelSettingsChange,
}: ChatWorkspaceProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!selectedSession ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.04] blur-[120px]" />
          </div>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-orange-500/[0.08] dark:border-white/[0.08]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-[#D97757]">
              <path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" />
            </svg>
          </div>
          <div className="relative text-center">
            <p className="font-semibold text-gray-900/75 dark:text-white/75">JI CLI</p>
            <p className="mt-1 text-sm text-gray-900/30 dark:text-white/30">
              {overallConnectionStatus !== "connected"
                ? "서버에 연결 중…"
                : "왼쪽에서 세션을 선택하거나 새 세션을 생성하세요"}
            </p>
          </div>
        </div>
      ) : (
        <>
          <header className="flex shrink-0 items-center justify-between border-b border-gray-900/[0.07] px-5 py-3 dark:border-white/[0.07]">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${AGENT_META[selectedSession.agentId].dotColor}`} />
                <span className="text-sm font-medium text-gray-900/80 dark:text-white/80">{selectedSession.info.title}</span>
                <span className="rounded-md border border-gray-900/[0.06] bg-gray-900/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-gray-900/35 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/35">
                  {AGENT_META[selectedSession.agentId].label}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="font-mono text-[10px] text-gray-900/20 dark:text-white/20">{selectedSession.info.id.slice(0, 8)}…</span>
                {selectedSessionDir && (
                  <span className="flex items-center gap-1 rounded-md border border-gray-900/[0.06] bg-gray-900/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-gray-900/40 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
                      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
                    </svg>
                    <span className="max-w-[200px] truncate">{selectedSessionDir}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTerminateSession(selectedSession.info.id)}
              className="shrink-0 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 py-1.5 text-xs font-medium text-gray-900/45 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.06] hover:text-gray-900/75 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/45 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06] dark:hover:text-white/75"
            >
              종료
            </button>
          </header>

          {error && (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <main className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-5">
              {!selectedSession.messagesLoaded && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-900/25 dark:text-white/25">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/[0.07] border-t-gray-900/40 dark:border-white/[0.07] dark:border-t-white/40" />
                  이전 대화를 불러오는 중…
                </div>
              )}

              {selectedSession.messagesLoaded &&
                selectedSession.messages.length === 0 &&
                !selectedSession.isWaiting && (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <p className="text-sm text-gray-900/25 dark:text-white/25">
                      {AGENT_META[selectedSession.agentId].label}이 준비되었습니다. 메시지를 보내보세요.
                    </p>
                  </div>
                )}

              {selectedSession.messages.map((message) => {
                if (message.role === "permission") {
                  const prompt = parsePermissionPrompt(message.content);
                  if (!prompt) {
                    return (
                      <SystemMessage
                        key={message.id}
                        content={`권한 요청을 표시할 수 없습니다.\n${message.content}`}
                      />
                    );
                  }
                  return (
                    <PermissionCard
                      key={message.id}
                      tool={prompt.tool}
                      command={prompt.command}
                      warning={prompt.warning}
                      onAllow={() => onSendMessage(selectedSession.info.id, "1")}
                      onDeny={() => onSendMessage(selectedSession.info.id, "2")}
                    />
                  );
                }
                if (message.role === "system") {
                  return <SystemMessage key={message.id} content={message.content} />;
                }
                return <ChatMessage key={message.id} message={message} agentId={selectedSession.agentId} />;
              })}

              {selectedSession.isWaiting && (
                <StreamingMessage content={selectedSession.streaming} agentId={selectedSession.agentId} />
              )}

              <div ref={bottomRef} />
            </div>
          </main>

          <footer className="shrink-0 border-t border-gray-900/[0.07] px-4 pb-4 pt-3 dark:border-white/[0.07]">
            <div className="mx-auto max-w-2xl space-y-2">
              <div className="flex items-center justify-between gap-3 border-b border-gray-900/[0.05] pb-2 dark:border-white/[0.05]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-900/25 dark:text-white/25">
                    cwd
                  </span>
                  <WorkingDirPicker value={currentDir} onChange={onDirChange} variant="inline" />
                </div>
                <AgentModelPicker
                  agentId={selectedSession.agentId}
                  value={modelSettingsByAgent[selectedSession.agentId]}
                  onChange={onModelSettingsChange}
                />
              </div>
              <ChatInput
                onSend={onSend}
                disabled={inputDisabled}
                placeholder={
                  selectedSession.isWaiting
                    ? "응답을 기다리는 중…"
                    : "메시지 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
                }
              />
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
