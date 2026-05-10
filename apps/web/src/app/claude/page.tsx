"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/claude/ChatInput";
import { ChatMessage, StreamingMessage } from "@/components/claude/ChatMessage";
import { PermissionCard } from "@/components/claude/PermissionCard";
import { useClaudeSessions } from "@/hooks/useClaudeSessions";
import type { PermissionPrompt } from "@/lib/ansi";

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
};

export default function ClaudePage() {
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
  } = useClaudeSessions();

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedSession?.messages, selectedSession?.streaming]);

  const handleSend = (text: string) => {
    if (!selectedSessionId || !text.trim()) return;
    sendMessage(selectedSessionId, text);
  };

  const inputDisabled =
    !selectedSession || selectedSession.isWaiting || connectionStatus !== "connected";

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

        {/* 새 세션 버튼 */}
        <div className="p-3">
          <button
            onClick={createSession}
            disabled={connectionStatus !== "connected"}
            className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 새 세션
          </button>
        </div>

        {/* 세션 목록 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-600">세션이 없습니다</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sessions.map((s) => {
                const lastMsg = s.messages[s.messages.length - 1];
                return (
                  <li key={s.info.id}>
                    <button
                      onClick={() => selectSession(s.info.id)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                        selectedSessionId === s.info.id
                          ? "bg-gray-800 text-gray-100"
                          : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{s.info.id.slice(0, 8)}</span>
                        {s.isWaiting && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-600">
                        {new Date(s.info.createdAt).toLocaleTimeString()}
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
          /* 빈 상태 */
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-3xl">
              🤖
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-200">Claude CLI</p>
              <p className="mt-1 text-sm text-gray-500">
                {connectionStatus !== "connected"
                  ? "서버에 연결 중…"
                  : "왼쪽에서 새 세션을 생성하세요"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 채팅 헤더 */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-5 py-3">
              <span className="font-mono text-xs text-gray-400">{selectedSession.info.id}</span>
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
                {selectedSession.messages.length === 0 && !selectedSession.isWaiting && (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <p className="text-sm text-gray-500">
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
                  return <ChatMessage key={msg.id} message={msg} />;
                })}

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
