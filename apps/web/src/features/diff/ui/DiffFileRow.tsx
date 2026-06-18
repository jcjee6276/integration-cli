"use client";

import { useState } from "react";

import type { DiffLine } from "./DiffHunk";
import { DiffHunk } from "./DiffHunk";
import type { ChangeType } from "./FileChangeBadge";
import { FileChangeBadge } from "./FileChangeBadge";

export interface DiffFile {
  filePath: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

interface Props {
  file: DiffFile;
  defaultOpen?: boolean;
}

export function DiffFileRow({ file, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const fileName = file.filePath.split("/").pop() ?? file.filePath;
  const dirName = file.filePath.includes("/")
    ? file.filePath.slice(0, file.filePath.lastIndexOf("/"))
    : "";

  return (
    <div className="overflow-hidden rounded-lg border border-gray-900/[0.07] dark:border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-gray-900/[0.02] dark:hover:bg-white/[0.02]"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3 w-3 shrink-0 text-gray-900/20 transition-transform dark:text-white/20 ${open ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>

        <FileChangeBadge type={file.changeType} />

        <span className="min-w-0 flex-1 truncate text-[12px]">
          {dirName && <span className="text-gray-900/30 dark:text-white/30">{dirName}/</span>}
          <span className="font-medium text-gray-900/70 dark:text-white/70">{fileName}</span>
        </span>

        <span className="shrink-0 text-[10px] font-mono">
          {file.additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
          )}
          {file.additions > 0 && file.deletions > 0 && (
            <span className="mx-0.5 text-gray-900/15 dark:text-white/15">/</span>
          )}
          {file.deletions > 0 && (
            <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
          )}
        </span>
      </button>

      {open && file.lines.length > 0 && (
        <div className="border-t border-gray-900/[0.05] dark:border-white/[0.05]">
          <DiffHunk lines={file.lines} />
        </div>
      )}
    </div>
  );
}
