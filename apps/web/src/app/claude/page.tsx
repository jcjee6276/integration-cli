"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useClaudeAuth } from "@/features/auth/hooks/useClaudeAuth";
import { LoginPanel } from "@/features/auth/ui/LoginPanel";
import { getClaudeStatus } from "@/features/auth/api/auth.api";
import { useClaudeSessions } from "@/features/chat/hooks/useClaudeSessions";
import { ChatInput } from "@/features/chat/ui/ChatInput";
import { ChatMessage, StreamingMessage, SystemMessage } from "@/features/chat/ui/ChatMessage";
import { PermissionCard } from "@/features/chat/ui/PermissionCard";
import { TaskCreateModal } from "@/features/tasks/ui/TaskCreateModal";
import { TaskListModal } from "@/features/tasks/ui/TaskListModal";
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
    <div className="flex h-screen bg-[#07090e]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-white/[0.07]">
        <div className="relative overflow-hidden border-b border-white/[0.07] px-4 py-3.5">
          <div className="animate-shimmer-bg absolute inset-0" />
          <div className="relative flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-white/[0.07]" />
            <div className="h-[14px] w-20 rounded bg-white/[0.07]" />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="h-9 rounded-lg bg-white/[0.04]" />
          <div className="h-9 rounded-lg bg-orange-500/[0.08]" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-white/[0.04]" />
            <div className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.04]" />
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
                <div className="h-[13px] w-28 rounded bg-white/[0.07]" />
                <div className="h-2.5 w-16 rounded bg-white/[0.04]" />
                <div className="h-2.5 w-32 rounded bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/[0.08] border-t-orange-500" />
        <span className="text-xs text-white/20">인증 확인 중…</span>
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

  const {
    connectionStatus,
    sessions,
    selectedSession,
    selectedSessionId,
    error,
    createSession,
    selectSession,
    sendMessage,
    terminateSession,
    injectMessage,
  } = useClaudeSessions();

  const bottomRef = useRef<HTMLDivElement>(null);
  const dirPickerRef = useRef<HTMLInputElement>(null);
  const [workingDir, setWorkingDir] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);

  const dirBasename = workingDir
    ? workingDir.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean).at(-1) ?? ""
    : "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedSession?.messages, selectedSession?.streaming]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!selectedSessionId || !trimmed) return;

    if (trimmed === "/status") {
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
      <div className="flex h-screen flex-col bg-[#07090e] text-white">
        <header className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <Link href="/" className="text-white/30 transition-colors hover:text-white/60">
            ←
          </Link>
          <span className="text-sm font-semibold text-white/80">Claude CLI</span>
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
    <div className="flex h-screen bg-[#07090e] text-white">
      {/* ── 사이드바 ────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-white/[0.07]">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <Link href="/" className="text-white/30 transition-colors hover:text-white/60">
            ←
          </Link>
          <span className="text-sm font-semibold text-white/80">Claude CLI</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[connectionStatus]}`} />
            <span className="text-xs text-white/25">
              {STATUS_LABEL[connectionStatus] ?? ""}
            </span>
          </div>
        </div>

        {/* 워크 디렉토리 선택 + 새 세션 */}
        <div className="flex flex-col gap-2 p-3">
          <button
            type="button"
            onClick={() => dirPickerRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/[0.13] hover:bg-white/[0.05]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-white/30"
            >
              <path d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            {dirBasename ? (
              <span className="truncate font-mono text-xs text-orange-400">{dirBasename}</span>
            ) : (
              <span className="text-xs text-white/25">워크 디렉토리 선택</span>
            )}
          </button>

          <input
            ref={dirPickerRef}
            type="file"
            className="hidden"
            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setWorkingDir(file.webkitRelativePath.split("/")[0]);
              e.target.value = "";
            }}
          />

          <button
            onClick={() => createSession(workingDir || undefined)}
            disabled={connectionStatus !== "connected"}
            className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 새 세션
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-sm font-medium text-white/55 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/85"
            >
              ＋ 작업 추가
            </button>
            <button
              type="button"
              onClick={() => setTaskListOpen(true)}
              title="작업 목록"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/35 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/70"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 3.5A.75.75 0 012.75 7.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5A.75.75 0 012.75 11h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 11.75z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <TaskCreateModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
        <TaskListModal open={taskListOpen} onClose={() => setTaskListOpen(false)} />

        {/* 세션 목록 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/20">
              {connectionStatus === "connected" ? "세션이 없습니다" : "연결 중…"}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sessions.map((s) => {
                const lastMsg = s.messages[s.messages.length - 1];
                const isSelected = selectedSessionId === s.info.id;
                return (
                  <li key={s.info.id}>
                    <button
                      onClick={() => selectSession(s.info.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-white/[0.06] text-white/90"
                          : "text-white/40 hover:bg-white/[0.03] hover:text-white/70",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium">{s.info.title}</span>
                        {s.isWaiting && (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/20">
                        {new Date(s.info.createdAt).toLocaleString()}
                      </p>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-[11px] text-white/25">
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
      </aside>

      {/* ── 메인 채팅 영역 ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedSession ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.04] blur-[120px]" />
            </div>
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-orange-500/[0.08]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-orange-400/80">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div className="relative text-center">
              <p className="font-semibold text-white/75">Claude CLI</p>
              <p className="mt-1 text-sm text-white/30">
                {connectionStatus !== "connected"
                  ? "서버에 연결 중…"
                  : "왼쪽에서 세션을 선택하거나 새 세션을 생성하세요"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 채팅 헤더 */}
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/80">{selectedSession.info.title}</span>
                <span className="font-mono text-[10px] text-white/20">{selectedSession.info.id}</span>
              </div>
              <button
                onClick={() => terminateSession(selectedSession.info.id)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/45 transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/75"
              >
                종료
              </button>
            </header>

            {/* 에러 배너 */}
            {error && (
              <div className="shrink-0 border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* 메시지 목록 */}
            <main className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
                {!selectedSession.messagesLoaded && (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/25">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/[0.07] border-t-white/40" />
                    이전 대화를 불러오는 중…
                  </div>
                )}

                {selectedSession.messagesLoaded &&
                  selectedSession.messages.length === 0 &&
                  !selectedSession.isWaiting && (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                      <p className="text-sm text-white/25">
                        Claude가 준비되었습니다. 메시지를 보내보세요.
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
                  return <ChatMessage key={msg.id} message={msg} />;
                })}

                {selectedSession.isWaiting && (
                  <StreamingMessage content={selectedSession.streaming} />
                )}

                <div ref={bottomRef} />
              </div>
            </main>

            {/* 입력창 */}
            <footer className="shrink-0 border-t border-white/[0.07] px-4 py-4">
              <div className="mx-auto max-w-2xl">
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
