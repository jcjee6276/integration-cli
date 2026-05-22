"use client";

import { useState } from "react";

import type { TaskAgent } from "../api/tasks.api";
import type { AgentChangelog, ChangelogFile, ChangeType } from "../api/changelog.api";
import { useTaskChangelog } from "../hooks/useTaskChangelog";

// ─── 변경 유형 뱃지 ──────────────────────────────────────────────────────────

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; className: string }> = {
  added:    { label: "추가", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  modified: { label: "수정", className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  deleted:  { label: "삭제", className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  renamed:  { label: "이동", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
};

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const cfg = CHANGE_TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Diff 렌더러 ─────────────────────────────────────────────────────────────

function DiffView({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  // diff --git 헤더 / index / --- / +++ 줄 건너뜀, hunk(@@ )부터 렌더
  const hunkStart = lines.findIndex((l) => l.startsWith("@@"));
  const diffLines = hunkStart >= 0 ? lines.slice(hunkStart) : lines;

  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-950/[0.03] p-3 text-[11px] leading-relaxed dark:bg-white/[0.03]">
      {diffLines.map((line, i) => {
        if (line.startsWith("@@")) {
          return (
            <div key={i} className="text-purple-500/70 dark:text-purple-400/70">
              {line}
            </div>
          );
        }
        if (line.startsWith("+")) {
          return (
            <div key={i} className="bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400">
              {line}
            </div>
          );
        }
        if (line.startsWith("-")) {
          return (
            <div key={i} className="bg-red-500/[0.08] text-red-700 dark:text-red-400">
              {line}
            </div>
          );
        }
        return (
          <div key={i} className="text-gray-900/50 dark:text-white/40">
            {line}
          </div>
        );
      })}
    </pre>
  );
}

// ─── 파일 행 ─────────────────────────────────────────────────────────────────

function FileRow({ file }: { file: ChangelogFile }) {
  const [open, setOpen] = useState(false);
  const fileName = file.filePath.split("/").pop() ?? file.filePath;
  const dirName = file.filePath.includes("/")
    ? file.filePath.slice(0, file.filePath.lastIndexOf("/"))
    : "";

  return (
    <div className="overflow-hidden rounded-lg border border-gray-900/[0.07] dark:border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-900/[0.02] dark:hover:bg-white/[0.02]"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3 w-3 shrink-0 text-gray-900/20 transition-transform dark:text-white/20 ${open ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>

        <ChangeTypeBadge type={file.changeType} />

        <span className="min-w-0 flex-1 truncate">
          {dirName && (
            <span className="text-gray-900/30 dark:text-white/30">{dirName}/</span>
          )}
          <span className="font-medium text-gray-900/70 dark:text-white/70">{fileName}</span>
        </span>

        <span className="shrink-0 text-[10px] text-gray-900/20 dark:text-white/20">
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

      {open && file.patch && (
        <div className="border-t border-gray-900/[0.05] dark:border-white/[0.05]">
          <DiffView patch={file.patch} />
        </div>
      )}
    </div>
  );
}

// ─── 에이전트 섹션 ────────────────────────────────────────────────────────────

function AgentSection({
  changelog,
  agent,
}: {
  changelog: AgentChangelog;
  agent: TaskAgent | undefined;
}) {
  const totalAdditions = changelog.files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = changelog.files.reduce((s, f) => s + f.deletions, 0);

  const agentLabel = agent
    ? `${agent.agentType.charAt(0).toUpperCase() + agent.agentType.slice(1)} · ${agent.customRole ?? agent.role}`
    : `Agent ${changelog.agentId}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-900/60 dark:text-white/60">
          {agentLabel}
        </span>
        <span className="text-[10px] text-gray-900/25 dark:text-white/25">
          {changelog.files.length}개 파일
          {totalAdditions > 0 && (
            <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">+{totalAdditions}</span>
          )}
          {totalDeletions > 0 && (
            <span className="ml-0.5 text-red-600 dark:text-red-400">-{totalDeletions}</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {changelog.files.map((file) => (
          <FileRow key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
}

// ─── ChangelogPanel ───────────────────────────────────────────────────────────

interface Props {
  taskId: string;
  agents: TaskAgent[];
}

export function ChangelogPanel({ taskId, agents }: Props) {
  const { changelogs, loading, error } = useTaskChangelog(taskId);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg border border-gray-900/[0.05] bg-gray-900/[0.02] dark:border-white/[0.05] dark:bg-white/[0.02]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (changelogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/15 dark:text-white/15">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-xs text-gray-900/30 dark:text-white/30">
          변경사항이 없거나 Git 저장소가 아닙니다
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {changelogs.map((changelog) => (
        <AgentSection
          key={changelog.agentId}
          changelog={changelog}
          agent={agents.find((a) => a.id === changelog.agentId)}
        />
      ))}
    </div>
  );
}
