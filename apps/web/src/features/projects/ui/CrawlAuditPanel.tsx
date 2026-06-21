"use client";

import { useMemo, useState } from "react";

import { useToast } from "@/lib/toast";

import type { HandoffAgentId } from "../api/agentHandoff.api";
import { issueKey, type CrawlIssue } from "../api/crawl.api";
import { useAgentHandoff } from "../hooks/useAgentHandoff";
import { useCrawlAudit } from "../hooks/useCrawlAudit";

interface CrawlAuditPanelProps {
  appUrl: string;
  projectPath: string | null;
}

type Verdict = "fixed" | "present";

const AGENTS: HandoffAgentId[] = ["codex", "claude", "gemini"];

function kindColor(kind: CrawlIssue["kind"]) {
  if (kind === "network") return "text-amber-600 dark:text-amber-300";
  if (kind === "rerender") return "text-violet-600 dark:text-violet-300";
  return "text-red-600 dark:text-red-300";
}

function kindLabel(kind: CrawlIssue["kind"]) {
  if (kind === "network") return "NET";
  if (kind === "exception") return "EXC";
  if (kind === "rerender") return "RDR";
  return "ERR";
}

function baseName(path?: string) {
  if (!path) return "";
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
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
  const { running, verifying, progress, report, error, run, verify } = useCrawlAudit();
  const { handoff, submittingAgent } = useAgentHandoff();
  const { addToast } = useToast();
  const [agentId, setAgentId] = useState<HandoffAgentId>("codex");
  const [dispatched, setDispatched] = useState<Map<string, CrawlIssue>>(new Map());
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [regressions, setRegressions] = useState<CrawlIssue[]>([]);

  const resetState = () => {
    setDispatched(new Map());
    setVerdicts({});
    setRegressions([]);
  };

  const startAudit = () => {
    resetState();
    void run(appUrl, projectPath);
  };

  const flatIssues = useMemo(
    () => (report ? report.routes.flatMap((r) => r.issues) : []),
    [report],
  );
  const fixable = useMemo(() => flatIssues.filter((i) => i.fileName), [flatIssues]);

  const dispatchOne = async (issue: CrawlIssue) => {
    try {
      if (!issue.fileName) return;
      const key = issueKey(issue);
      await handoff({
        agentId,
        request: buildPrompt(issue),
        projectPath,
        filePath: issue.fileName,
        line: issue.line,
        endLine: issue.endLine,
      });
      setDispatched((prev) => new Map(prev).set(key, issue));
      setVerdicts((prev) => {
        const next = { ...prev };
        delete next[key]; // 재디스패치 시 이전 판정 제거 → 재검증 유도
        return next;
      });
      addToast({ type: "success", title: "에이전트로 전달됨", message: issue.title.slice(0, 60) });
    } catch {
      addToast({ type: "error", title: "전달 실패", message: "다시 시도해 주세요" });
    }
  };

  const dispatchAll = async () => {
    for (const issue of fixable) {
      if (!dispatched.has(issueKey(issue))) await dispatchOne(issue);
    }
  };

  // 수정된 라우트만 재크롤 → 고쳐짐/그대로 판정 + 회귀(새 이슈) 감지
  const onVerify = async () => {
    const issues = Array.from(dispatched.values());
    const routes = Array.from(new Set(issues.map((i) => i.route)));
    const fresh = await verify(appUrl, projectPath, routes);
    if (!fresh) return;

    const freshIssues = fresh.routes.flatMap((r) => r.issues);
    const freshKeys = new Set(freshIssues.map(issueKey));
    const originalKeys = new Set(flatIssues.map(issueKey));

    const nextVerdicts: Record<string, Verdict> = {};
    for (const key of dispatched.keys())
      nextVerdicts[key] = freshKeys.has(key) ? "present" : "fixed";

    const regs = freshIssues.filter((i) => !originalKeys.has(issueKey(i)));

    setVerdicts(nextVerdicts);
    setRegressions(regs);

    const fixedCount = Object.values(nextVerdicts).filter((v) => v === "fixed").length;
    addToast({
      type: regs.length ? "error" : "success",
      title: "검증 완료",
      message: `고쳐짐 ${fixedCount}/${dispatched.size}${regs.length ? ` · 회귀 ${regs.length}` : ""}`,
    });
  };

  const busy = running || verifying || Boolean(submittingAgent);

  return (
    <div className="mt-3 border-t border-gray-900/[0.07] pt-3 dark:border-white/[0.07]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-900/65 dark:text-white/65">
          라우트 감사
        </span>
        <span className="text-[11px] text-gray-900/35 dark:text-white/35">
          순회 수집 → 에이전트 수정 → 재크롤 검증
        </span>
        <button
          type="button"
          disabled={busy || !appUrl.trim()}
          onClick={startAudit}
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
              disabled={fixable.length === 0 || busy}
              onClick={() => void dispatchAll()}
              className="flex h-7 cursor-pointer items-center rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              일괄 디스패치
            </button>
            <button
              type="button"
              disabled={dispatched.size === 0 || busy}
              onClick={() => void onVerify()}
              title="수정된 라우트만 재크롤해 고쳐짐/회귀 판정 (토큰 0)"
              className="flex h-7 cursor-pointer items-center rounded-md border border-gray-900/[0.12] px-2.5 text-[11px] font-semibold text-gray-900/70 transition-colors hover:bg-gray-900/[0.06] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.15] dark:text-white/70 dark:hover:bg-white/[0.08]"
            >
              {verifying ? "검증 중..." : "검증(재크롤)"}
            </button>
          </div>

          {regressions.length > 0 && (
            <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.08] px-2 py-1.5">
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-300">
                ⚠ 회귀 {regressions.length}건 — 수정 후 새로 생긴 이슈
              </p>
              {regressions.slice(0, 5).map((i, idx) => (
                <p
                  key={`reg-${idx}`}
                  className="mt-0.5 truncate text-[10px] text-red-600/80 dark:text-red-300/80"
                >
                  {i.route} · {i.title}
                </p>
              ))}
            </div>
          )}

          <div className="mt-2 max-h-72 space-y-2 overflow-auto">
            {report.routes
              .filter((r) => r.issues.length > 0)
              .map((r) => (
                <div key={r.route}>
                  <p className="font-mono text-[11px] text-gray-900/45 dark:text-white/45">
                    {r.route} · {r.issues.length}
                  </p>
                  {r.issues.map((issue, i) => {
                    const key = issueKey(issue);
                    const sent = dispatched.has(key);
                    const verdict = verdicts[key];
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
                        {verdict === "fixed" && (
                          <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                            ✓ 고쳐짐
                          </span>
                        )}
                        {verdict === "present" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void dispatchOne(issue)}
                            title="아직 남아있음 — 다시 디스패치"
                            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-500/[0.12] disabled:opacity-35 dark:text-red-300"
                          >
                            ✗ 다시
                          </button>
                        )}
                        {!verdict && (
                          <button
                            type="button"
                            disabled={!issue.fileName || sent || busy}
                            onClick={() => void dispatchOne(issue)}
                            title={issue.fileName ? "에이전트에게 전달" : "소스 위치 없음"}
                            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-35 dark:text-emerald-300"
                          >
                            {sent ? "보냄" : "에이전트"}
                          </button>
                        )}
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
