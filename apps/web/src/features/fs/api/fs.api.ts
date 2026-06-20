import { SERVER_URL } from "@/lib/constants";

export interface DirListResult {
  path: string;
  dirs: string[];
}

export type FsTreeNodeType = "directory" | "file";

export interface FsTreeNode {
  name: string;
  path: string;
  type: FsTreeNodeType;
  children?: FsTreeNode[];
  truncated?: boolean;
  error?: string;
}

export interface FsTreeResult {
  root: FsTreeNode;
  maxDepth: number;
  totalNodes: number;
  truncated: boolean;
}

export interface FsFileResult {
  name: string;
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

export interface FsOpenFileResult {
  ok: boolean;
  path: string;
  opener?: string;
  error?: string;
}

export async function fetchDirs(path?: string): Promise<DirListResult> {
  const url = new URL(`${SERVER_URL}/fs/dirs`);
  if (path) url.searchParams.set("path", path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDirectoryTree(path: string, maxDepth = 10): Promise<FsTreeResult> {
  const url = new URL(`${SERVER_URL}/fs/tree`);
  url.searchParams.set("path", path);
  url.searchParams.set("maxDepth", String(maxDepth));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchFileContent(path: string): Promise<FsFileResult> {
  const url = new URL(`${SERVER_URL}/fs/file`);
  url.searchParams.set("path", path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function openFileInIde(input: {
  path: string;
  projectPath?: string | null;
  line?: number | null;
  column?: number | null;
}): Promise<FsOpenFileResult> {
  const res = await fetch(`${SERVER_URL}/fs/file/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
