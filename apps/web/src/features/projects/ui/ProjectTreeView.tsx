"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
import type { FsTreeNode, FsTreeResult } from "@/features/fs/api/fs.api";
import { useIntentionalOverRenderTest } from "@/hooks/useIntentionalOverRenderTest";
import { ThemeToggle } from "@/lib/theme";
import { useToast } from "@/lib/toast";

import type { useCodeViewer } from "../hooks/useCodeViewer";
import type { useInspector } from "../hooks/useInspector";
import { EXTENSION_FILTER_OPTIONS } from "../hooks/useProjectTree";
import { useResizablePanels } from "../hooks/useResizablePanels";

import { CodeViewerWorkspace } from "./CodeViewerWorkspace";
import { DirectoryTree } from "./DirectoryTree";
import { InspectorPanel } from "./InspectorPanel";

interface ProjectTreeViewProps {
  projectPath: string;
  tree: FsTreeResult | null;
  filteredTree: FsTreeResult | null;
  selectedPath: string | null;
  extensionWhitelist: string[];
  loading: boolean;
  error: string | null;
  codeViewer: ReturnType<typeof useCodeViewer>;
  inspector: ReturnType<typeof useInspector>;
  onProjectPathChange: (path: string) => void;
  onLoadTree: () => void;
  onSelectNode: (node: FsTreeNode) => void;
  onToggleExtension: (extension: string) => void;
  onClearExtensions: () => void;
}

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
  );
}

function EmptyTree() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-900/[0.08] bg-emerald-500/[0.08] text-emerald-600 dark:border-white/[0.08] dark:text-emerald-300">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-6 w-6">
          <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900/70 dark:text-white/70">프로젝트 디렉토리</p>
        <p className="mt-1 text-xs text-gray-900/35 dark:text-white/35">
          선택한 경로의 트리가 여기에 표시됩니다
        </p>
      </div>
    </div>
  );
}

