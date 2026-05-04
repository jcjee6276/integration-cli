"use client";

import { useCallback, useRef, useState } from "react";

import { cleanCliOutput, detectPermissionPrompt } from "@/lib/ansi";

import { useClaudeSession } from "./useClaudeSession";

export type MessageRole = "user" | "assistant" | "permission";

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
          // 1단계: ANSI + CLI 노이즈 제거
          let text = cleanCliOutput(raw);

          // 2단계: PTY echo 필터링 (전송한 텍스트가 그대로 돌아오는 것)
          if (!echoFilteredRef.current && lastSentRef.current) {
            const echo = lastSentRef.current;
            const idx = text.indexOf(echo);
            if (idx !== -1) {
              text = text.slice(idx + echo.length);
              echoFilteredRef.current = true;
            } else if (echo.startsWith(text.trimEnd())) {
              echoFilteredRef.current = true;
              return;
            }
          }

          if (!text.trim()) return;

          // 3단계: 권한 요청 프롬프트 감지
          const permission = detectPermissionPrompt(streamingRef.current + text);
          if (permission) {
            flushStreaming();
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "permission",
                content: JSON.stringify(permission),
                createdAt: new Date(),
              },
            ]);
            setIsWaiting(false);
            return;
          }

          streamingRef.current += text;
          setStreaming(streamingRef.current);
          scheduleFlush();
        },
        [scheduleFlush, flushStreaming],
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
