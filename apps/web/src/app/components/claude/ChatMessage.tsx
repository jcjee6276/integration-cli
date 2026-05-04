'use client';

import { ParsedMessage, ToolUseBlock, extractToolBlocks } from '@/lib/parseClaudeOutput';

// ─── Markdown-lite renderer ──────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Bold (**text**), inline code (`code`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={i} className="my-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          {lang && (
            <div className="border-b border-zinc-200 bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {lang}
            </div>
          )}
          <pre className="bg-zinc-50 p-4 font-mono text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      i++; // skip closing ```
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const className =
        level === 1
          ? 'text-lg font-semibold text-zinc-900 dark:text-zinc-50 mt-3 mb-1'
          : level === 2
            ? 'text-base font-semibold text-zinc-900 dark:text-zinc-50 mt-2 mb-1'
            : 'text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-2 mb-0.5';
      nodes.push(
        <p key={i} className={className}>
          {renderInline(headingText)}
        </p>,
      );
      i++;
      continue;
    }

    // Bullet list item
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-1 ml-4 list-disc space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-zinc-700 dark:text-zinc-300">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="leading-relaxed text-zinc-700 dark:text-zinc-300">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <>{nodes}</>;
}

// ─── Tool use block ──────────────────────────────────────────────────────────

function ToolBlock({ block }: { block: ToolUseBlock }) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-200 text-sm dark:border-zinc-700">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
        <ToolIcon />
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{block.tool}</span>
      </div>
      {block.input && (
        <pre className="bg-zinc-950 p-3 font-mono text-xs text-green-400 dark:bg-zinc-950">
          <code>{block.input}</code>
        </pre>
      )}
    </div>
  );
}

function ToolIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-zinc-500"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 8h2M12 8h2M8 2v2M8 12v2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

// ─── Streaming cursor ────────────────────────────────────────────────────────

function Cursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
  );
}

// ─── Avatar icons ────────────────────────────────────────────────────────────

function ClaudeAvatar() {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#da7756]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-zinc-500 dark:fill-zinc-300">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

// ─── ChatMessage ─────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ParsedMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="flex max-w-[80%] items-end gap-2">
          <div className="rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            {message.content}
          </div>
          <UserAvatar />
        </div>
      </div>
    );
  }

  // Assistant message — parse tool blocks out of content
  const toolBlocks = extractToolBlocks(message.content);

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <ClaudeAvatar />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Claude</div>
        <div className="space-y-1 text-sm">
          {toolBlocks.map((block, i) => (
            <ToolBlock key={i} block={block} />
          ))}
          {renderContent(message.content)}
          {message.isStreaming && <Cursor />}
        </div>
      </div>
    </div>
  );
}
