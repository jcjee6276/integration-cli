"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useClaudeAuth } from "@/features/auth/hooks/useClaudeAuth";
import { LoginPanel } from "@/features/auth/ui/LoginPanel";
import { getClaudeStatus } from "@/features/auth/api/auth.api";
import { useClaudeSessions } from "@/features/chat/hooks/useClaudeSessions";
import { useGeminiSessions } from "@/features/chat/hooks/useGeminiSessions";
import { ChatInput } from "@/features/chat/ui/ChatInput";
import { ChatMessage, StreamingMessage, SystemMessage } from "@/features/chat/ui/ChatMessage";
import { PermissionCard } from "@/features/chat/ui/PermissionCard";
import { AgentSelectModal, AGENT_META } from "@/features/chat/ui/AgentSelectModal";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";
import { TaskCreateModal } from "@/features/tasks/ui/TaskCreateModal";
import { TaskListModal } from "@/features/tasks/ui/TaskListModal";
import { useTaskNotification } from "@/features/tasks/hooks/useTaskNotification";
import { AgentStatusModal } from "@/features/status/ui/AgentStatusModal";
import { HarnessModal } from "@/features/harness/ui/HarnessModal";
import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
import { isQuotaExceeded } from "@/lib/quota";
import { ThemeToggle } from "@/lib/theme";
import type { PermissionPrompt } from "@/lib/ansi";

// ─── Connection Status ────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  connected: "bg-emerald-400 shadow-[0_0_5px_#34d399]",
  connecting: "bg-amber-400 animate-pulse",
  disconnected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "연결됨",
  connecting: "연결 중…",
  disconnected: "연결 끊김",
};

// ─── Checking Skeleton ────────────────────────────────────────────────────────