function TreeStats({ tree }: { tree: FsTreeResult }) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-[11px] text-gray-900/35 dark:text-white/35">
      <span>{tree.totalNodes.toLocaleString()} nodes</span>
      <span className="h-1 w-1 rounded-full bg-gray-900/20 dark:bg-white/20" />
      <span>depth {tree.maxDepth}</span>
      {tree.truncated && (
        <>
          <span className="h-1 w-1 rounded-full bg-gray-900/20 dark:bg-white/20" />
          <span className="text-amber-600 dark:text-amber-300">truncated</span>
        </>
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M1.5 2.75A.75.75 0 012.25 2h11.5a.75.75 0 01.58 1.226L10 8.516v3.734a.75.75 0 01-.323.616l-2 1.384A.75.75 0 016.5 13.634V8.516L1.67 3.226A.75.75 0 011.5 2.75z" />
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

function InspectIcon() {
  // 개발자도구 element-select 아이콘 (커서 + 사각형)
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M5 12V6a1 1 0 011-1h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M19 12v6a1 1 0 01-1 1h-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M12 11l8 3.2-3.3 1.2 2.3 3.4-1.7 1.1-2.2-3.4-2.4 2.6z" fill="currentColor" />
    </svg>
  );
}

function PanelIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      {direction === "left" ? (
        <path d="M9.78 3.22a.75.75 0 010 1.06L6.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" />
      ) : (
        <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
      )}
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

function ExtensionFilterMenu({
  extensionWhitelist,
  onToggleExtension,
  onClearExtensions,
}: {
  extensionWhitelist: string[];
  onToggleExtension: (extension: string) => void;
  onClearExtensions: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const checkedCount = extensionWhitelist.length;
  const allChecked = checkedCount === EXTENSION_FILTER_OPTIONS.length;

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="확장자 필터"
        className={[
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors",
          open || !allChecked
            ? "border-emerald-500/35 bg-emerald-500/[0.10] text-emerald-700 dark:text-emerald-300"
            : "border-gray-900/[0.07] bg-white/45 text-gray-900/35 hover:bg-gray-900/[0.04] hover:text-gray-900/60 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/60",
        ].join(" ")}
      >
        <FilterIcon />
        <span className="font-mono">
          {checkedCount}/{EXTENSION_FILTER_OPTIONS.length}
        </span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-gray-900/[0.09] bg-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.32)] dark:border-white/[0.09] dark:bg-[#0e1117]">
          <div className="flex items-center justify-between border-b border-gray-900/[0.06] px-2.5 py-2 dark:border-white/[0.06]">
            <span className="text-[11px] font-semibold text-gray-900/45 dark:text-white/45">
              Whitelist
            </span>
            <button
              type="button"
              onClick={onClearExtensions}
              disabled={allChecked}
              className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-900/35 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/65 disabled:cursor-default disabled:opacity-30 dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/65"
            >
              전체
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {EXTENSION_FILTER_OPTIONS.map((option) => {
              const checked = extensionWhitelist.includes(option.extension);
              return (
                <label
                  key={option.extension}
                  className="flex h-8 cursor-pointer items-center gap-2 px-2.5 text-xs text-gray-900/62 transition-colors hover:bg-gray-900/[0.04] dark:text-white/62 dark:hover:bg-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleExtension(option.extension)}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  <span className="w-10 font-mono font-semibold">{option.extension}</span>
                  <span className="min-w-0 truncate text-[11px] text-gray-900/35 dark:text-white/35">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeHeaderTools({
  tree,
  extensionWhitelist,
  onToggleExtension,
  onClearExtensions,
}: {
  tree: FsTreeResult;
  extensionWhitelist: string[];
  onToggleExtension: (extension: string) => void;
  onClearExtensions: () => void;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-3">
      <TreeStats tree={tree} />
      <ExtensionFilterMenu
        extensionWhitelist={extensionWhitelist}
        onToggleExtension={onToggleExtension}
        onClearExtensions={onClearExtensions}
      />
    </div>
  );
}

export function ProjectTreeView({
  projectPath,
  tree,
  filteredTree,
  selectedPath,
  extensionWhitelist,
  loading,
  error,
  codeViewer,
  inspector,
  onProjectPathChange,
  onLoadTree,
  onSelectNode,
  onToggleExtension,
  onClearExtensions,
}: ProjectTreeViewProps) {
  // INTENTIONAL_OVER_RENDER_TEST: 과다 렌더링 탐지 검증용.
  useIntentionalOverRenderTest("ProjectTreeView", { intervalMs: 650, maxTicks: 20 });

  const { containerRef, treeWidth, resizing, startResize } = useResizablePanels();
  const { addToast } = useToast();
  const [treeVisible, setTreeVisible] = useState(true);
  const [treeRendered, setTreeRendered] = useState(true);
  const treeAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePane =
    codeViewer.panes.find((pane) => pane.id === codeViewer.activePaneId) ??
    codeViewer.panes.find((pane) => pane.filePaths.length > 0);
  const activeFilePath = activePane?.activePath ?? activePane?.filePaths[0] ?? null;
  const activeFileName = activeFilePath
    ? (codeViewer.filesByPath[activeFilePath]?.name ?? activeFilePath.split(/[/\\]/).at(-1))
    : "Code Viewer";
  const projectRootPath = tree?.root.path ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      onLoadTree();
    } catch {}
  };

  const clearTreeAnimationTimer = () => {
    try {
      if (!treeAnimationTimerRef.current) return;
      clearTimeout(treeAnimationTimerRef.current);
      treeAnimationTimerRef.current = null;
    } catch {}
  };

  const handleHideTree = () => {
    try {
      clearTreeAnimationTimer();
      setTreeVisible(false);
      treeAnimationTimerRef.current = setTimeout(() => {
        setTreeRendered(false);
        treeAnimationTimerRef.current = null;
      }, 180);
    } catch {}
  };

  const handleShowTree = () => {
    try {
      clearTreeAnimationTimer();
      setTreeRendered(true);
      requestAnimationFrame(() => setTreeVisible(true));
    } catch {}
  };

  const handleCopyActivePath = async () => {
    try {
      if (!activeFilePath) return;
      const copied = await copyToClipboard(activeFilePath);
      addToast(
        copied
          ? { type: "success", title: "경로 복사됨", message: activeFileName ?? activeFilePath }
          : { type: "error", title: "복사 실패", message: "클립보드 권한을 확인해 주세요" },
      );
    } catch {
      addToast({ type: "error", title: "복사 실패", message: "다시 시도해 주세요" });
    }
  };

  useEffect(() => {
    return () => {
      try {
        if (treeAnimationTimerRef.current) clearTimeout(treeAnimationTimerRef.current);
      } catch {}
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-900/[0.07] px-4 dark:border-white/[0.07]">
        <Link
          href="/claude"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-900/35 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
          title="Claude로 이동"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M9.78 3.22a.75.75 0 010 1.06L6.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900/82 dark:text-white/82">Projects</h1>
          <p className="truncate font-mono text-[11px] text-gray-900/28 dark:text-white/28">
            {projectRootPath ?? "no project loaded"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            title="Inspect Mode"
            onClick={inspector.togglePanel}
            className={[
              "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors",
              inspector.panelOpen || inspector.state === "active"
                ? "bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-300"
                : "text-gray-900/30 hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:text-white/30 dark:hover:bg-white/[0.07] dark:hover:text-white/70",
            ].join(" ")}
          >
            <InspectIcon />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {inspector.panelOpen && (
        <InspectorPanel
          appUrl={inspector.appUrl}
          projectPath={projectRootPath}
          state={inspector.state}
          error={inspector.error}
          lastElement={inspector.lastElement}
          onAppUrlChange={inspector.setAppUrl}
          onStart={inspector.start}
          onStop={inspector.stop}
          onClose={() => inspector.setPanelOpen(false)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]"
      >
        <WorkingDirPicker value={projectPath} onChange={onProjectPathChange} variant="field" />
        <button
          type="submit"
          disabled={loading || !projectPath.trim()}
          className="flex h-10 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:hover:text-gray-950"
        >
          {loading && <Spinner />}
          스캔
        </button>
      </form>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <main
        ref={containerRef}
        className="grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-200 ease-out"
        style={{
          gridTemplateColumns: treeRendered
            ? treeVisible
              ? `${treeWidth}% 8px minmax(0, 1fr)`
              : "40px 8px minmax(0, 1fr)"
            : "40px minmax(0, 1fr)",
        }}
      >
        {treeRendered ? (
          <>
            <section
              className={[
                "flex min-h-0 min-w-0 flex-col overflow-hidden transition-all duration-200 ease-out",
                treeVisible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
              ].join(" ")}
            >
              <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-gray-900/[0.07] px-4 dark:border-white/[0.07]">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    title="Dir Tree 숨기기"
                    onClick={handleHideTree}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:text-white/30 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
                  >
                    <PanelIcon direction="left" />
                  </button>
                  <span className="truncate text-xs font-semibold text-gray-900/55 dark:text-white/55">
                    Dir Tree
                  </span>
                </div>
                {filteredTree && (
                  <TreeHeaderTools
                    tree={filteredTree}
                    extensionWhitelist={extensionWhitelist}
                    onToggleExtension={onToggleExtension}
                    onClearExtensions={onClearExtensions}
                  />
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                {filteredTree ? (
                  <DirectoryTree
                    root={filteredTree.root}
                    selectedPath={selectedPath}
                    onSelect={onSelectNode}
                  />
                ) : (
                  <EmptyTree />
                )}
              </div>
            </section>

            <button
              type="button"
              aria-label="패널 비율 조정"
              onMouseDown={startResize}
              className={[
                "group flex cursor-col-resize items-center justify-center border-x border-gray-900/[0.06] bg-gray-900/[0.02] transition-all hover:bg-emerald-500/[0.08] dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-emerald-400/[0.10]",
                resizing ? "bg-emerald-500/[0.10] dark:bg-emerald-400/[0.12]" : "",
                treeVisible ? "opacity-100" : "pointer-events-none opacity-0",
              ].join(" ")}
            >
              <span className="h-10 w-0.5 rounded-full bg-gray-900/15 transition-colors group-hover:bg-emerald-500/60 dark:bg-white/15 dark:group-hover:bg-emerald-300/60" />
            </button>
          </>
        ) : (
          <div className="flex min-h-0 items-start justify-center border-r border-gray-900/[0.07] bg-gray-900/[0.02] py-2 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <button
              type="button"
              title="Dir Tree 열기"
              onClick={handleShowTree}
              className="animate-fade-in-up flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-900/35 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-900/70 dark:text-white/35 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
            >
              <PanelIcon direction="right" />
            </button>
          </div>
        )}

        <aside className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-3 border-b border-gray-900/[0.07] px-4 dark:border-white/[0.07]">
            <div className="min-w-0 flex-1">
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-900/60 dark:text-white/60">
                {activeFilePath ?? "파일을 선택하세요"}
              </p>
              {/* <p className="mt-0.5 truncate text-xs font-semibold text-gray-900/60 dark:text-white/60"> */}
              {/* {activeFileName} */}
              {/* </p> */}
            </div>
            <button
              type="button"
              title="절대 경로 복사"
              disabled={!activeFilePath}
              onClick={() => void handleCopyActivePath()}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-900/30 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 disabled:cursor-default disabled:opacity-30 dark:text-white/30 dark:hover:bg-white/[0.07] dark:hover:text-white/70"
            >
              <CopyIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeViewerWorkspace
              projectPath={projectRootPath}
              filesByPath={codeViewer.filesByPath}
              panes={codeViewer.panes}
              activePaneId={codeViewer.activePaneId}
              loadingPath={codeViewer.loadingPath}
              error={codeViewer.error}
              focus={codeViewer.focus}
              onActivateFile={codeViewer.activateFile}
              onCloseFile={codeViewer.closeFile}
              onOpenFile={codeViewer.openFile}
              onFocusLine={codeViewer.focusLine}
              onSplitWithFile={codeViewer.splitWithFile}
              onActivatePane={codeViewer.setActivePaneId}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
