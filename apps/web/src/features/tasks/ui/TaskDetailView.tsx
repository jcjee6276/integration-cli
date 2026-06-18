"use client";

import { useState } from "react";

import type { AgentChangelog, ChangelogFile } from "../api/changelog.api";
import type { AgentRole, Task, TaskAgent, TaskAgentRun } from "../api/tasks.api";
import type { DetailStatusFilter, DetailVersion } from "../hooks/useTaskDetail";
import { useTaskDetail } from "../hooks/useTaskDetail";
import { AgentRoleBadge } from "./AgentRoleSelect";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  running: "실행 중",
  completed: "완료",
  error: "오류",
  stopped: "중지",
};

const ROLE_LABEL: Record<AgentRole, string> = {
  frontend: "Frontend",
  backend: "Backend",
  doc: "Document",
  operation: "Operation",
  other: "Other",
};

const CHANGE_LABEL: Record<string, string> = {
  added: "추가",
  modified: "수정",
  deleted: "삭제",
  renamed: "이동",
};

function SummaryBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions;
  const ratio = total > 0 ? (additions / total) * 100 : 50;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">+{additions}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-900/[0.06] dark:bg-white/[0.06]">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio}%` }} />
      </div>
      <span className="font-mono text-[11px] text-red-600 dark:text-red-400">-{deletions}</span>
    </div>
  );
}

interface FilterBarProps {
  agents: TaskAgent[];
  roleOptions: AgentRole[];
  runs: DetailVersion["run"][];
  agentFilter: "all" | number;
  roleFilter: "all" | AgentRole;
  statusFilter: DetailStatusFilter;
  versionFilter: "all" | number;
  onAgentChange: (value: "all" | number) => void;
  onRoleChange: (value: "all" | AgentRole) => void;
  onStatusChange: (value: DetailStatusFilter) => void;
  onVersionChange: (value: "all" | number) => void;
}

function FilterBar({
  agents,
  roleOptions,
  runs,
  agentFilter,
  roleFilter,
  statusFilter,
  versionFilter,
  onAgentChange,
  onRoleChange,
  onStatusChange,
  onVersionChange,
}: FilterBarProps) {
  const statusFilters: { value: DetailStatusFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "error", label: "오류" },
    { value: "completed", label: "완료" },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-900/[0.07] bg-white/60 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-gray-900/35 dark:text-white/35">버전</span>
          <select
            value={versionFilter}
            onChange={(event) => onVersionChange(event.target.value === "all" ? "all" : Number(event.target.value))}
            className="rounded-lg border border-gray-900/[0.08] bg-white px-2.5 py-1.5 text-xs text-gray-900/70 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
          >
            <option value="all">전체 버전</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>v{run.version}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-gray-900/35 dark:text-white/35">에이전트</span>
          <select
            value={agentFilter}
            onChange={(event) => onAgentChange(event.target.value === "all" ? "all" : Number(event.target.value))}
            className="rounded-lg border border-gray-900/[0.08] bg-white px-2.5 py-1.5 text-xs text-gray-900/70 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
          >
            <option value="all">전체 에이전트</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.customRole ?? ROLE_LABEL[agent.role]} #{agent.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-gray-900/35 dark:text-white/35">역할</span>
          <select
            value={roleFilter}
            onChange={(event) => onRoleChange(event.target.value as "all" | AgentRole)}
            className="rounded-lg border border-gray-900/[0.08] bg-white px-2.5 py-1.5 text-xs text-gray-900/70 outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
          >
            <option value="all">전체 역할</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{ROLE_LABEL[role]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.02] p-0.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onStatusChange(filter.value)}
            className={[
              "cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              statusFilter === filter.value
                ? "bg-white text-gray-900/70 shadow-sm dark:bg-white/[0.08] dark:text-white/70"
                : "text-gray-900/35 hover:text-gray-900/60 dark:text-white/35 dark:hover:text-white/60",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentRunBadge({ agentRun, agent }: { agentRun: TaskAgentRun; agent: TaskAgent | undefined }) {
  const isError = agentRun.status === "error";
  const isCompleted = agentRun.status === "completed";
  return (
    <span className={[
      "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium",
      isError
        ? "border-red-500/20 bg-red-500/[0.06] text-red-600 dark:text-red-400"
        : isCompleted
          ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-600 dark:text-emerald-400"
          : "border-gray-900/[0.08] bg-gray-900/[0.03] text-gray-900/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40",
    ].join(" ")}>
      {agent ? <AgentRoleBadge role={agent.role} customRole={agent.customRole} /> : `Agent ${agentRun.agentId}`}
      <span className="opacity-70">{STATUS_LABEL[agentRun.status] ?? agentRun.status}</span>
    </span>
  );
}

function PatchPreview({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  const hunkStart = lines.findIndex((line) => line.startsWith("@@"));
  const visible = (hunkStart >= 0 ? lines.slice(hunkStart) : lines).slice(0, 80);

  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-950/[0.03] p-3 text-[11px] leading-relaxed dark:bg-white/[0.03]">
      {visible.map((line, index) => {
        const className = line.startsWith("+")
          ? "bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400"
          : line.startsWith("-")
            ? "bg-red-500/[0.08] text-red-700 dark:text-red-400"
            : line.startsWith("@@")
              ? "text-purple-500/70 dark:text-purple-400/70"
              : "text-gray-900/50 dark:text-white/40";
        return <div key={`${line}-${index}`} className={className}>{line}</div>;
      })}
    </pre>
  );
}

function FileChangeRow({ file }: { file: ChangelogFile }) {
  const [open, setOpen] = useState(false);
  const name = file.filePath.split(/[\\/]/).pop() ?? file.filePath;
  const dir = file.filePath.includes("/") ? file.filePath.slice(0, file.filePath.lastIndexOf("/")) : "";

  return (
    <div className="overflow-hidden rounded-lg border border-gray-900/[0.07] dark:border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3 w-3 shrink-0 text-gray-900/20 transition-transform dark:text-white/20 ${open ? "rotate-90" : ""}`}>
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
        <span className="rounded-md border border-gray-900/[0.08] px-1.5 py-0.5 text-[10px] text-gray-900/45 dark:border-white/[0.08] dark:text-white/45">
          {CHANGE_LABEL[file.changeType] ?? file.changeType}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs">
          {dir && <span className="text-gray-900/30 dark:text-white/30">{dir}/</span>}
          <span className="font-medium text-gray-900/70 dark:text-white/70">{name}</span>
        </span>
        <span className="shrink-0 font-mono text-[10px]">
          {file.additions > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>}
          {file.additions > 0 && file.deletions > 0 && <span className="mx-0.5 text-gray-900/15 dark:text-white/15">/</span>}
          {file.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>}
        </span>
      </button>
      {open && file.patch && (
        <div className="border-t border-gray-900/[0.05] dark:border-white/[0.05]">
          <PatchPreview patch={file.patch} />
        </div>
      )}
    </div>
  );
}

