import rehypeHighlight from "rehype-highlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessage as ChatMessageType } from "@/hooks/useClaudeChat";

// ─── Markdown 렌더러 ────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // 단락
        p({ children }) {
          return <p className="mb-3 leading-7 last:mb-0">{children}</p>;
        },
        // 헤더
        h1({ children }) {
          return <h1 className="mt-5 mb-3 text-xl font-bold first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mt-3 mb-2 text-base font-semibold first:mt-0">{children}</h3>;
        },
        // 코드블록
        pre({ children }) {
          return (
            <pre className="my-3 overflow-x-auto rounded-lg bg-[#0d1117] p-4 text-xs leading-relaxed">
              {children}
            </pre>
          );
        },
        // 인라인 코드
        code({ children, className }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code className="rounded bg-gray-700/60 px-1.5 py-0.5 font-mono text-xs text-orange-300">
              {children}
            </code>
          );
        },
        // 리스트
        ul({ children }) {
          return <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-7">{children}</li>;
        },
        // 인용
        blockquote({ children }) {
          return (
            <blockquote className="my-3 border-l-2 border-gray-500 pl-4 text-gray-400 italic">
              {children}
            </blockquote>
          );
        },
        // 구분선
        hr() {
          return <hr className="my-4 border-gray-700" />;
        },
        // 표
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-gray-700 bg-gray-800 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="border border-gray-700 px-3 py-2">{children}</td>;
        },
        // 강조
        strong({ children }) {
          return <strong className="font-semibold text-white">{children}</strong>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
            >
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

// ─── 말풍선 ─────────────────────────────────────────────────────────────────

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end gap-3">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          U
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
        C
      </div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3 text-sm text-gray-100">
        <MarkdownContent content={message.content} />
      </div>
    </div>
  );
}

// ─── 스트리밍 중 말풍선 ──────────────────────────────────────────────────────

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
        C
      </div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3 text-sm text-gray-100">
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <span className="flex gap-1 py-1">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce [animation-delay:0.15s]">●</span>
            <span className="animate-bounce [animation-delay:0.3s]">●</span>
          </span>
        )}
      </div>
    </div>
  );
}
