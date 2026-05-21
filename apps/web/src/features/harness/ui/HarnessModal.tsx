"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { HarnessExt, HarnessRole } from "../api/harness.api";
import { HARNESS_ROLES } from "../api/harness.api";
import { useHarness } from "../hooks/useHarness";

// ─── 역할 사이드바 ────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<HarnessRole, React.ReactNode> = {
  common: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM4.5 7.5a.5.5 0 000 1h7a.5.5 0 000-1h-7z" />
    </svg>
  ),
  frontend: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M0 2.75A2.75 2.75 0 012.75 0h10.5A2.75 2.75 0 0116 2.75v10.5A2.75 2.75 0 0113.25 16H2.75A2.75 2.75 0 010 13.25V2.75zM2.75 1.5A1.25 1.25 0 001.5 2.75V4h13V2.75A1.25 1.25 0 0013.25 1.5H2.75zM1.5 5.5v7.75c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V5.5H1.5z" />
    </svg>
  ),
  backend: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v2A1.5 1.5 0 0113.5 7h-11A1.5 1.5 0 011 5.5v-2zm0 6A1.5 1.5 0 012.5 8h11A1.5 1.5 0 0115 9.5v2A1.5 1.5 0 0113.5 13h-11A1.5 1.5 0 011 11.5v-2z" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M4 1.75C4 .784 4.784 0 5.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0114.25 16h-8.5A1.75 1.75 0 014 14.25V1.75zM5.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 0110 4.25V1.5H5.75zm4.75.44v2.31c0 .138.112.25.25.25h2.31L10.5 1.94z" />
    </svg>
  ),
  operation: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0z" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 8a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
};

// ─── Editor ───────────────────────────────────────────────────────────────────

interface EditorProps {
  role: HarnessRole;
}

function HarnessEditor({ role }: EditorProps) {
  const { content, ext, loading, saving, dirty, setContent, setExt, save } = useHarness(role);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* 확장자 토글 + 저장 */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-gray-900/[0.08] p-0.5 dark:border-white/[0.08]">
          {(["md", "tsx"] as HarnessExt[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setExt(e)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                ext === e
                  ? "bg-gray-900/[0.07] text-gray-900/75 dark:bg-white/[0.07] dark:text-white/75"
                  : "text-gray-900/30 hover:text-gray-900/55 dark:text-white/30 dark:hover:text-white/55",
              ].join(" ")}
            >
              .{e}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-40"
        >
          {saving && (
            <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
          )}
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* 텍스트 에디터 */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-orange-500 dark:border-white/[0.08]" />
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-xl border border-gray-900/[0.08] dark:border-white/[0.08]">
          <div className="absolute right-3 top-2.5 z-10 font-mono text-[10px] text-gray-900/20 dark:text-white/20">
            .{ext}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder={
              ext === "md"
                ? `# ${role} 하네스\n\n에이전트에게 적용할 지시사항을 작성하세요.`
                : `// ${role} harness\n// 에이전트에게 적용할 지시사항을 작성하세요.`
            }
            className="h-full w-full resize-none bg-gray-900/[0.02] p-4 font-mono text-sm text-gray-900/75 placeholder-gray-900/15 outline-none dark:bg-white/[0.02] dark:text-white/75 dark:placeholder-white/15"
          />
        </div>
      )}

      {dirty && (
        <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
          저장되지 않은 변경사항이 있습니다
        </p>
      )}
    </div>
  );
}

// ─── HarnessModal ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HarnessModal({ open, onClose }: Props) {
  const [selectedRole, setSelectedRole] = useState<HarnessRole>("common");

  return (
    <Modal open={open} onClose={onClose} title="하네스 설정" maxWidth="max-w-3xl">
      <div className="flex gap-4" style={{ height: "480px" }}>
        {/* 역할 사이드바 */}
        <aside className="flex w-36 shrink-0 flex-col gap-0.5">
          {HARNESS_ROLES.map(({ role, label }) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                selectedRole === role
                  ? "bg-orange-500/[0.10] text-orange-600 dark:text-orange-400"
                  : "text-gray-900/40 hover:bg-gray-900/[0.04] hover:text-gray-900/70 dark:text-white/40 dark:hover:bg-white/[0.04] dark:hover:text-white/70",
              ].join(" ")}
            >
              <span className={selectedRole === role ? "text-orange-500 dark:text-orange-400" : "text-gray-900/25 dark:text-white/25"}>
                {ROLE_ICONS[role]}
              </span>
              {label}
            </button>
          ))}

          <div className="mt-3 border-t border-gray-900/[0.06] pt-3 dark:border-white/[0.06]">
            <p className="px-3 text-[10px] leading-relaxed text-gray-900/25 dark:text-white/25">
              하네스는 에이전트 실행 시 시스템 프롬프트에 자동 주입됩니다.
            </p>
          </div>
        </aside>

        {/* 구분선 */}
        <div className="w-px shrink-0 bg-gray-900/[0.06] dark:bg-white/[0.06]" />

        {/* 에디터 영역 */}
        <HarnessEditor key={selectedRole} role={selectedRole} />
      </div>
    </Modal>
  );
}
