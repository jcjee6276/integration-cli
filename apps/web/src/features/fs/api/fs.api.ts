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

export async function fetchDirs(path?: string): Promise<DirListResult> {
  const url = new URL(`${SERVER_URL}/fs/dirs`);
  if (path) url.searchParams.set("path", path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDirectoryTree(path: string, maxDepth = 6): Promise<FsTreeResult> {
  const url = new URL(`${SERVER_URL}/fs/tree`);
  url.searchParams.set("path", path);
  url.searchParams.set("maxDepth", String(maxDepth));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
