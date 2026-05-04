"use client";

import { useCallback, useRef, useState } from "react";

import { stripAnsi } from "@/lib/ansi";

import { useClaudeSession } from "./useClaudeSession";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

let msgId = 0;
const nextId = () => String(++msgId);

// PTY 출력이 이 시간(ms) 동안 없으면 응답 완료로 판단
const RESPONSE_DEBOUNCE_MS = 1500;

export function useClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const streamingRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 직전에 전송한 텍스트 — PTY 에코 필터링에 사용
  const lastSentRef = useRef("");
  // 현재 메시지의 에코를 이미 걸러냈는지 여부
  const echoFilteredRef = useRef(false);

  // ─── 내부 유틸 ───────────────────────────────────────────────────────

  const clearDebounce = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const flushStreaming = useCallback(() => {
    clearDebounce();
    const content = streamingRef.current.trim();
    if (content) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content, createdAt: new Date() },
      ]);
    }
    streamingRef.current = "";
    setStreaming("");
    setIsWaiting(false);
    echoFilteredRef.current = false;
  }, []);

  const scheduleFlush = useCallback(() => {
    clearDebounce();
    debounceRef.current = setTimeout(flushStreaming, RESPONSE_DEBOUNCE_MS);
  }, [flushStreaming]);

  // ─── 세션 연결 ───────────────────────────────────────────────────────

  const { connectionStatus, session, error, createSession, sendInput, terminateSession } =
    useClaudeSession({
      onOutput: useCallback(
        (raw: string) => {
          let text = stripAnsi(raw);
          if (!text) return;

          // PTY는 전송한 텍스트를 그대로 echo로 돌려줌 — 첫 청크에서 걸러냄
          if (!echoFilteredRef.current && lastSentRef.current) {
            const echo = lastSentRef.current;
            // echo가 그대로 포함된 경우 해당 부분 제거
            const idx = text.indexOf(echo);
            if (idx !== -1) {
              text = text.slice(idx + echo.length);
              echoFilteredRef.current = true;
            } else if (echo.startsWith(text.trimEnd())) {
              // 부분 echo (청크가 나뉘어 온 경우) — 통째로 skip
              echoFilteredRef.current = true;
              return;
            }
          }

          if (!text.trim()) return;

          streamingRef.current += text;
          setStreaming(streamingRef.current);

          // 출력이 잠잠해지면 응답 완료 처리
          scheduleFlush();
        },
        [scheduleFlush],
      ),

      onExit: useCallback(
        (exitCode: number) => {
          flushStreaming();
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: `세션이 종료되었습니다 (exit ${exitCode})`,
              createdAt: new Date(),
            },
          ]);
        },
        [flushStreaming],
      ),
    });

  // ─── 공개 API ────────────────────────────────────────────────────────

  const start = useCallback(() => {
    setMessages([]);
    streamingRef.current = "";
    setStreaming("");
    setIsWaiting(false);
    lastSentRef.current = "";
    echoFilteredRef.current = false;
    createSession();
  }, [createSession]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session) return;

      // 이전 응답이 아직 스트리밍 중이면 즉시 확정
      flushStreaming();

      lastSentRef.current = trimmed;
      echoFilteredRef.current = false;

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed, createdAt: new Date() },
      ]);
      setIsWaiting(true);

      sendInput(`${trimmed}\r`);
    },
    [session, flushStreaming, sendInput],
  );

  const stop = useCallback(() => {
    flushStreaming();
    terminateSession();
  }, [flushStreaming, terminateSession]);

  return { connectionStatus, session, error, messages, streaming, isWaiting, start, send, stop };
}
