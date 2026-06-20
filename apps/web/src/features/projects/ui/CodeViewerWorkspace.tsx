"use client";

import hljs from "highlight.js";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

import { openFileInIde, type FsFileResult } from "@/features/fs/api/fs.api";
import { useToast } from "@/lib/toast";

import { useCodeSplitResize } from "../hooks/useCodeSplitResize";
import type { CodeFocus, CodeViewerPane, DropSide } from "../hooks/useCodeViewer";

const LINE_HEIGHT_PX = 20;
const CODE_PADDING_TOP_PX = 16;

interface CodeViewerWorkspaceProps {
  projectPath: string | null;
  filesByPath: Record<string, FsFileResult>;
  panes: CodeViewerPane[];
  activePaneId: string | null;
  loadingPath: string | null;
  error: string | null;
  focus: CodeFocus | null;
  onActivateFile: (paneId: string, path: string) => void;
  onCloseFile: (paneId: string, path: string) => void;
  onFocusLine: (path: string, line: number, endLine?: number, manual?: boolean) => void;
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

function CodeBody({
  file,
  loading,
  focusStartLine,
  focusEndLine,
  focusNonce,
  onSelectLine,
}: {
  file: FsFileResult | undefined;
  loading: boolean;
  focusStartLine: number | null;
  focusEndLine: number | null;
  focusNonce: number;
  onSelectLine: (line: number) => void;
}) {
  const highlighted = useMemo(() => highlightCode(file), [file]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!file || !focusStartLine || focusStartLine < 1) return;
      const container = scrollRef.current;
      if (!container) return;
      const bandTop = CODE_PADDING_TOP_PX + (focusStartLine - 1) * LINE_HEIGHT_PX;
      // 시작 줄을 화면 위쪽 1/3 지점에 두어 요소 본문이 아래로 보이도록
      const target = bandTop - container.clientHeight / 3;
      container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    } catch {}
    // focusNonce: 같은 라인 재클릭 시에도 다시 스크롤
  }, [file, focusStartLine, focusNonce]);

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
  const startLine = focusStartLine && focusStartLine >= 1 ? focusStartLine : null;
  const endLine = startLine
    ? Math.min(Math.max(focusEndLine ?? startLine, startLine), lines.length)
    : null;
  const showBand = Boolean(startLine && startLine <= lines.length);
  const isFocused = (lineNo: number) =>
    Boolean(startLine && endLine && lineNo >= startLine && lineNo <= endLine);

  return (
    <div ref={scrollRef} className="h-full overflow-auto bg-white dark:bg-[#0d1117]">
      {file.truncated && (
        <div className="border-b border-amber-500/[0.18] bg-amber-500/[0.08] px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          파일이 커서 일부만 표시됩니다
        </div>
      )}
      <div className="relative grid min-w-max grid-cols-[auto_minmax(0,1fr)] text-xs leading-5">
        {showBand && (
          <div
            className="pointer-events-none absolute right-0 left-0 z-0 border-y border-emerald-500/30 bg-emerald-400/[0.12]"
            style={{
              top: CODE_PADDING_TOP_PX + (startLine! - 1) * LINE_HEIGHT_PX,
              height: (endLine! - startLine! + 1) * LINE_HEIGHT_PX,
            }}
          />
        )}
        <pre className="relative z-10 border-r border-gray-900/[0.06] bg-gray-900/[0.025] px-2 py-4 text-right font-mono text-gray-900/25 select-none dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/25">
          {lines.map((_, index) => (
            <button
              key={index}
              type="button"
              title={`${index + 1}라인 선택`}
              onClick={() => onSelectLine(index + 1)}
              className={[
                "block h-5 min-w-8 cursor-pointer rounded px-1 text-right transition-colors hover:bg-emerald-500/[0.10] hover:text-emerald-600 dark:hover:text-emerald-300",
                isFocused(index + 1)
                  ? "bg-emerald-500/[0.12] font-semibold text-emerald-600 dark:text-emerald-300"
                  : "",
              ].join(" ")}
            >
              {index + 1}
            </button>
          ))}
        </pre>
        <pre className="hljs relative z-10 min-h-full bg-transparent px-4 py-4 font-mono text-xs leading-5">
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

function OpenInIdeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M2.25 2A2.25 2.25 0 000 4.25v7.5A2.25 2.25 0 002.25 14h11.5A2.25 2.25 0 0016 11.75v-7.5A2.25 2.25 0 0013.75 2H2.25zM1.5 4.25a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H2.25a.75.75 0 01-.75-.75v-7.5z" />
      <path d="M5.22 5.22a.75.75 0 011.06 0L8 6.94l1.72-1.72a.75.75 0 111.06 1.06L9.06 8l1.72 1.72a.75.75 0 11-1.06 1.06L8 9.06l-1.72 1.72a.75.75 0 01-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 010-1.06z" />
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
  projectPath,
  filesByPath,
  active,
  onActivateFile,
  onCloseFile,
  onFocusLine,
  onSplitWithFile,
  onActivatePane,
  loadingPath,
  focus,
}: {
  pane: CodeViewerPane;
  projectPath: string | null;
  filesByPath: Record<string, FsFileResult>;
  active: boolean;
  loadingPath: string | null;
  focus: CodeFocus | null;
  onActivateFile: (paneId: string, path: string) => void;
  onCloseFile: (paneId: string, path: string) => void;
  onFocusLine: (path: string, line: number, endLine?: number, manual?: boolean) => void;
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
  const applyFocus = Boolean(focus && activePath && focus.path === activePath);

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

  const handleOpenInIde = async () => {
    try {
      if (!activePath) return;
      const selectedLine = applyFocus ? focus?.line : null;
      const result = await openFileInIde({
        path: activePath,
        projectPath,
        line: selectedLine,
      });

      addToast(
        result.ok
          ? {
              type: "success",
              title: "IDE에서 열림",
              message: `${activeFile?.name ?? getFileName(activePath)}${selectedLine ? `:${selectedLine}` : ""} · ${result.opener ?? "IDE"}`,
            }
          : {
              type: "error",
              title: "IDE 열기 실패",
              message: result.error ?? "VS Code, Cursor, IntelliJ 실행 상태를 확인해 주세요",
            },
      );
    } catch {
      addToast({ type: "error", title: "IDE 열기 실패", message: "다시 시도해 주세요" });
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
        <button
          type="button"
          title="IDE에서 열기"
          disabled={!activePath}
          onClick={(event) => {
            event.stopPropagation();
            void handleOpenInIde();
          }}
          className="mr-2 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-900/70 disabled:cursor-default disabled:opacity-30 dark:text-white/30 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
        >
          <OpenInIdeIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeBody
          file={activeFile}
          loading={activeFileLoading}
          focusStartLine={applyFocus ? focus!.line : null}
          focusEndLine={applyFocus ? (focus!.endLine ?? null) : null}
          focusNonce={focus?.nonce ?? 0}
          onSelectLine={(line) => {
            if (activePath) onFocusLine(activePath, line, undefined, true);
          }}
        />
      </div>
    </div>
  );
}

export function CodeViewerWorkspace({
  projectPath,
  filesByPath,
  panes,
  activePaneId,
  loadingPath,
  error,
  focus,
  onActivateFile,
  onCloseFile,
  onFocusLine,
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
              projectPath={projectPath}
              filesByPath={filesByPath}
              active={pane.id === activePaneId}
              loadingPath={loadingPath}
              focus={focus}
              onActivateFile={onActivateFile}
              onCloseFile={onCloseFile}
              onFocusLine={onFocusLine}
              onSplitWithFile={onSplitWithFile}
              onActivatePane={onActivatePane}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