function ChangeSection({ changelogs }: { changelogs: AgentChangelog[] }) {
  const files = changelogs.flatMap((entry) => entry.files);

  if (files.length === 0) {
    return <p className="rounded-lg border border-gray-900/[0.06] py-5 text-center text-xs text-gray-900/30 dark:border-white/[0.06] dark:text-white/30">변경 사항이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {files.map((file) => <FileChangeRow key={file.id} file={file} />)}
    </div>
  );
}

function LogSection({ logsByAgent, agents }: { logsByAgent: Record<number, string>; agents: TaskAgent[] }) {
  const entries = Object.entries(logsByAgent);

  if (entries.length === 0) {
    return <p className="rounded-lg border border-gray-900/[0.06] py-5 text-center text-xs text-gray-900/30 dark:border-white/[0.06] dark:text-white/30">실행 로그가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([agentId, output]) => {
        const agent = agents.find((entry) => entry.id === Number(agentId));
        return (
          <div key={agentId} className="overflow-hidden rounded-lg border border-gray-900/[0.07] dark:border-white/[0.07]">
            <div className="flex items-center justify-between border-b border-gray-900/[0.05] px-3 py-2 dark:border-white/[0.05]">
              {agent ? <AgentRoleBadge role={agent.role} customRole={agent.customRole} /> : <span className="text-xs text-gray-900/50 dark:text-white/50">Agent {agentId}</span>}
            </div>
            <pre className="max-h-64 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
              {output}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function VersionCard({ version, agents, latest }: { version: DetailVersion; agents: TaskAgent[]; latest: boolean }) {
  const [open, setOpen] = useState(latest);
  const duration = version.run.completedAt
    ? Math.round((new Date(version.run.completedAt).getTime() - new Date(version.run.startedAt).getTime()) / 1000)
    : null;

  return (
    <article className={[
      "overflow-hidden rounded-xl border transition-colors",
      latest
        ? "border-blue-500/20 bg-blue-500/[0.04]"
        : "border-gray-900/[0.07] bg-white/50 dark:border-white/[0.07] dark:bg-white/[0.02]",
    ].join(" ")}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3 w-3 shrink-0 text-gray-900/20 transition-transform dark:text-white/20 ${open ? "rotate-90" : ""}`}>
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">v{version.run.version}</span>
          {latest && <span className="text-[10px] text-blue-500/70 dark:text-blue-400/70">최신</span>}
          <span className="truncate text-xs text-gray-900/45 dark:text-white/45">
            {new Date(version.run.startedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-gray-900/30 dark:text-white/30">
          {duration != null && <span>{duration}s</span>}
          <span>{version.fileCount} 파일</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">+{version.additions}</span>
          <span className="font-mono text-red-600 dark:text-red-400">-{version.deletions}</span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-gray-900/[0.05] px-4 py-4 dark:border-white/[0.05]">
          <div className="flex flex-wrap gap-1.5">
            {version.run.agentRuns.map((agentRun) => (
              <AgentRunBadge key={agentRun.id} agentRun={agentRun} agent={agents.find((agent) => agent.id === agentRun.agentId)} />
            ))}
          </div>

          {version.run.supplementNote && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-xs text-amber-700/80 dark:text-amber-400/80">
              <span className="mr-1 font-medium">보완 메시지:</span>
              {version.run.supplementNote}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-xs font-semibold text-gray-900/55 dark:text-white/55">실행 로그</h3>
              <LogSection logsByAgent={version.logsByAgent} agents={agents} />
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-xs font-semibold text-gray-900/55 dark:text-white/55">변경 사항</h3>
              <ChangeSection changelogs={version.changelogs} />
            </section>
          </div>
        </div>
      )}
    </article>
  );
}

interface Props {
  task: Task;
}

export function TaskDetailView({ task }: Props) {
  const detail = useTaskDetail(task);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-gray-900/80 dark:text-white/80">{task.title}</h1>
          <p className="mt-1 font-mono text-[11px] text-gray-900/30 dark:text-white/30">{task.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-2.5 py-1.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
          <span className="text-[11px] text-gray-900/40 dark:text-white/40">{detail.totals.versions} 버전</span>
          <span className="text-gray-900/10 dark:text-white/10">/</span>
          <span className="text-[11px] text-gray-900/40 dark:text-white/40">{detail.totals.files} 파일</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-900/[0.07] bg-white/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-medium text-gray-900/40 dark:text-white/40">변경 통계</p>
          <p className="text-[10px] text-gray-900/30 dark:text-white/30">
            완료 {detail.totals.completed} / 오류 {detail.totals.errors}
          </p>
        </div>
        <SummaryBar additions={detail.totals.additions} deletions={detail.totals.deletions} />
      </div>

      <FilterBar
        agents={task.agents}
        roleOptions={detail.roleOptions}
        runs={detail.runs}
        agentFilter={detail.agentFilter}
        roleFilter={detail.roleFilter}
        statusFilter={detail.statusFilter}
        versionFilter={detail.versionFilter}
        onAgentChange={detail.setAgentFilter}
        onRoleChange={detail.setRoleFilter}
        onStatusChange={detail.setStatusFilter}
        onVersionChange={detail.setVersionFilter}
      />

      {detail.loading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-900/[0.05] bg-white/50 dark:border-white/[0.05] dark:bg-white/[0.03]" />
          ))}
        </div>
      )}

      {detail.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {detail.error}
        </p>
      )}

      {!detail.loading && !detail.error && detail.filteredVersions.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-900/[0.06] py-12 text-center dark:border-white/[0.06]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/15 dark:text-white/15">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-900/30 dark:text-white/30">필터 조건에 맞는 실행 기록이 없습니다.</p>
        </div>
      )}

      {!detail.loading && !detail.error && detail.filteredVersions.length > 0 && (
        <div className="flex flex-col gap-2">
          {detail.filteredVersions.map((version, index) => (
            <VersionCard
              key={version.run.id}
              version={version}
              agents={task.agents}
              latest={detail.versionFilter === "all" ? index === 0 : version.run.id === detail.versions[0]?.run.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
