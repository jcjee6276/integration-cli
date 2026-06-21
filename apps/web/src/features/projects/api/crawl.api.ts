import { SERVER_URL } from "@/lib/constants";

export type CrawlIssueKind = "console-error" | "exception" | "network";

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
