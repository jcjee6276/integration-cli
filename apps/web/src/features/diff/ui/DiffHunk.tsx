"use client";

export interface DiffLine {
  type: "context" | "added" | "removed" | "hunk";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

interface Props {
  lines: DiffLine[];
}

const LINE_STYLE: Record<DiffLine["type"], string> = {
  context: "text-gray-900/50 dark:text-white/40",
  added:   "bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400",
  removed: "bg-red-500/[0.08] text-red-700 dark:text-red-400",
  hunk:    "text-purple-500/70 dark:text-purple-400/70",
};

const LINE_NO_STYLE: Record<DiffLine["type"], string> = {
  context: "text-gray-900/15 dark:text-white/15",
  added:   "text-emerald-600/40 dark:text-emerald-400/40",
  removed: "text-red-600/40 dark:text-red-400/40",
  hunk:    "text-purple-500/30 dark:text-purple-400/30",
};

export function DiffHunk({ lines }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg bg-gray-950/[0.03] dark:bg-white/[0.03]">
      <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={LINE_STYLE[line.type]}>
              {line.type === "hunk" ? (
                <td colSpan={3} className="px-3 py-0.5 text-purple-500/70 dark:text-purple-400/70 select-none">
                  {line.content}
                </td>
              ) : (
                <>
                  <td className={`w-10 select-none px-2 py-0.5 text-right ${LINE_NO_STYLE[line.type]}`}>
                    {line.oldLineNo ?? ""}
                  </td>
                  <td className={`w-10 select-none px-2 py-0.5 text-right ${LINE_NO_STYLE[line.type]}`}>
                    {line.newLineNo ?? ""}
                  </td>
                  <td className="px-3 py-0.5 whitespace-pre">
                    <span className="mr-1 select-none opacity-50">
                      {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                    </span>
                    {line.content}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
