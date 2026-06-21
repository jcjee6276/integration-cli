"use client";

import { useMemo, useState } from "react";

import { useToast } from "@/lib/toast";

import type { HandoffAgentId } from "../api/agentHandoff.api";
import type { CrawlIssue } from "../api/crawl.api";
import { useAgentHandoff } from "../hooks/useAgentHandoff";
import { useCrawlAudit } from "../hooks/useCrawlAudit";

interface CrawlAuditPanelProps {
  appUrl: string;
  projectPath: string | null;
}

const AGENTS: HandoffAgentId[] = ["codex", "claude", "gemini"];

function kindColor(kind: CrawlIssue["kind"]) {
  if (kind === "network") return "text-amber-600 dark:text-amber-300";
  return "text-red-600 dark:text-red-300";
}

function kindLabel(kind: CrawlIssue["kind"]) {
  if (kind === "network") return "NET";
  if (kind === "exception") return "EXC";
  return "ERR";
}

function baseName(path?: string) {
  if (!path) return "";
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

function issueKey(issue: CrawlIssue, index: number) {
  return `${issue.route}:${issue.kind}:${index}`;
}

function buildPrompt(issue: CrawlIssue) {
  const lines = [
    `다음 ${issue.kind} 이슈를 진단하고 고쳐줘.`,
    `라우트: ${issue.route}`,
    `내용: ${issue.title}`,
  ];
  if (issue.fileName) lines.push(`위치: ${issue.fileName}${issue.line ? `:${issue.line}` : ""}`);
  if (issue.url) lines.push(`요청: ${issue.url}`);
  if (issue.detail && issue.detail !== issue.title) lines.push(`상세:\n${issue.detail}`);
  return lines.join("\n");
}

export function CrawlAuditPanel({ appUrl, projectPath }: CrawlAuditPanelProps) {
  const { running, progress, report, error, run } = useCrawlAudit();
  const { handoff, submittingAgent } = useAgentHandoff();
  const { addToast } = useToast();
  const [agentId, setAgentId] = useState<HandoffAgentId>("codex");
  const [dispatched, setDispatched] = useState<Set<string>>(new Set());

  const flatIssues = useMemo(
    () => (report ? report.routes.flatMap((r) => r.issues) : []),
    [report],
  );
  const fixable = useMemo(() => flatIssues.filter((i) => i.fileName), [flatIssues]);

  const dispatchOne = async (issue: CrawlIssue, key: string) => {
    try {
      if (!issue.fileName) return;
      await handoff({
        agentId,
        request: buildPrompt(issue),
        projectPath,
        filePath: issue.fileName,
        line: issue.line,
        endLine: issue.endLine,
      });
      setDispatched((prev) => new Set(prev).add(key));
      addToast({ type: "success", title: "에이전트로 전달됨", message: issue.title.slice(0, 60) });
    } catch {
      addToast({ type: "error", title: "전달 실패", message: "다시 시도해 주세요" });
    }
  };

  const dispatchAll = async () => {
    for (let i = 0; i < flatIssues.length; i++) {
      const issue = flatIssues[i];
      const key = issueKey(issue, i);
      if (issue.fileName && !dispatched.has(key)) await dispatchOne(issue, key);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-900/[0.07] pt-3 dark:border-white/[0.07]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-900/65 dark:text-white/65">
          라우트 감사
        </span>
        <span className="text-[11px] text-gray-900/35 dark:text-white/35">
          모든 라우트를 순회해 콘솔 에러·예외·실패 요청 수집
        </span>
        <button
          type="button"
          disabled={running || !appUrl.trim()}
          onClick={() => void run(appUrl, projectPath)}
          className="ml-auto flex h-8 cursor-pointer items-center justify-center rounded-lg bg-gray-900/[0.06] px-3 text-xs font-semibold text-gray-900/70 transition-colors hover:bg-gray-900/[0.1] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.12]"
        >
          {running ? "감사 중..." : "감사 실행"}
        </button>
      </div>

      {running && progress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-gray-900/45 dark:text-white/45">
            <span className="truncate font-mono">{progress.route}</span>
            <span>
              {progress.index}/{progress.total}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-900/[0.08] dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(progress.index / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">{error}</p>}

      {report && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-900/55 dark:text-white/55">
              {report.totalIssues}개 이슈 · 수정 가능 {fixable.length}건
            </span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value as HandoffAgentId)}
              className="ml-auto h-7 rounded-md border border-gray-900/[0.09] bg-white px-1.5 text-[11px] text-gray-900/70 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-white/70"
            >
              {AGENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={fixable.length === 0 || Boolean(submittingAgent)}
              onClick={() => void dispatchAll()}
              className="flex h-7 cursor-pointer items-center rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              일괄 디스패치
            </button>
          </div>

          <div className="mt-2 max-h-72 space-y-2 overflow-auto">
            {report.routes
              .filter((r) => r.issues.length > 0)
              .map((r) => (
                <div key={r.route}>
                  <p className="font-mono text-[11px] text-gray-900/45 dark:text-white/45">
                    {r.route} · {r.issues.length}
                  </p>
                  {r.issues.map((issue, i) => {
                    const key = issueKey(issue, flatIssues.indexOf(issue));
                    const sent = dispatched.has(key);
                    return (
                      <div
                        key={`${r.route}-${i}`}
                        className="mt-1 flex items-start gap-2 rounded-md border border-gray-900/[0.06] bg-white/50 px-2 py-1.5 dark:border-white/[0.06] dark:bg-white/[0.02]"
                      >
                        <span className={`shrink-0 text-[10px] font-bold ${kindColor(issue.kind)}`}>
                          {kindLabel(issue.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] text-gray-900/70 dark:text-white/70">
                            {issue.title}
                          </p>
                          {(issue.fileName || issue.url) && (
                            <p className="truncate font-mono text-[10px] text-gray-900/35 dark:text-white/35">
                              {issue.fileName
                                ? `${baseName(issue.fileName)}${issue.line ? `:${issue.line}` : ""}`
                                : issue.url}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!issue.fileName || sent || Boolean(submittingAgent)}
                          onClick={() => void dispatchOne(issue, key)}
                          title={issue.fileName ? "에이전트에게 전달" : "소스 위치 없음"}
                          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-35 dark:text-emerald-300"
                        >
                          {sent ? "보냄" : "에이전트"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
