import { SERVER_URL } from "@/lib/constants";

export interface DirListResult {
  path: string;
  dirs: string[];
}

export async function fetchDirs(path?: string): Promise<DirListResult> {
  const url = new URL(`${SERVER_URL}/fs/dirs`);
  if (path) url.searchParams.set("path", path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
