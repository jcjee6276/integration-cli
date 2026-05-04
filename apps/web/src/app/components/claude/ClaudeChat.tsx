'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useClaudeChat } from '@/hooks/useClaudeChat';
import { PermissionCard } from '@/components/claude/PermissionCard';
import { ParsedMessage } from '@/lib/parseClaudeOutput';
import type { PermissionPrompt } from '@/lib/ansi';
import { ChatMessage } from './ChatMessage';

// ─── Status indicator ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  idle: 'Ready',
  thinking: 'Thinking…',
  responding: 'Responding…',
};

const STATUS_DOT: Record<string, string> = {
  disconnected: 'bg-red-400',
  connecting: 'bg-yellow-400 animate-pulse',
  idle: 'bg-green-400',
  thinking: 'bg-amber-400 animate-pulse',
  responding: 'bg-blue-400 animate-pulse',
};

function StatusBar({ status, sessionId }: { status: string; sessionId: string | null }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? 'bg-zinc-400'}`} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{STATUS_LABEL[status] ?? status}</span>
      {sessionId && (
        <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
          {sessionId.slice(0, 8)}
        </span>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#da7756]">
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-zinc-800 dark:text-zinc-100">How can I help you today?</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Start a new session to chat with Claude.
        </p>
      </div>
      <button
        onClick={onStart}
        disabled={disabled}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        New session
      </button>
    </div>
  );
}

// ─── Thinking indicator ──────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#da7756]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-600"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Input area ──────────────────────────────────────────────────────────────

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder?: string;
}

function InputArea({ onSend, disabled, placeholder = 'Message Claude…' }: InputAreaProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 shadow-sm transition-colors focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send"
          className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
            <path d="M8 1l7 7-7 7V9H1V7h7z" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
        Shift+Enter for new line · Enter to send
      </p>
    </form>
  );
}

// ─── ClaudeChat ──────────────────────────────────────────────────────────────

export function ClaudeChat() {
  const { connectionStatus, session, messages: rawMessages, streaming, isWaiting, start, send } =
    useClaudeChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Map useClaudeChat messages → ParsedMessage for ChatMessage component
  const messages: ParsedMessage[] = [
    ...rawMessages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    ...(isWaiting && streaming
      ? [{ id: 'streaming', role: 'assistant' as const, content: streaming, isStreaming: true }]
      : []),
  ];

  // Derive display status
  const status =
    connectionStatus !== 'connected'
      ? connectionStatus
      : !session
        ? 'idle'
        : isWaiting
          ? streaming
            ? 'responding'
            : 'thinking'
          : 'idle';

  const isThinkingOnly = isWaiting && !streaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinkingOnly]);

  const inputDisabled = connectionStatus !== 'connected' || !session || isWaiting;
  const inputPlaceholder = !session
    ? '세션을 시작하세요'
    : isWaiting
      ? '응답을 기다리는 중…'
      : 'Message Claude…';

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      <StatusBar status={status} sessionId={session?.id ?? null} />

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onStart={start} disabled={connectionStatus !== 'connected'} />
        ) : (
          <div className="mx-auto max-w-2xl py-4">
            {messages.map((msg) => {
              if (msg.role === 'permission') {
                const prompt = JSON.parse(msg.content) as PermissionPrompt;
                return (
                  <PermissionCard
                    key={msg.id}
                    tool={prompt.tool}
                    command={prompt.command}
                    warning={prompt.warning}
                    onAllow={() => send('1')}
                    onDeny={() => send('2')}
                  />
                );
              }
              return <ChatMessage key={msg.id} message={msg} />;
            })}
            {isThinkingOnly && <ThinkingDots />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {session && (
        <InputArea onSend={send} disabled={inputDisabled} placeholder={inputPlaceholder} />
      )}
    </div>
  );
}
