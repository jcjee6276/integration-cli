"use client";

import { memo, useEffect, useRef } from "react";

import { useDirBrowser } from "@/features/fs/hooks/useDirBrowser";

interface WorkingDirPickerProps {
  value: string;
  onChange: (path: string) => void;
  /** "inline" = 채팅 푸터용 한 줄 레이아웃, "field" = 모달 내 폼 필드 */
  variant?: "inline" | "field";
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
    </svg>
  );
}

function DirDropdown({
  currentPath,
  dirs,
  loading,
  direction = "down",
  onNavigate,
  onNavigateUp,
  onSelect,
}: {
  currentPath: string;
  dirs: string[];
  loading: boolean;
  direction?: "up" | "down";
  onNavigate: (path: string) => void;
  onNavigateUp: () => void;
  onSelect: () => void;
}) {
  const sep = currentPath.includes("/") ? "/" : "\\";
  const isRoot = !currentPath || currentPath === sep || !currentPath.slice(1).includes(sep);
  const positionClass = direction === "up" ? "bottom-full mb-1" : "top-full mt-1";

  return (
    <div
      className={`absolute left-0 z-50 w-80 rounded-xl border border-gray-900/[0.1] bg-white shadow-lg dark:border-white/[0.1] dark:bg-gray-900 ${positionClass}`}
    >
      {/* 현재 경로 + 위로 버튼 */}
      <div className="flex items-center gap-1.5 border-b border-gray-900/[0.07] px-3 py-2 dark:border-white/[0.07]">
        <button
          type="button"
          onClick={onNavigateUp}
          disabled={isRoot || loading}
          title="상위 폴더"
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-gray-900/40 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-900/70 disabled:cursor-default disabled:opacity-30 dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.22 10.53a.75.75 0 001.06 0L8 6.81l3.72 3.72a.75.75 0 101.06-1.06L8.53 5.22a.75.75 0 00-1.06 0L3.22 9.47a.75.75 0 000 1.06z" />
          </svg>
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-900/60 dark:text-white/60">
          {currentPath || "…"}
        </span>
      </div>

      {/* 디렉토리 목록 */}
      <ul className="max-h-52 overflow-y-auto py-1">
        {loading && (
          <li className="px-3 py-2 text-xs text-gray-900/30 dark:text-white/30">로딩 중…</li>
        )}
        {!loading && dirs.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-900/30 dark:text-white/30">하위 폴더 없음</li>
        )}
        {!loading &&
          dirs.map((dir) => (
            <li key={dir}>
              <button
                type="button"
                onClick={() => onNavigate(`${currentPath}${sep}${dir}`)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-900/75 transition-colors hover:bg-gray-900/[0.04] dark:text-white/75 dark:hover:bg-white/[0.05]"
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-gray-900/30 dark:text-white/30" />
                <span className="truncate">{dir}</span>
              </button>
            </li>
          ))}
      </ul>

      {/* 선택 확정 */}
      <div className="border-t border-gray-900/[0.07] px-3 py-2 dark:border-white/[0.07]">
        <button
          type="button"
          onClick={onSelect}
          disabled={!currentPath}
          className="w-full cursor-pointer rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-default disabled:opacity-40"
        >
          여기 선택
        </button>
      </div>
    </div>
  );
}

export const WorkingDirPicker = memo(function WorkingDirPicker({ value, onChange, variant = "field" }: WorkingDirPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { open, currentPath, dirs, loading, navigate, openBrowser, closeBrowser, navigateUp } =
    useDirBrowser();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeBrowser();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeBrowser]);

  const handleOpenBrowser = useCallback(() => {
    try {
      void openBrowser(value || undefined);
    } catch {}
  }, [openBrowser, value]);

  const handleSelect = useCallback(() => {
    try {
      onChange(currentPath);
      closeBrowser();
    } catch {}
  }, [closeBrowser, currentPath, onChange]);

  const handleClear = useCallback(() => {
    try {
      onChange("");
    } catch {}
  }, [onChange]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      try {
        onChange(event.target.value);
      } catch {}
    },
    [onChange],
  );

  const dropdown = open ? (
    <DirDropdown
      currentPath={currentPath}
      dirs={dirs}
      loading={loading}
      direction={variant === "inline" ? "up" : "down"}
      onNavigate={navigate}
      onNavigateUp={navigateUp}
      onSelect={handleSelect}
    />
  ) : null;

  if (variant === "inline") {
    return (
      <div ref={containerRef} className="relative flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleOpenBrowser}
          title="워크 디렉토리 선택"
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/60 dark:text-white/30 dark:hover:bg-white/[0.06] dark:hover:text-white/60"
        >
          <FolderIcon className="h-3.5 w-3.5" />
        </button>

        {value ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate font-mono text-[11px] text-orange-600 dark:text-orange-400">
              {value}
            </span>
            <button
              type="button"
              onClick={handleClear}
              title="지우기"
              className="shrink-0 cursor-pointer text-gray-900/20 transition-colors hover:text-gray-900/50 dark:text-white/20 dark:hover:text-white/50"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-900/25 dark:text-white/25">
            워크 디렉토리 없음
          </span>
        )}

        {dropdown}
      </div>
    );
  }

  // variant === "field"
  return (
    <div ref={containerRef} className="relative flex gap-2">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder="~/IdeaProjects/project 또는 IdeaProjects/project"
        className="flex-1 rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 py-2 font-mono text-sm text-gray-900/65 placeholder-gray-900/20 transition-colors outline-none focus:border-orange-500/50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/65 dark:placeholder-white/20"
      />
      <button
        type="button"
        onClick={handleOpenBrowser}
        title="디렉토리 선택"
        className="flex cursor-pointer items-center justify-center rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 text-gray-900/40 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/70"
      >
        <FolderIcon className="h-4 w-4" />
      </button>

      {dropdown}
    </div>
  );
});
