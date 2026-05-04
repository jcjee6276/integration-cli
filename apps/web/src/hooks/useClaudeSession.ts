'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { cleanPtyOutput, isThinking, ParsedMessage } from '@/lib/parseClaudeOutput';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
const NAMESPACE = '/agents/claude';

export type SessionStatus = 'disconnected' | 'connecting' | 'idle' | 'thinking' | 'responding';

interface UseClaudeSessionReturn {
  messages: ParsedMessage[];
  status: SessionStatus;
  sessionId: string | null;
  sendMessage: (text: string) => void;
  createSession: () => void;
}

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}`;

export function useClaudeSession(): UseClaudeSessionReturn {
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingUserMsgRef = useRef<string>('');

  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Accumulate streaming response chunks in a ref to avoid stale closures
  const streamBufRef = useRef<string>('');
  const streamMsgIdRef = useRef<string | null>(null);

  const appendOrUpdateAssistant = useCallback((chunk: string) => {
    const cleaned = cleanPtyOutput(chunk);
    if (!cleaned) return;

    streamBufRef.current += (streamBufRef.current ? '\n' : '') + cleaned;

    setMessages((prev) => {
      if (streamMsgIdRef.current) {
        return prev.map((m) =>
          m.id === streamMsgIdRef.current
            ? { ...m, content: streamBufRef.current, isStreaming: true }
            : m,
        );
      }
      const id = nextId();
      streamMsgIdRef.current = id;
      return [
        ...prev,
        { id, role: 'assistant', content: streamBufRef.current, isStreaming: true },
      ];
    });
  }, []);

  const finaliseAssistant = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamMsgIdRef.current ? { ...m, isStreaming: false } : m,
      ),
    );
    streamBufRef.current = '';
    streamMsgIdRef.current = null;
  }, []);

  // Connect socket once on mount
  useEffect(() => {
    const socket = io(`${WS_URL}${NAMESPACE}`, { transports: ['websocket'] });
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('idle');
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
      sessionIdRef.current = null;
      setSessionId(null);
    });

    socket.on('session:created', (info: { id: string }) => {
      sessionIdRef.current = info.id;
      setSessionId(info.id);
      socket.emit('session:subscribe', { sessionId: info.id });
      setStatus('idle');
    });

    socket.on('session:output', (event: { sessionId: string; data: string }) => {
      if (event.sessionId !== sessionIdRef.current) return;

      const thinking = isThinking(event.data);

      if (thinking) {
        setStatus('thinking');
      } else {
        setStatus('responding');
        appendOrUpdateAssistant(event.data);
      }
    });

    socket.on('session:exit', () => {
      finaliseAssistant();
      setStatus('idle');
    });

    return () => {
      socket.disconnect();
    };
  }, [appendOrUpdateAssistant, finaliseAssistant]);

  // Watch for the prompt returning (idle after responding) by checking
  // for a gap in output — simple heuristic: after responding, finalise
  // once the stream quiets for 800 ms.
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'responding') {
      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
      quietTimerRef.current = setTimeout(() => {
        finaliseAssistant();
        setStatus('idle');
      }, 800);
    }
    return () => {
      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    };
  }, [status, messages, finaliseAssistant]);

  const createSession = useCallback(() => {
    socketRef.current?.emit('session:create', {});
  }, []);

  const sendMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    const sid = sessionIdRef.current;
    if (!socket || !sid || !text.trim()) return;

    // Add user message immediately (optimistic)
    const userMsg: ParsedMessage = { id: nextId(), role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    pendingUserMsgRef.current = text;

    // Reset assistant stream for this turn
    streamBufRef.current = '';
    streamMsgIdRef.current = null;

    socket.emit('session:input', { sessionId: sid, input: `${text}\r` });
    setStatus('thinking');
  }, []);

  return { messages, status, sessionId, sendMessage, createSession };
}
