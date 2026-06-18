"use client";

import Link from "next/link";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { isQuotaExceeded } from "@/lib/quota";
import { ThemeToggle } from "@/lib/theme";
import { AGENT_META } from "./AgentSelectModal";
import type { ConnectionStatus, UnifiedSessionState } from "../hooks/useUnifiedSessions";

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-400 shadow-[0_0_5px_#34d399]",
  connecting: "bg-amber-400 animate-pulse",
  disconnected: "bg-red-500",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "연결됨",
  connecting: "연결 중…",
  disconnected: "연결 끊김",
};

interface SessionSidebarProps {
  sessions: UnifiedSessionState[];
  selectedSessionId: string | null;
  overallConnectionStatus: ConnectionStatus;
  hasNewTask: boolean;
  menuOpenId: string | null;
  renamingId: string | null;
  renameValue: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onSelectSession: (sessionId: string) => void;
  onOpenAgentSelect: () => void;
  onOpenTaskCreate: () => void;
  onOpenTaskList: () => void;
  onOpenStatus: () => void;
  onOpenHarness: () => void;
  onSetMenuOpenId: Dispatch<SetStateAction<string | null>>;
  onStartRename: (sessionId: string, currentTitle: string) => void;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
}

export function SessionSidebar({
  sessions,
  selectedSessionId,
  overallConnectionStatus,
  hasNewTask,
  menuOpenId,
  renamingId,
  renameValue,
  menuRef,
  onSelectSession,
  onOpenAgentSelect,
  onOpenTaskCreate,
  onOpenTaskList,
  onOpenStatus,
  onOpenHarness,
  onSetMenuOpenId,
  onStartRename,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
}: SessionSidebarProps) {
  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-900/[0.07] dark:border-white/[0.07]">
      <div className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
        <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
          ←
        </Link>
        <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">JC CLI</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenStatus}
            title="에이전트 상태"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-gray-900/[0.05] dark:hover:bg-white/[0.05]"
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[overallConnectionStatus]}`} />
            <span className="text-xs text-gray-900/25 hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50">
              {STATUS_LABEL[overallConnectionStatus]}
            </span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          onClick={onOpenAgentSelect}
          disabled={overallConnectionStatus !== "connected"}
          className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + 새 세션
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenTaskCreate}
            className="flex-1 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] py-2 text-sm font-medium text-gray-900/55 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/85 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/55 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/85"
          >
            ＋ 작업 추가
          </button>
          <button
            type="button"
            onClick={onOpenTaskList}
            title="작업 목록"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] text-gray-900/35 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/35 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/70"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 3.5A.75.75 0 012.75 7.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5A.75.75 0 012.75 11h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 11.75z" clipRule="evenodd" />
            </svg>
            {hasNewTask && (
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[#faf8f5] dark:ring-[#07090e]" />
            )}
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-900/20 dark:text-white/20">
            {overallConnectionStatus === "connected" ? "세션이 없습니다" : "연결 중…"}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const lastMsg = session.messages[session.messages.length - 1];
              const isSelected = selectedSessionId === session.info.id;
              const agentMeta = AGENT_META[session.agentId];
              const quotaDetected =
                isQuotaExceeded(session.streaming) ||
                (!!lastMsg && isQuotaExceeded(lastMsg.content));
              const isRenaming = renamingId === session.info.id;
              const isMenuOpen = menuOpenId === session.info.id;

              return (
                <li key={session.info.id} className="group relative">
                  {isRenaming ? (
                    <div className={[
                      "rounded-lg px-3 py-2",
                      isSelected
                        ? "bg-gray-900/[0.06] dark:bg-white/[0.06]"
                        : "bg-gray-900/[0.03] dark:bg-white/[0.03]",
                    ].join(" ")}>
                      <div className="flex items-center gap-1.5 pl-0">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${agentMeta.dotColor}`} />
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => onRenameValueChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onConfirmRename();
                            }
                            if (e.key === "Escape") onCancelRename();
                          }}
                          onBlur={onConfirmRename}
                          className="min-w-0 flex-1 border-b border-orange-500/50 bg-transparent pb-px text-xs font-medium text-gray-900/90 outline-none dark:text-white/90"
                        />
                      </div>
                      <p className="mt-0.5 pl-3 text-[10px] text-gray-900/20 dark:text-white/20">
                        Enter로 저장 · Esc로 취소
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.info.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-gray-900/[0.06] text-gray-900/90 dark:bg-white/[0.06] dark:text-white/90"
                          : "text-gray-900/40 hover:bg-gray-900/[0.03] hover:text-gray-900/70 dark:text-white/40 dark:hover:bg-white/[0.03] dark:hover:text-white/70",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1.5 pr-5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${agentMeta.dotColor}`} />
                          <span className="truncate text-xs font-medium">{session.info.title}</span>
                        </div>
                        {quotaDetected ? (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                            ⚠ 한도
                          </span>
                        ) : session.isWaiting ? (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 pl-3 text-[10px] text-gray-900/20 dark:text-white/20">
                        {agentMeta.label} · {new Date(session.info.createdAt).toLocaleString()}
                      </p>
                      {lastMsg && (
                        <p className="mt-0.5 pl-3 truncate text-[11px] text-gray-900/25 dark:text-white/25">
                          {lastMsg.content.slice(0, 40) || "…"}
                        </p>
                      )}
                    </button>
                  )}

                  {!isRenaming && (
                    <div
                      ref={isMenuOpen ? menuRef : undefined}
                      className="absolute right-1.5 top-2 z-10"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetMenuOpenId(isMenuOpen ? null : session.info.id);
                        }}
                        className={[
                          "flex h-5 w-5 items-center justify-center rounded transition-all",
                          "text-gray-900/30 hover:bg-gray-900/[0.08] hover:text-gray-900/70",
                          "dark:text-white/30 dark:hover:bg-white/[0.08] dark:hover:text-white/70",
                          isMenuOpen
                            ? "bg-gray-900/[0.06] opacity-100 dark:bg-white/[0.06]"
                            : "opacity-0 group-hover:opacity-100",
                        ].join(" ")}
                        aria-label="세션 메뉴"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <circle cx="3" cy="8" r="1.2" />
                          <circle cx="8" cy="8" r="1.2" />
                          <circle cx="13" cy="8" r="1.2" />
                        </svg>
                      </button>

                      {isMenuOpen && (
                        <div
                          className={[
                            "absolute right-0 top-full z-20 mt-1 min-w-[120px]",
                            "rounded-lg border border-gray-900/[0.08] bg-white py-1",
                            "shadow-[0_4px_16px_rgba(0,0,0,0.10)]",
                            "dark:border-white/[0.08] dark:bg-[#0e1117]",
                            "dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]",
                          ].join(" ")}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onStartRename(session.info.id, session.info.title)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-900/70 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/90 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white/90"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z" />
                            </svg>
                            이름 바꾸기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-900/[0.06] p-2 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={onOpenHarness}
          title="하네스 설정"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-900/35 transition-colors hover:bg-gray-900/[0.04] hover:text-gray-900/65 dark:text-white/35 dark:hover:bg-white/[0.04] dark:hover:text-white/65"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046a6.645 6.645 0 01.571.99c.014.03.014.066.006.104a.44.44 0 01-.07.15l-.686.858c-.357.447-.496.975-.446 1.488.016.165.025.332.025.5 0 .168-.009.335-.025.5-.05.513.089 1.04.446 1.488l.687.858c.044.055.072.11.07.15-.008.038-.008.074-.007.103a6.557 6.557 0 01-.57.99c-.02.03-.087.077-.196.047l-1.102-.303c-.56-.153-1.113-.008-1.53.27a6.36 6.36 0 01-.502.29c-.447.222-.85.629-.997 1.189l-.289 1.105c-.029.11-.1.143-.137.146a6.645 6.645 0 01-1.142 0c-.036-.003-.108-.036-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a6.36 6.36 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.557 6.557 0 01-.57-.99c-.014-.03-.014-.066-.007-.104a.44.44 0 01.07-.15l.687-.858c.357-.447.496-.975.446-1.488A6.5 6.5 0 012 8c0-.168.009-.335.025-.5.05-.513-.089-1.04-.446-1.488L.892 5.154a.44.44 0 01-.07-.15c-.008-.038-.008-.074.006-.103.116-.342.27-.67.37-.99.02-.03.087-.077.196-.047l1.102.303c.56.153 1.113.008 1.53-.27.16-.107.327-.204.501-.29.447-.222.85-.629.997-1.189l.289-1.105c.029-.11.1-.143.137-.146zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" clipRule="evenodd" />
          </svg>
          하네스 설정
        </button>
      </div>
    </aside>
  );
}
