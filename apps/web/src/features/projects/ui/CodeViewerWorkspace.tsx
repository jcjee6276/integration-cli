"use client";

import hljs from "highlight.js";
import { Fragment, useMemo, useState } from "react";
import type { DragEvent } from "react";

import type { FsFileResult } from "@/features/fs/api/fs.api";
import { useToast } from "@/lib/toast";

import { useCodeSplitResize } from "../hooks/useCodeSplitResize";
import type { CodeViewerPane, DropSide } from "../hooks/useCodeViewer";

interface CodeViewerWorkspaceProps {
  filesByPath: Record<string, FsFileResult>;
  panes: CodeViewerPane[];
  activePaneId: string | null;
  loadingPath: string | null;
  error: string | null;
  onActivateFile: (paneId: string, path: string) => void;
  onCloseFile: (paneId: string, path: string) => void;
  onSplitWithFile: (
    sourcePaneId: string,
    targetPaneId: string,
    path: string,
    side: DropSide,
  ) => void;
  onActivatePane: (paneId: string) => void;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".cjs": "javascript",
  ".css": "css",
  ".html": "xml",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mjs": "javascript",
  ".scss": "scss",
  ".ts": "typescript",
  ".tsx": "typescript",
};

function getFileName(path: string) {
  try {
    return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
  } catch {
    return path;
  }
}

function getExtension(name: string) {
  try {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return name.slice(dotIndex).toLowerCase();
  } catch {
    return "";
  }
}

function highlightCode(file: FsFileResult | undefined) {
  try {
    if (!file) return "";
    const language = LANGUAGE_BY_EXTENSION[getExtension(file.name)];
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(file.content, { language }).value;
    }
    return hljs.highlightAuto(file.content).value;
  } catch {
    return file?.content ?? "";
  }
}

function CodeBody({ file, loading }: { file: FsFileResult | undefined; loading: boolean }) {
  const highlighted = useMemo(() => highlightCode(file), [file]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-900/35 dark:text-white/35">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-900/15 border-t-emerald-500 dark:border-white/15 dark:border-t-emerald-300" />
        파일을 불러오는 중...
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-gray-900/30 dark:text-white/30">
        파일을 선택하면 코드가 표시됩니다
      </div>
    );
  }

  const lines = file.content.split("\n");

  return (
    <div className="h-full overflow-auto bg-white dark:bg-[#0d1117]">
      {file.truncated && (
        <div className="border-b border-amber-500/[0.18] bg-amber-500/[0.08] px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          파일이 커서 일부만 표시됩니다
        </div>
      )}
      <div className="grid min-w-max grid-cols-[auto_minmax(0,1fr)] text-xs leading-5">
        <pre className="border-r border-gray-900/[0.06] bg-gray-900/[0.025] px-3 py-4 text-right font-mono text-gray-900/25 select-none dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/25">
          {lines.map((_, index) => (
            <span key={index} className="block h-5">
              {index + 1}
            </span>
          ))}
        </pre>
        <pre className="hljs min-h-full bg-transparent px-4 py-4 font-mono text-xs leading-5">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h6.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 018.25 16h-6.5A1.75 1.75 0 010 14.25v-7.5zM1.75 6.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-6.5z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11H12.5a.75.75 0 010-1.5h1.75a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5a.25.25 0 00-.25.25V3.5a.75.75 0 01-1.5 0V1.75z" />
    </svg>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function DropOverlay({ side }: { side: DropSide | null }) {
  if (!side) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid grid-cols-2">
      <div
        className={
          side === "left" ? "m-2 rounded-lg border border-emerald-500/45 bg-emerald-500/[0.10]" : ""
        }
      />
      <div
        className={
          side === "right"
            ? "m-2 rounded-lg border border-emerald-500/45 bg-emerald-500/[0.10]"
            : ""
        }
      />
    </div>
  );
}

