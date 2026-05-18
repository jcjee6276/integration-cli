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

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
};

export default function ClaudePage() {
  const { authState, loginState, loginOutput, loginUrls, startLogin, cancelLogin, checkAuth } =
    useClaudeAuth();

  // 로그인 완료 후 auth 재확인
  useEffect(() => {
    if (loginState === "done") {
      void checkAuth();
    }
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

  // 인증 확인 중 / 미인증 시 로그인 화면
  if (authState === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-orange-500" />
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <div className="flex h-screen flex-col bg-[#0d1117] text-white">
        <header className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
          <Link href="/" className="text-gray-500 transition-colors hover:text-gray-300">
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-100">Claude CLI</span>
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
    <div className="flex h-screen bg-[#0d1117] text-white">
      {/* ── 사이드바 ────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-800">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
          <Link href="/" className="text-gray-500 transition-colors hover:text-gray-300">
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-100">Claude CLI</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[connectionStatus]}`} />
            <span className="text-xs text-gray-500">
              {connectionStatus === "connected" ? "연결됨" : "연결 중…"}
            </span>
          </div>
        </div>

        {/* 워크 디렉토리 선택 + 새 세션 */}
        <div className="flex flex-col gap-2 p-3">
          <button
            type="button"
            onClick={() => dirPickerRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-gray-400"
            >
              <path d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            {dirBasename ? (
              <span className="truncate font-mono text-xs text-orange-400">{dirBasename}</span>
            ) : (
              <span className="text-xs text-gray-600">워크 디렉토리 선택</span>
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
              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-gray-100"
            >
              ＋ 작업 추가
            </button>
            <button
              type="button"
              onClick={() => setTaskListOpen(true)}
              title="작업 목록"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-gray-200"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 3.5A.75.75 0 012.75 7.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5A.75.75 0 012.75 11h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 11.75z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <TaskCreateModal
          open={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
        />
        <TaskListModal
          open={taskListOpen}
          onClose={() => setTaskListOpen(false)}
        />

        {/* 세션 목록 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-600">
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
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-gray-800 text-gray-100"
                          : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium">{s.info.title}</span>
                        {s.isWaiting && (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-600">
                        {new Date(s.info.createdAt).toLocaleString()}
                      </p>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
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
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-3xl">
              🤖
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-200">Claude CLI</p>
              <p className="mt-1 text-sm text-gray-500">
                {connectionStatus !== "connected"
                  ? "서버에 연결 중…"
                  : "왼쪽에서 세션을 선택하거나 새 세션을 생성하세요"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 채팅 헤더 */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-5 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">{selectedSession.info.title}</span>
                <span className="font-mono text-[10px] text-gray-600">{selectedSession.info.id}</span>
              </div>
              <button
                onClick={() => terminateSession(selectedSession.info.id)}
                className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-600"
              >
                종료
              </button>
            </header>

            {/* 에러 배너 */}
            {error && (
              <div className="shrink-0 border-b border-red-900 bg-red-950/60 px-5 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* 메시지 목록 */}
            <main className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
                {/* 대화 기록 로딩 중 */}
                {!selectedSession.messagesLoaded && (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
                    이전 대화를 불러오는 중…
                  </div>
                )}

                {/* 대화 없을 때 빈 상태 */}
                {selectedSession.messagesLoaded &&
                  selectedSession.messages.length === 0 &&
                  !selectedSession.isWaiting && (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                      <p className="text-sm text-gray-500">
                        Claude가 준비되었습니다. 메시지를 보내보세요.
                      </p>
                    </div>
                  )}

                {/* 메시지 렌더링 */}
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

                {/* 스트리밍 / 대기 */}
                {selectedSession.isWaiting && (
                  <StreamingMessage content={selectedSession.streaming} />
                )}

                <div ref={bottomRef} />
              </div>
            </main>

            {/* 입력창 */}
            <footer className="shrink-0 border-t border-gray-800 px-4 py-4">
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
