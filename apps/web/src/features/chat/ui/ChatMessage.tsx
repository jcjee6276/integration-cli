import rehypeHighlight from "rehype-highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessage as ChatMessageType, ToolUseBlock } from "../hooks/useClaudeSessions";

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
          return <pre className="my-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 text-xs leading-relaxed">{children}</pre>;
        },
        code({ children, className }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) return <code className={className}>{children}</code>;
          return <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-orange-300">{children}</code>;
        },
        ul({ children }) { return <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>; },
        ol({ children }) { return <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>; },
        li({ children }) { return <li className="leading-7">{children}</li>; },
        blockquote({ children }) {
          return <blockquote className="my-3 border-l-2 border-white/[0.15] pl-4 text-white/45 italic">{children}</blockquote>;
        },
        hr() { return <hr className="my-4 border-white/[0.08]" />; },
        table({ children }) {
          return <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>;
        },
        th({ children }) {
          return <th className="border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-left font-semibold">{children}</th>;
        },
        td({ children }) { return <td className="border border-white/[0.07] px-3 py-2">{children}</td>; },
        strong({ children }) { return <strong className="font-semibold text-white/90">{children}</strong>; },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">{children}</a>;
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
    <div className="mb-2 overflow-hidden rounded-lg border border-white/[0.07] text-xs">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
        <span className="text-white/30">⚙</span>
        <span className="font-mono font-medium text-white/55">{toolUse.tool}</span>
      </div>
      <pre className="overflow-x-auto bg-white/[0.02] px-3 py-2 font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{preview}</pre>
    </div>
  );
}

// ─── ChatMessage ─────────────────────────────────────────────────────────────

export function ChatMessage({ message }: { message: ChatMessageType }) {
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

  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/80 text-xs font-bold text-white">C</div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm text-white/80">
        {message.toolUses?.map((t, i) => <ToolUseCard key={i} toolUse={t} />)}
        {message.content && <MarkdownContent content={message.content} />}
        {message.meta && (
          <p className="mt-2 text-right text-xs text-white/20">
            {(message.meta.durationMs / 1000).toFixed(1)}s · ${message.meta.costUsd.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── StreamingMessage ────────────────────────────────────────────────────────

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/80 text-xs font-bold text-white">C</div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm text-white/80">
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <span className="flex gap-1 py-1">
            <span className="animate-bounce text-white/40">●</span>
            <span className="animate-bounce text-white/40 [animation-delay:0.15s]">●</span>
            <span className="animate-bounce text-white/40 [animation-delay:0.3s]">●</span>
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
      <div className="w-full max-w-[90%] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] text-xs">
        <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-3 py-1.5">
          <span className="text-white/25">⚡</span>
          <span className="font-mono font-medium text-white/35">system</span>
        </div>
        <div className="px-4 py-3 font-mono text-white/55 whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