function CodePane({
  pane,
  filesByPath,
  active,
  onActivateFile,
  onCloseFile,
  onSplitWithFile,
  onActivatePane,
  loadingPath,
}: {
  pane: CodeViewerPane;
  filesByPath: Record<string, FsFileResult>;
  active: boolean;
  loadingPath: string | null;
  onActivateFile: (paneId: string, path: string) => void;
  onCloseFile: (paneId: string, path: string) => void;
  onSplitWithFile: (
    sourcePaneId: string,
    targetPaneId: string,
    path: string,
    side: DropSide,
  ) => void;
  onActivatePane: (paneId: string) => void;
}) {
  const { addToast } = useToast();
  const [dropSide, setDropSide] = useState<DropSide | null>(null);
  const activePath = pane.activePath ?? pane.filePaths[0] ?? null;
  const activeFile = activePath ? filesByPath[activePath] : undefined;
  const activeFileLoading = Boolean(activePath && activePath === loadingPath && !activeFile);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    try {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const side = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
      setDropSide(side);
    } catch {}
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    try {
      event.preventDefault();
      const path = event.dataTransfer.getData("application/x-jc-file-path");
      const sourcePaneId = event.dataTransfer.getData("application/x-jc-pane-id");
      if (path && sourcePaneId && dropSide) {
        onSplitWithFile(sourcePaneId, pane.id, path, dropSide);
      }
    } catch {
    } finally {
      setDropSide(null);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (!activeFile) return;
      const copied = await copyToClipboard(activeFile.content);
      addToast(
        copied
          ? { type: "success", title: "코드 복사됨", message: activeFile.name }
          : { type: "error", title: "복사 실패", message: "클립보드 권한을 확인해 주세요" },
      );
    } catch {
      addToast({ type: "error", title: "복사 실패", message: "다시 시도해 주세요" });
    }
  };

  return (
    <div
      onClick={() => onActivatePane(pane.id)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropSide(null)}
      onDrop={handleDrop}
      className={[
        "relative flex min-h-0 min-w-0 flex-1 flex-col border-l border-gray-900/[0.07] first:border-l-0 dark:border-white/[0.07]",
        active ? "bg-white dark:bg-[#0d1117]" : "bg-gray-900/[0.01] dark:bg-white/[0.01]",
      ].join(" ")}
    >
      <DropOverlay side={dropSide} />
      <div className="flex h-10 shrink-0 items-center border-b border-gray-900/[0.07] bg-gray-900/[0.025] dark:border-white/[0.07] dark:bg-white/[0.025]">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {pane.filePaths.map((path) => {
            const selected = path === activePath;
            return (
              <div
                key={path}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-jc-file-path", path);
                  event.dataTransfer.setData("application/x-jc-pane-id", pane.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className={[
                  "group flex h-10 max-w-56 min-w-32 cursor-pointer items-center gap-2 border-r border-gray-900/[0.06] px-3 text-left text-xs transition-colors dark:border-white/[0.06]",
                  selected
                    ? "bg-white text-gray-900/78 dark:bg-[#0d1117] dark:text-white/78"
                    : "text-gray-900/38 hover:bg-gray-900/[0.04] hover:text-gray-900/65 dark:text-white/38 dark:hover:bg-white/[0.05] dark:hover:text-white/65",
                ].join(" ")}
                title={path}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onActivateFile(pane.id, path);
                  }}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium"
                >
                  {getFileName(path)}
                </button>
                <button
                  type="button"
                  title="닫기"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseFile(pane.id, path);
                  }}
                  className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-gray-900/24 opacity-70 transition-colors group-hover:opacity-100 hover:bg-gray-900/[0.07] hover:text-gray-900/70 dark:text-white/24 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          title="코드 복사"
          disabled={!activeFile}
          onClick={(event) => {
            event.stopPropagation();
            void handleCopyCode();
          }}
          className="mr-2 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-900/70 disabled:cursor-default disabled:opacity-30 dark:text-white/30 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
        >
          <CopyIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeBody file={activeFile} loading={activeFileLoading} />
      </div>
    </div>
  );
}

export function CodeViewerWorkspace({
  filesByPath,
  panes,
  activePaneId,
  loadingPath,
  error,
  onActivateFile,
  onCloseFile,
  onSplitWithFile,
  onActivatePane,
}: CodeViewerWorkspaceProps) {
  const visiblePanes = panes.filter((pane) => pane.filePaths.length > 0);
  const { containerRef, leftWidth, resizing, startResize } = useCodeSplitResize();

  if (visiblePanes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-xs text-gray-900/30 dark:text-white/30">
        {loadingPath ? `${getFileName(loadingPath)} 불러오는 중...` : "파일을 선택하세요"}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {error && (
        <div className="shrink-0 border-b border-gray-900/[0.07] px-3 py-2 text-xs text-red-600 dark:border-white/[0.07] dark:text-red-300">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns:
            visiblePanes.length === 2 ? `${leftWidth}% 8px minmax(0, 1fr)` : "minmax(0, 1fr)",
        }}
      >
        {visiblePanes.map((pane, index) => (
          <Fragment key={pane.id}>
            {index === 1 && (
              <button
                type="button"
                aria-label="코드 뷰어 비율 조정"
                onMouseDown={startResize}
                className={[
                  "group flex cursor-col-resize items-center justify-center border-x border-gray-900/[0.06] bg-gray-900/[0.02] transition-colors hover:bg-emerald-500/[0.08] dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-emerald-400/[0.10]",
                  resizing ? "bg-emerald-500/[0.10] dark:bg-emerald-400/[0.12]" : "",
                ].join(" ")}
              >
                <span className="h-10 w-0.5 rounded-full bg-gray-900/15 transition-colors group-hover:bg-emerald-500/60 dark:bg-white/15 dark:group-hover:bg-emerald-300/60" />
              </button>
            )}
            <CodePane
              pane={pane}
              filesByPath={filesByPath}
              active={pane.id === activePaneId}
              loadingPath={loadingPath}
              onActivateFile={onActivateFile}
              onCloseFile={onCloseFile}
              onSplitWithFile={onSplitWithFile}
              onActivatePane={onActivatePane}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
