"use client";

import { useRef } from "react";

interface WorkingDirPickerProps {
  value: string;
  onChange: (path: string) => void;
  /** "inline" = 채팅 푸터용 한 줄 레이아웃, "field" = 모달 내 폼 필드 */
  variant?: "inline" | "field";
}

export function WorkingDirPicker({ value, onChange, variant = "field" }: WorkingDirPickerProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fullPath = (file as File & { path?: string }).path;
      if (fullPath) {
        onChange(fullPath.slice(0, fullPath.lastIndexOf("/")));
      } else {
        onChange(file.webkitRelativePath.split("/")[0]);
      }
    }
    e.target.value = "";
  };

  // 숨겨진 디렉토리 피커 (파일 내용 업로드 없이 경로만 참조)
  const picker = (
    <input
      ref={pickerRef}
      type="file"
      className="hidden"
      // @ts-expect-error webkitdirectory 비표준 속성
      webkitdirectory=""
      onChange={handlePickerChange}
    />
  );

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1.5">
        {picker}
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          title="워크 디렉토리 선택"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/60 dark:text-white/30 dark:hover:bg-white/[0.06] dark:hover:text-white/60"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
          </svg>
        </button>

        {value ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate font-mono text-[11px] text-orange-600 dark:text-orange-400">
              {value}
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              title="지우기"
              className="shrink-0 text-gray-900/20 transition-colors hover:text-gray-900/50 dark:text-white/20 dark:hover:text-white/50"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-900/25 dark:text-white/25">워크 디렉토리 없음</span>
        )}
      </div>
    );
  }

  // variant === "field"
  return (
    <div className="flex gap-2">
      {picker}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/path/to/project"
        className="flex-1 rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 py-2 font-mono text-sm text-gray-900/65 placeholder-gray-900/20 outline-none transition-colors focus:border-orange-500/50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/65 dark:placeholder-white/20"
      />
      <button
        type="button"
        onClick={() => pickerRef.current?.click()}
        title="디렉토리 선택"
        className="flex items-center justify-center rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 text-gray-900/40 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white/70"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
        </svg>
      </button>
    </div>
  );
}
