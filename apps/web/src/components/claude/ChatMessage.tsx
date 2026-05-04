import type { ChatMessage as ChatMessageType } from "@/hooks/useClaudeChat";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
          C
        </div>
      )}

      <div
        className={[
          "break-word max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "rounded-tr-sm bg-blue-600 text-white"
            : "rounded-tl-sm bg-gray-800 text-gray-100",
        ].join(" ")}
      >
        {message.content}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          U
        </div>
      )}
    </div>
  );
}

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
        C
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-gray-100">
        {content || (
          <span className="flex gap-1">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce [animation-delay:0.15s]">●</span>
            <span className="animate-bounce [animation-delay:0.3s]">●</span>
          </span>
        )}
      </div>
    </div>
  );
}
