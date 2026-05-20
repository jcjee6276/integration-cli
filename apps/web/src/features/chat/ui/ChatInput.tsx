"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

// ─── 슬래시 커맨드 목록 ──────────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { command: "/status",        description: "계정 및 시스템 상태" },
  { command: "/help",          description: "도움말 표시" },
  { command: "/clear",         description: "대화 내역 지우기" },
  { command: "/compact",       description: "대화 요약 후 압축" },
  { command: "/config",        description: "설정 보기 / 편집" },
  { command: "/cost",          description: "현재 세션 비용 표시" },
  { command: "/doctor",        description: "Claude 환경 진단" },
  { command: "/exit",          description: "세션 종료" },
  { command: "/memory",        description: "메모리 파일 관리" },
  { command: "/model",         description: "모델 변경" },
  { command: "/permissions",   description: "도구 권한 관리" },
  { command: "/pr_comments",   description: "PR 코멘트 가져오기" },
  { command: "/release-notes", description: "릴리즈 노트 표시" },
  { command: "/review",        description: "코드 리뷰" },
  { command: "/terminal-setup",description: "터미널 키 바인딩 설정" },
  { command: "/vim",           description: "Vim 모드 전환" },
] as const;

// ─── SlashMenu ───────────────────────────────────────────────────────────────

interface SlashMenuProps {
  query: string;
  activeIndex: number;
  onSelect: (command: string) => void;
}

function SlashMenu({ query, activeIndex, onSelect }: SlashMenuProps) {
  const filtered = SLASH_COMMANDS.filter((c) =>
    c.command.toLowerCase().startsWith("/" + query.toLowerCase()),
  );
  if (filtered.length === 0) return null;

  return (
    <ul className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
      {filtered.map((item, i) => (
        <li key={item.command}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(item.command); }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              i === activeIndex ? "bg-gray-700 text-gray-100" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <span className="font-mono text-orange-400">{item.command}</span>
            <span className="text-xs text-gray-500">{item.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── ChatInput ───────────────────────────────────────────────────────────────

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = "메시지 입력…" }: Props) {
  const [value, setValue] = useState("");
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredCount =
    slashQuery !== null
      ? SLASH_COMMANDS.filter((c) =>
          c.command.toLowerCase().startsWith("/" + slashQuery.toLowerCase()),
        ).length
      : 0;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setSlashQuery(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleChange = (raw: string) => {
    setValue(raw);
    const match = raw.match(/^\/(\S*)$/);
    if (match) { setSlashQuery(match[1]); setActiveIndex(0); }
    else setSlashQuery(null);
  };

  const selectCommand = (command: string) => {
    setValue(command + " ");
    setSlashQuery(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null && filteredCount > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % filteredCount); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex((i) => (i - 1 + filteredCount) % filteredCount); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const filtered = SLASH_COMMANDS.filter((c) =>
          c.command.toLowerCase().startsWith("/" + slashQuery.toLowerCase()),
        );
        if (filtered[activeIndex]) selectCommand(filtered[activeIndex].command);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setSlashQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(() => { if (value === "") setSlashQuery(null); }, [value]);

  return (
    <div className="relative">
      {slashQuery !== null && (
        <SlashMenu query={slashQuery} activeIndex={activeIndex} onSelect={selectCommand} />
      )}
      <div className="flex items-end gap-3 rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 focus-within:border-gray-500">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none disabled:cursor-not-allowed"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="전송"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 rotate-90 text-white">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
