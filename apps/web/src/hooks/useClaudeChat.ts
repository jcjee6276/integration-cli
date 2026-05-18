"use client";

import { useCallback, useRef, useState } from "react";

import type { ResultMeta, ToolUse } from "./useClaudeSession";
import { useClaudeSession } from "./useClaudeSession";

export type MessageRole = "user" | "assistant" | "permission" | "system";

export interface ToolUseBlock {
  tool: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolUses?: ToolUseBlock[];
  meta?: ResultMeta;
  createdAt: Date;
}

let msgId = 0;
const nextId = () => String(++msgId);

export function useClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  // 현재 스트리밍 중인 텍스트 ref (클로저 stale 방지)
  const streamingRef = useRef("");
  // 현재 응답에서 발생한 tool-use 목록
  const pendingToolsRef = useRef<ToolUseBlock[]>([]);

  // ─── 내부 유틸 ───────────────────────────────────────────────────────

  const resetStreaming = useCallback(() => {
    streamingRef.current = "";
    pendingToolsRef.current = [];
    setStreaming("");
    setIsWaiting(false);
  }, []);

  // ─── 세션 연결 ───────────────────────────────────────────────────────

  const { connectionStatus, session, error, createSession, sendMessage, terminateSession } =
    useClaudeSession({
      // 텍스트 델타 — 그대로 누적 (ANSI 없음)
      onText: useCallback((text: string) => {
        streamingRef.current += text;
        setStreaming(streamingRef.current);
      }, []),

      // 도구 사용 — 목록에 추가
      onTool: useCallback((toolUse: ToolUse) => {
        pendingToolsRef.current.push(toolUse);
      }, []),

      // 응답 완료 — 메시지 확정
      onResult: useCallback(
        (meta: ResultMeta) => {
          const content = streamingRef.current.trim();
          if (content || pendingToolsRef.current.length > 0) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                content,
                toolUses: pendingToolsRef.current.length > 0 ? [...pendingToolsRef.current] : undefined,
                meta,
                createdAt: new Date(),
              },
            ]);
          }
          resetStreaming();
        },
        [resetStreaming],
      ),

      onExit: useCallback(() => {
        resetStreaming();
      }, [resetStreaming]),
    });

  // ─── 공개 API ────────────────────────────────────────────────────────

  const start = useCallback(() => {
    setMessages([]);
    resetStreaming();
    createSession();
  }, [createSession, resetStreaming]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session) return;

      // 혹시 이전 스트리밍이 남아있으면 버림 (result 없이 보내는 경우 방어)
      resetStreaming();

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed, createdAt: new Date() },
      ]);
      setIsWaiting(true);
      sendMessage(trimmed);
    },
    [session, sendMessage, resetStreaming],
  );

  const stop = useCallback(() => {
    resetStreaming();
    terminateSession();
  }, [resetStreaming, terminateSession]);

  return { connectionStatus, session, error, messages, streaming, isWaiting, start, send, stop };
}
