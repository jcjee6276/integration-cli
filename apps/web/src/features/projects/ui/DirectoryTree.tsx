"use client";

import { useMemo, useState } from "react";

import type { FsTreeNode } from "@/features/fs/api/fs.api";

interface DirectoryTreeProps {
  root: FsTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

interface TreeNodeRowProps {
  node: FsTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      {open ? (
        <path d="M1.75 2A1.75 1.75 0 000 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0016 12.25v-6.5A1.75 1.75 0 0014.25 4H8.5a.25.25 0 01-.2-.1L7.4 2.7C7.07 2.26 6.55 2 6 2H1.75z" />
      ) : (
        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
      )}
    </svg>
  );
}

const FILE_ICON_META: Record<string, { label: string; className: string }> = {
  ".css": { label: "#", className: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
  ".html": { label: "<>", className: "bg-orange-500/12 text-orange-600 dark:text-orange-300" },
  ".js": { label: "JS", className: "bg-yellow-400/18 text-yellow-700 dark:text-yellow-300" },
  ".jsx": { label: "JX", className: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300" },
  ".json": { label: "{}", className: "bg-lime-500/12 text-lime-700 dark:text-lime-300" },
  ".md": { label: "MD", className: "bg-gray-500/12 text-gray-700 dark:text-gray-300" },
  ".scss": { label: "S", className: "bg-pink-500/12 text-pink-700 dark:text-pink-300" },
  ".ts": { label: "TS", className: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  ".tsx": { label: "TX", className: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" },
};

function getExtension(name: string) {
  try {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return name.slice(dotIndex).toLowerCase();
  } catch {
    return "";
  }
}

function FileIcon({ name }: { name: string }) {
  const meta = FILE_ICON_META[getExtension(name)];

  if (meta) {
    return (
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-[4px] font-mono text-[8px] leading-none font-bold ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M3.75 1A1.75 1.75 0 002 2.75v10.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25V5.5a.75.75 0 00-.22-.53L10.03 1.22A.75.75 0 009.5 1H3.75zM9 2.5L12.5 6H9.75A.75.75 0 019 5.25V2.5z" />
    </svg>
  );
}

function Chevron({ open, hidden }: { open: boolean; hidden: boolean }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-900/25 dark:text-white/25">
      {!hidden && (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M5.47 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06L9.19 8 5.47 4.28a.75.75 0 010-1.06z" />
        </svg>
      )}
    </span>
  );
}

function TreeNodeRow({ node, depth, selectedPath, onSelect }: TreeNodeRowProps) {
  const [open, setOpen] = useState(depth < 2);
  const isDirectory = node.type === "directory";
  const hasChildren = Boolean(node.children?.length);
  const selected = selectedPath === node.path;
  const paddingLeft = useMemo(() => `${depth * 16 + 8}px`, [depth]);

  const handleClick = () => {
    try {
      onSelect(node.path);
      if (isDirectory && hasChildren) setOpen((value) => !value);
    } catch {}
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        title={node.path}
        className={[
          "grid h-8 w-full cursor-pointer grid-cols-[16px_16px_minmax(0,1fr)_auto] items-center gap-2 pr-3 text-left text-xs transition-colors",
          selected
            ? "bg-emerald-500/[0.10] text-emerald-700 dark:bg-emerald-400/[0.12] dark:text-emerald-300"
            : "text-gray-900/64 hover:bg-gray-900/[0.04] dark:text-white/64 dark:hover:bg-white/[0.05]",
        ].join(" ")}
        style={{ paddingLeft }}
      >
        <Chevron open={open} hidden={!isDirectory || !hasChildren} />
        <span
          className={
            isDirectory
              ? "text-emerald-600/70 dark:text-emerald-300/70"
              : "text-gray-900/28 dark:text-white/28"
          }
        >
          {isDirectory ? <FolderIcon open={open} /> : <FileIcon name={node.name} />}
        </span>
        <span className="min-w-0 truncate font-medium">{node.name}</span>
        {node.truncated && (
          <span className="rounded-full bg-amber-500/[0.12] px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            제한
          </span>
        )}
        {node.error && (
          <span className="rounded-full bg-red-500/[0.10] px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-300">
            오류
          </span>
        )}
      </button>
      {open && hasChildren && (
        <ul>
          {node.children?.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DirectoryTree({ root, selectedPath, onSelect }: DirectoryTreeProps) {
  return (
    <ul className="w-max min-w-full py-2">
      <TreeNodeRow node={root} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
    </ul>
  );
}
