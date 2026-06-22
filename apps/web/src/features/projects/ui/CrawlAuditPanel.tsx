"use client";

import { useEffect, useMemo, useState } from "react";

import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
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
const FRAMEWORK_COMPONENTS = [
  "OuterLayoutRouter",
  "SegmentViewNode",
  "__next_metadata_boundary__",
  "__next_viewport_boundary__",
  "__next_root_layout_boundary__",
  "__next_outlet_boundary__",
];

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

function isFrameworkIssue(issue: CrawlIssue) {
  try {
    const title = issue.title.toLowerCase();
    const fileName = issue.fileName?.replace(/\\/g, "/").toLowerCase() ?? "";
    return (
      FRAMEWORK_COMPONENTS.some((name) => issue.title.includes(name)) ||
      fileName.includes("/node_modules/next/") ||
      fileName.includes("/.next/") ||
      fileName.includes("/next/dist/") ||
      title.includes("layout-router") ||
      title.includes("segment-explorer")
    );
  } catch {
    return false;
  }
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
  const {
    running,
    verifying,
    progress,
    report,
    error,
    routePreview,
    routesLoading,
    routesError,
    loadRoutes,
    run,
    verify,
  } = useCrawlAudit();
  const { handoff, handoffBatch, submittingAgent } = useAgentHandoff();
  const { addToast } = useToast();
  const [agentId, setAgentId] = useState<HandoffAgentId>("codex");
  const [dispatched, setDispatched] = useState<Map<string, CrawlIssue>>(new Map());
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [regressions, setRegressions] = useState<CrawlIssue[]>([]);
  const [showFrameworkIssues, setShowFrameworkIssues] = useState(false);
  // 감사 디렉토리: 기본은 스캔된 프로젝트 루트, 사용자가 별도 선택하면 override
  const [auditDirOverride, setAuditDirOverride] = useState<string | null>(null);
  const auditDir = auditDirOverride ?? projectPath ?? "";
  // 라우트 선택: null = 전체 선택(기본)
  const [routeSelection, setRouteSelection] = useState<Set<string> | null>(null);

  const isRouteSelected = (route: string) => (routeSelection ? routeSelection.has(route) : true);
  const selectedRoutes = routePreview.filter(isRouteSelected);

  const toggleRoute = (route: string) => {
    setRouteSelection((prev) => {
      const base = prev ?? new Set(routePreview);
      const next = new Set(base);
      if (next.has(route)) next.delete(route);
      else next.add(route);
      return next;
    });
  };
  const toggleAllRoutes = () => {
    setRouteSelection((prev) => {
      const allSelected = !prev || prev.size >= routePreview.length;
      return allSelected ? new Set<string>() : null;
    });
  };

  const resetState = () => {
    setDispatched(new Map());
    setVerdicts({});
    setRegressions([]);
  };

  const startAudit = () => {
    if (selectedRoutes.length === 0) {
      addToast({ type: "error", title: "라우트 미선택", message: "감사할 라우트를 선택하세요" });
      return;
    }
    resetState();
    void run(appUrl, auditDir, selectedRoutes);
  };

  const onAuditDirChange = (dir: string) => {
    setAuditDirOverride(dir);
    setRouteSelection(null); // 디렉토리 바뀌면 라우트 선택 초기화(전체)
    void loadRoutes(dir);
  };

  useEffect(() => {
    try {
      void loadRoutes(auditDir);
    } catch {}
  }, [loadRoutes, auditDir]);

  const flatIssues = useMemo(
    () => (report ? report.routes.flatMap((r) => r.issues) : []),
    [report],
  );
  const frameworkIssues = useMemo(() => flatIssues.filter(isFrameworkIssue), [flatIssues]);
  const visibleIssueKeys = useMemo(() => {
    try {
      return new Set(
        flatIssues
          .filter((issue) => showFrameworkIssues || !isFrameworkIssue(issue))
          .map((issue) => issueKey(issue)),
      );
    } catch {
      return new Set<string>();
    }
  }, [flatIssues, showFrameworkIssues]);
  const visibleIssues = useMemo(
    () => flatIssues.filter((issue) => visibleIssueKeys.has(issueKey(issue))),
    [flatIssues, visibleIssueKeys],
  );
  const fixable = useMemo(() => visibleIssues.filter((i) => i.fileName), [visibleIssues]);

  const dispatchOne = async (issue: CrawlIssue) => {
    try {
      if (!issue.fileName) return;
      const key = issueKey(issue);
      await handoff({
        agentId,
        request: buildPrompt(issue),
        projectPath: auditDir || projectPath,
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

  // 일괄: 에이전트 세션 1개에 모든 이슈를 단일 프롬프트로 — 일관성↑·토큰↓
  const dispatchAll = async () => {
    const pending = fixable.filter((i) => !dispatched.has(issueKey(i)));
    if (pending.length === 0) return;
    try {
      await handoffBatch({
        agentId,
        projectPath: auditDir || projectPath,
        items: pending.map((i) => ({
          title: i.title,
          route: i.route,
          filePath: i.fileName,
          line: i.line,
          endLine: i.endLine,
          detail: i.detail,
        })),
      });
      setDispatched((prev) => {
        const next = new Map(prev);
        for (const i of pending) next.set(issueKey(i), i);
        return next;
      });
      setVerdicts((prev) => {
        const next = { ...prev };
        for (const i of pending) delete next[issueKey(i)];
        return next;
      });
      addToast({
        type: "success",
        title: "일괄 디스패치",
        message: `${pending.length}건을 세션 1개로 전달`,
      });
    } catch {
      addToast({ type: "error", title: "일괄 전달 실패", message: "다시 시도해 주세요" });
    }
  };

  // 수정된 라우트만 재크롤 → 고쳐짐/그대로 판정 + 회귀(새 이슈) 감지
  const onVerify = async () => {
    const issues = Array.from(dispatched.values());
    const routes = Array.from(new Set(issues.map((i) => i.route)));
    const fresh = await verify(appUrl, auditDir || projectPath, routes);
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
  const crawledRoutes = report?.routes.map((route) => route.route) ?? [];

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

      <div className="mt-2 rounded-lg border border-gray-900/[0.06] bg-white/45 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {/* 감사 디렉토리 — 프로젝트 루트와 분리해서 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-900/55 dark:text-white/55">
            감사 디렉토리
          </span>
          {projectPath && auditDir !== projectPath && (
            <button
              type="button"
              onClick={() => onAuditDirChange(projectPath)}
              className="text-[10px] text-gray-900/40 underline-offset-2 hover:underline dark:text-white/40"
            >
              프로젝트 루트로
            </button>
          )}
        </div>
        <div className="mt-1">
          <WorkingDirPicker value={auditDir} onChange={onAuditDirChange} variant="field" />
        </div>

        {/* 라우트 선택 — 원하는 라우트만 감사 */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-900/55 dark:text-white/55">
              라우트 선택
            </span>
            <span className="text-[10px] text-gray-900/30 dark:text-white/30">
              {routesLoading
                ? "조회 중..."
                : `${selectedRoutes.length}/${routePreview.length} 선택`}
            </span>
            {routesError && (
              <span className="text-[10px] text-red-600 dark:text-red-300">{routesError}</span>
            )}
            {routePreview.length > 0 && (
              <button
                type="button"
                onClick={toggleAllRoutes}
                className="ml-auto cursor-pointer rounded-md border border-gray-900/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-gray-900/45 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
              >
                {selectedRoutes.length === routePreview.length ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>
          <div className="mt-1 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {routePreview.map((route) => {
              const sel = isRouteSelected(route);
              return (
                <button
                  key={route}
                  type="button"
                  onClick={() => toggleRoute(route)}
                  title={sel ? "선택 해제" : "선택"}
                  className={[
                    "cursor-pointer rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                    sel
                      ? "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300"
                      : "border-gray-900/[0.06] bg-gray-900/[0.02] text-gray-900/35 hover:bg-gray-900/[0.05] dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white/35 dark:hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {sel ? "✓ " : ""}
                  {route}
                </button>
              );
            })}
            {!routesLoading && routePreview.length === 0 && (
              <span className="text-[10px] text-gray-900/30 dark:text-white/30">라우트 없음</span>
            )}
          </div>
        </div>
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
              {visibleIssues.length}개 표시 · 전체 {report.totalIssues}개 · 수정 가능{" "}
              {fixable.length}건
            </span>
            {frameworkIssues.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFrameworkIssues((value) => !value)}
                title="Next 내부 라우터/메타데이터 boundary 같은 프레임워크 이슈 표시 전환"
                className="cursor-pointer rounded-md border border-gray-900/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-gray-900/45 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 dark:border-white/[0.08] dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
              >
                {showFrameworkIssues ? "프레임워크 숨김" : `프레임워크 ${frameworkIssues.length}건`}
              </button>
            )}
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

          <div className="mt-2 rounded-md border border-gray-900/[0.06] bg-gray-900/[0.02] px-2 py-1.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <p className="text-[11px] font-semibold text-gray-900/50 dark:text-white/50">
              실제 검사 라우트 {crawledRoutes.length}개
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {crawledRoutes.map((route) => (
                <span
                  key={route}
                  className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-900/45 dark:bg-white/[0.05] dark:text-white/45"
                >
                  {route}
                </span>
              ))}
            </div>
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
            {visibleIssues.length === 0 && (
              <div className="rounded-md border border-gray-900/[0.06] bg-white/50 px-2 py-2 text-[11px] text-gray-900/40 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white/40">
                {flatIssues.length === 0
                  ? "감지된 이슈가 없습니다. 위의 실제 검사 라우트가 기대한 화면을 포함하는지 확인해 주세요."
                  : "프레임워크 이슈만 감지되어 기본 목록에서는 숨겨졌습니다."}
              </div>
            )}
            {report.routes
              .map((route) => ({
                ...route,
                issues: route.issues.filter((issue) => visibleIssueKeys.has(issueKey(issue))),
              }))
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