function CheckingSkeleton() {
  return (
    <div className="flex h-screen bg-[#faf8f5] dark:bg-[#07090e]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-900/[0.07] dark:border-white/[0.07]">
        <div className="relative overflow-hidden border-b border-gray-900/[0.07] px-4 py-3.5 dark:border-white/[0.07]">
          <div className="animate-shimmer-bg absolute inset-0" />
          <div className="relative flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
            <div className="h-[14px] w-20 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="h-9 rounded-lg bg-orange-500/[0.08]" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-gray-900/[0.04] dark:bg-white/[0.04]" />
            <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-900/[0.04] dark:bg-white/[0.04]" />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-lg p-3">
              <div
                className="animate-shimmer-bg absolute inset-0 rounded-lg"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div className="relative flex flex-col gap-1.5">
                <div className="h-[13px] w-28 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
                <div className="h-2.5 w-16 rounded bg-gray-900/[0.04] dark:bg-white/[0.04]" />
                <div className="h-2.5 w-32 rounded bg-gray-900/[0.03] dark:bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-orange-500 dark:border-white/[0.08]" />
        <span className="text-xs text-gray-900/20 dark:text-white/20">인증 확인 중…</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClaudePage() {
  const { authState, loginState, loginOutput, loginUrls, startLogin, cancelLogin, checkAuth } =
    useClaudeAuth();

  useEffect(() => {
    if (loginState === "done") void checkAuth();
  }, [loginState, checkAuth]);

  const claude = useClaudeSessions();
  const gemini = useGeminiSessions();

  // ── 통합 세션 뷰 ──────────────────────────────────────────────────────────
  const sessions = [...claude.sessions, ...gemini.sessions].sort(
    (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
  );

  const connectionStatus = claude.connectionStatus;
  const error = claude.error ?? gemini.error;

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = sessions.find((s) => s.info.id === selectedSessionId) ?? null;

  const selectSession = (id: string) => {
    setSelectedSessionId(id);
    claude.selectSession(id);
    gemini.selectSession(id);
  };

  const sendMessage = (sessionId: string, text: string) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (!session) return;
    if (session.agentId === "gemini") gemini.sendMessage(sessionId, text);
    else claude.sendMessage(sessionId, text);
  };

  const terminateSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (!session) return;
    if (session.agentId === "gemini") await gemini.terminateSession(sessionId);
    else await claude.terminateSession(sessionId);
    setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
  };

  const injectMessage = claude.injectMessage;

  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingDirRef = useRef("");
  const prevSessionCountRef = useRef(0);

  const [sessionDirs, setSessionDirs] = useState<Record<string, string>>({});
  const [currentDir, setCurrentDir] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [agentSelectOpen, setAgentSelectOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [harnessModalOpen, setHarnessModalOpen] = useState(false);

  const { hasNew, clearNew } = useTaskNotification();

  const handleOpenTaskList = () => {
    setTaskListOpen(true);
    clearNew();
  };

  // 세션 전환 시 해당 세션의 디렉토리로 picker 동기화
  useEffect(() => {
    setCurrentDir(selectedSessionId ? (sessionDirs[selectedSessionId] ?? "") : "");
  }, [selectedSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 세션 생성 직후 pendingDirRef 값을 세션에 연결
  useEffect(() => {
    if (sessions.length > prevSessionCountRef.current && pendingDirRef.current) {
      const newest = sessions[0];
      if (newest) {
        setSessionDirs((prev) => ({ ...prev, [newest.info.id]: pendingDirRef.current }));
      }
      pendingDirRef.current = "";
    }
    prevSessionCountRef.current = sessions.length;
  }, [sessions]);

  const handleAgentSelect = (agentId: AgentId) => {
    pendingDirRef.current = currentDir;
    const dir = currentDir || undefined;
    if (agentId === "gemini") {
      gemini.createSession(dir).then((id) => { if (id) setSelectedSessionId(id); });
    } else {
      claude.createSession(agentId, dir).then((id) => { if (id) setSelectedSessionId(id); });
    }
  };

  const handleDirChange = (path: string) => {
    setCurrentDir(path);
    if (selectedSessionId) {
      setSessionDirs((prev) => ({ ...prev, [selectedSessionId]: path }));
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedSession?.messages, selectedSession?.streaming]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!selectedSessionId || !trimmed) return;

    if (trimmed === "/status" && selectedSession?.agentId !== "gemini") {
      injectMessage(selectedSessionId, { role: "user", content: "/status" });
      try {
        const data = await getClaudeStatus();
        const a = data.auth;
        const authLines: string[] = [];
        if (a.loggedIn) {
          authLines.push(`인증         ✅ 로그인됨 (${a.authMethod})`);
          if (a.email)            authLines.push(`계정         ${a.email}`);
          if (a.orgName)          authLines.push(`조직         ${a.orgName}`);
          if (a.subscriptionType) authLines.push(`구독         ${a.subscriptionType}`);
        } else {
          authLines.push("인증         ❌ 로그아웃 상태");
        }
        const lines = [
          `Claude Code  ${data.version}`,
          `플랫폼       ${data.platform}`,
          ...authLines,
          `활성 세션    ${data.activeSessions}개`,
        ].join("\n");
        injectMessage(selectedSessionId, { role: "system", content: lines });
      } catch {
        injectMessage(selectedSessionId, {
          role: "system",
          content: "❌ 상태 조회 실패 — 서버 연결을 확인하세요.",
        });
      }
      return;
    }

    sendMessage(selectedSessionId, trimmed);
  };

  const inputDisabled =
    !selectedSession || selectedSession.isWaiting || connectionStatus !== "connected";

  if (authState === "checking") return <CheckingSkeleton />;

  if (authState === "unauthenticated") {
    return (
      <div className="flex h-screen flex-col bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
        <header className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
          <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">JI CLI</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <LoginPanel
          loginState={loginState}
          loginOutput={loginOutput}
          loginUrls={loginUrls}
          onStart={startLogin}
          onCancel={cancelLogin}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">

      <AgentSelectModal
        open={agentSelectOpen}
        onClose={() => setAgentSelectOpen(false)}
        onSelect={handleAgentSelect}
      />

      <AgentStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
      />

      <HarnessModal
        open={harnessModalOpen}
        onClose={() => setHarnessModalOpen(false)}
      />

      {/* ── 사이드바 ────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-900/[0.07] dark:border-white/[0.07]">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
          <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">JI CLI</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusModalOpen(true)}
              title="에이전트 상태"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-gray-900/[0.05] dark:hover:bg-white/[0.05]"
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[connectionStatus]}`} />
              <span className="text-xs text-gray-900/25 hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50">
                {STATUS_LABEL[connectionStatus] ?? ""}
              </span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* 새 세션 */}
        <div className="flex flex-col gap-2 p-3">
          <button
            onClick={() => setAgentSelectOpen(true)}
            disabled={connectionStatus !== "connected"}
            className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 새 세션
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="flex-1 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] py-2 text-sm font-medium text-gray-900/55 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/85 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/55 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/85"
            >
              ＋ 작업 추가
            </button>
            <button
              type="button"
              onClick={handleOpenTaskList}
              title="작업 목록"
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] text-gray-900/35 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/35 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/70"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 3.5A.75.75 0 012.75 7.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5A.75.75 0 012.75 11h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 11.75z" clipRule="evenodd" />
              </svg>
              {hasNew && (
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[#faf8f5] dark:ring-[#07090e]" />
              )}
            </button>
          </div>
        </div>

        <TaskCreateModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
        <TaskListModal open={taskListOpen} onClose={() => setTaskListOpen(false)} />

        {/* 세션 목록 */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-900/20 dark:text-white/20">
              {connectionStatus === "connected" ? "세션이 없습니다" : "연결 중…"}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sessions.map((s) => {
                const lastMsg = s.messages[s.messages.length - 1];
                const isSelected = selectedSessionId === s.info.id;
                const agentMeta = AGENT_META[s.agentId];
                const quotaDetected =
                  isQuotaExceeded(s.streaming) ||
                  (!!lastMsg && isQuotaExceeded(lastMsg.content));
                return (
                  <li key={s.info.id}>
                    <button
                      onClick={() => selectSession(s.info.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-gray-900/[0.06] text-gray-900/90 dark:bg-white/[0.06] dark:text-white/90"
                          : "text-gray-900/40 hover:bg-gray-900/[0.03] hover:text-gray-900/70 dark:text-white/40 dark:hover:bg-white/[0.03] dark:hover:text-white/70",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${agentMeta.dotColor}`} />
                          <span className="truncate text-xs font-medium">{s.info.title}</span>
                        </div>
                        {quotaDetected ? (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                            ⚠ 한도
                          </span>
                        ) : s.isWaiting ? (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 pl-3 text-[10px] text-gray-900/20 dark:text-white/20">
                        {agentMeta.label} · {new Date(s.info.createdAt).toLocaleString()}
                      </p>
                      {lastMsg && (
                        <p className="mt-0.5 pl-3 truncate text-[11px] text-gray-900/25 dark:text-white/25">
                          {lastMsg.content.slice(0, 40) || "…"}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* 하단 — 하네스 설정 */}
        <div className="shrink-0 border-t border-gray-900/[0.06] p-2 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setHarnessModalOpen(true)}
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

      {/* ── 메인 채팅 영역 ───────────────────────────────────────────────────── */}
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
                {connectionStatus !== "connected"
                  ? "서버에 연결 중…"
                  : "왼쪽에서 세션을 선택하거나 새 세션을 생성하세요"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 채팅 헤더 */}
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
                  {sessionDirs[selectedSession.info.id] && (
                    <span className="flex items-center gap-1 rounded-md border border-gray-900/[0.06] bg-gray-900/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-gray-900/40 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
                        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
                      </svg>
                      <span className="max-w-[200px] truncate">{sessionDirs[selectedSession.info.id]}</span>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => terminateSession(selectedSession.info.id)}
                className="shrink-0 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 py-1.5 text-xs font-medium text-gray-900/45 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.06] hover:text-gray-900/75 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/45 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06] dark:hover:text-white/75"
              >
                종료
              </button>
            </header>

            {/* 에러 배너 */}
            {error && (
              <div className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            {/* 메시지 목록 */}
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

                {selectedSession.messages.map((msg) => {
                  if (msg.role === "permission") {
                    const prompt = JSON.parse(msg.content) as PermissionPrompt;
                    return (
                      <PermissionCard
                        key={msg.id}
                        tool={prompt.tool}
                        command={prompt.command}
                        warning={prompt.warning}
                        onAllow={() => sendMessage(selectedSession.info.id, "1")}
                        onDeny={() => sendMessage(selectedSession.info.id, "2")}
                      />
                    );
                  }
                  if (msg.role === "system") {
                    return <SystemMessage key={msg.id} content={msg.content} />;
                  }
                  return <ChatMessage key={msg.id} message={msg} agentId={selectedSession.agentId} />;
                })}

                {selectedSession.isWaiting && (
                  <StreamingMessage content={selectedSession.streaming} agentId={selectedSession.agentId} />
                )}

                <div ref={bottomRef} />
              </div>
            </main>

            {/* 입력창 */}
            <footer className="shrink-0 border-t border-gray-900/[0.07] px-4 pb-4 pt-3 dark:border-white/[0.07]">
              <div className="mx-auto max-w-2xl space-y-2">
                <div className="flex items-center gap-2 border-b border-gray-900/[0.05] pb-2 dark:border-white/[0.05]">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-900/25 dark:text-white/25">
                    cwd
                  </span>
                  <WorkingDirPicker
                    value={currentDir}
                    onChange={handleDirChange}
                    variant="inline"
                  />
                </div>
                <ChatInput
                  onSend={handleSend}
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
    </div>
  );
}
