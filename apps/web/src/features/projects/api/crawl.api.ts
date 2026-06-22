import { SERVER_URL } from "@/lib/constants";

export type CrawlIssueKind = "console-error" | "exception" | "network" | "rerender";

export interface CrawlIssue {
  route: string;
  kind: CrawlIssueKind;
  title: string;
  detail?: string;
  fileName?: string;
  line?: number;
  endLine?: number;
  url?: string;
  status?: number;
}

export interface CrawlRouteResult {
  route: string;
  url: string;
  issues: CrawlIssue[];
  error?: string;
}

export interface CrawlReport {
  appUrl: string;
  routes: CrawlRouteResult[];
  totalIssues: number;
}

export interface CrawlProgress {
  index: number;
  total: number;
  route: string;
  issueCount: number;
}

/** 크롤 간 동일 이슈를 매칭하기 위한 안정 키 (라우트+종류+식별 텍스트) */
export function issueKey(issue: CrawlIssue): string {
  if (issue.kind === "network") return `${issue.route}|network|${issue.url ?? issue.title}`;
  return `${issue.route}|${issue.kind}|${issue.title}`;
}

export async function runCrawl(input: {
  appUrl: string;
  projectPath?: string | null;
  routes?: string[];
}): Promise<CrawlReport> {
  const res = await fetch(`${SERVER_URL}/inspector/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appUrl: input.appUrl,
      projectPath: input.projectPath ?? undefined,
      routes: input.routes,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function discoverCrawlRoutes(input: {
  projectPath?: string | null;
}): Promise<string[]> {
  const res = await fetch(`${SERVER_URL}/inspector/crawl/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appUrl: "http://localhost",
      projectPath: input.projectPath ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { routes?: string[] };
  return data.routes?.length ? data.routes : ["/"];
}
