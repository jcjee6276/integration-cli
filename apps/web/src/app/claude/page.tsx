"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/claude/ChatInput";
import { ChatMessage, StreamingMessage } from "@/components/claude/ChatMessage";
import { useClaudeChat } from "@/hooks/useClaudeChat";

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
};

export default function ClaudePage() {
  const { connectionStatus, session, error, messages, streaming, isWaiting, start, send, stop } =
    useClaudeChat();

  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 쌓일 때마다 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-screen flex-col bg-[#0d1117] text-white">
      {/* 헤더 */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 transition-colors hover:text-gray-300">
            ←
          </Link>
          <span className="font-semibold text-gray-100">Claude CLI</span>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[connectionStatus]}`} />
            <span className="text-xs text-gray-500">
              {connectionStatus === "connected" ? "서버 연결됨" : "연결 중…"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!session ? (
            <button
              onClick={start}
              disabled={connectionStatus !== "connected"}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              시작
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-600"
            >
              종료
            </button>
          )}
        </div>
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
          {isEmpty && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-2xl">
                🤖
              </div>
              <p className="text-sm text-gray-500">
                {session
                  ? "Claude가 준비되었습니다. 메시지를 보내보세요."
                  : "상단 시작 버튼을 눌러 Claude CLI를 실행하세요."}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* 스트리밍 중인 응답 */}
          {isWaiting && <StreamingMessage content={streaming} />}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* 입력창 */}
      <footer className="shrink-0 border-t border-gray-800 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            onSend={send}
            disabled={!session || isWaiting}
            placeholder={
              !session
                ? "시작 버튼을 눌러 세션을 시작하세요"
                : isWaiting
                  ? "응답을 기다리는 중…"
                  : "메시지 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
            }
          />
        </div>
      </footer>
    </div>
  );
}
