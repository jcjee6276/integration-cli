import rehypeHighlight from "rehype-highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isQuotaExceeded } from "@/lib/quota";
import type { ChatMessage as ChatMessageType, ToolUseBlock } from "../hooks/useClaudeSessions";
import { AGENT_AVATAR } from "./AgentSelectModal";
import type { AgentId } from "./AgentSelectModal";

// ─── Markdown ────────────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        p({ children }) { return <p className="mb-3 leading-7 last:mb-0">{children}</p>; },
        h1({ children }) { return <h1 className="mt-5 mb-3 text-xl font-bold first:mt-0">{children}</h1>; },
        h2({ children }) { return <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h2>; },
        h3({ children }) { return <h3 className="mt-3 mb-2 text-base font-semibold first:mt-0">{children}</h3>; },
        pre({ children }) {
          return (
            <pre className="my-3 overflow-x-auto rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.03] p-4 text-xs leading-relaxed dark:border-white/[0.06] dark:bg-white/[0.03]">
              {children}
            </pre>
          );
        },
        code({ children, className }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) return <code className={className}>{children}</code>;
          return (
            <code className="rounded bg-gray-900/[0.07] px-1.5 py-0.5 font-mono text-xs text-orange-600 dark:bg-white/[0.07] dark:text-orange-300">
              {children}
            </code>
          );
        },
        ul({ children }) { return <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>; },
        ol({ children }) { return <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>; },
        li({ children }) { return <li className="leading-7">{children}</li>; },
        blockquote({ children }) {
          return (
            <blockquote className="my-3 border-l-2 border-gray-900/[0.15] pl-4 text-gray-900/45 italic dark:border-white/[0.15] dark:text-white/45">
              {children}
            </blockquote>
          );
        },
        hr() { return <hr className="my-4 border-gray-900/[0.08] dark:border-white/[0.08]" />; },
        table({ children }) {
          return <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>;
        },
        th({ children }) {
          return (
            <th className="border border-gray-900/[0.08] bg-gray-900/[0.04] px-3 py-2 text-left font-semibold dark:border-white/[0.08] dark:bg-white/[0.04]">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-gray-900/[0.07] px-3 py-2 dark:border-white/[0.07]">
              {children}
            </td>
          );
        },
        strong({ children }) {
          return (
            <strong className="font-semibold text-gray-900/90 dark:text-white/90">
              {children}
            </strong>
          );
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── ToolUseCard ─────────────────────────────────────────────────────────────

function ToolUseCard({ toolUse }: { toolUse: ToolUseBlock }) {
  const primaryInput = Object.values(toolUse.input)[0];
  const preview = typeof primaryInput === "string" ? primaryInput : JSON.stringify(toolUse.input);
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-gray-900/[0.07] text-xs dark:border-white/[0.07]">
      <div className="flex items-center gap-1.5 border-b border-gray-900/[0.07] bg-gray-900/[0.03] px-3 py-1.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <span className="text-gray-900/30 dark:text-white/30">⚙</span>
        <span className="font-mono font-medium text-gray-900/55 dark:text-white/55">{toolUse.tool}</span>
      </div>
      <pre className="overflow-x-auto bg-gray-900/[0.02] px-3 py-2 font-mono text-emerald-700 dark:bg-white/[0.02] dark:text-emerald-400/80 whitespace-pre-wrap break-all">
        {preview}
      </pre>
    </div>
  );
}

// ─── QuotaBadge ──────────────────────────────────────────────────────────────

function QuotaBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
        <path fillRule="evenodd" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd" />
      </svg>
      한도 초과
    </span>
  );
}

// ─── AgentAvatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ agentId }: { agentId?: AgentId }) {
  const cfg = agentId ? AGENT_AVATAR[agentId] : AGENT_AVATAR.claude;
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden ${cfg.bg}`}>
      {cfg.icon}
    </div>
  );
}

// ─── ChatMessage ─────────────────────────────────────────────────────────────

export function ChatMessage({ message, agentId }: { message: ChatMessageType; agentId?: AgentId }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end gap-3">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600/90 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/80 text-xs font-bold text-white">U</div>
      </div>
    );
  }

  const quota = isQuotaExceeded(message.content);

  return (
    <div className="flex w-full justify-start gap-3">
      <AgentAvatar agentId={agentId} />
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-gray-900/[0.06] bg-gray-900/[0.04] px-4 py-3 text-sm text-gray-900/80 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/80">
        {message.toolUses?.map((t, i) => <ToolUseCard key={i} toolUse={t} />)}
        {message.content && <MarkdownContent content={message.content} />}
        {quota && <div className="mt-2"><QuotaBadge /></div>}
        {!quota && message.meta && (
          <p className="mt-2 text-right text-xs text-gray-900/20 dark:text-white/20">
            {(message.meta.durationMs / 1000).toFixed(1)}s · ${message.meta.costUsd.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── StreamingMessage ────────────────────────────────────────────────────────

export function StreamingMessage({ content, agentId }: { content: string; agentId?: AgentId }) {
  const quota = isQuotaExceeded(content);

  return (
    <div className="flex w-full justify-start gap-3">
      <AgentAvatar agentId={agentId} />
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-gray-900/[0.06] bg-gray-900/[0.04] px-4 py-3 text-sm text-gray-900/80 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/80">
        {content ? (
          <>
            <MarkdownContent content={content} />
            {quota && <div className="mt-2"><QuotaBadge /></div>}
          </>
        ) : (
          <span className="flex gap-1 py-1">
            <span className="animate-bounce text-gray-900/40 dark:text-white/40">●</span>
            <span className="animate-bounce text-gray-900/40 [animation-delay:0.15s] dark:text-white/40">●</span>
            <span className="animate-bounce text-gray-900/40 [animation-delay:0.3s] dark:text-white/40">●</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SystemMessage ───────────────────────────────────────────────────────────

export function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[90%] overflow-hidden rounded-xl border border-gray-900/[0.07] bg-gray-900/[0.02] text-xs dark:border-white/[0.07] dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 border-b border-gray-900/[0.07] px-3 py-1.5 dark:border-white/[0.07]">
          <span className="text-gray-900/25 dark:text-white/25">⚡</span>
          <span className="font-mono font-medium text-gray-900/35 dark:text-white/35">system</span>
        </div>
        <div className="px-4 py-3 font-mono text-gray-900/55 dark:text-white/55 whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
