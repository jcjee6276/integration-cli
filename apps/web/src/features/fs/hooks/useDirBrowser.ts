"use client";

import { useCallback, useState } from "react";

import { fetchDirs } from "../api/fs.api";

export interface DirBrowserState {
  open: boolean;
  currentPath: string;
  dirs: string[];
  loading: boolean;
}

export function useDirBrowser() {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const navigate = useCallback(async (path?: string) => {
    setLoading(true);
    try {
      const result = await fetchDirs(path);
      setCurrentPath(result.path);
      setDirs(result.dirs);
    } catch {
      setDirs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openBrowser = useCallback(
    async (initialPath?: string) => {
      setOpen(true);
      await navigate(initialPath || undefined);
    },
    [navigate],
  );

  const closeBrowser = useCallback(() => setOpen(false), []);

  const navigateUp = useCallback(() => {
    const sep = currentPath.includes("/") ? "/" : "\\";
    const idx = currentPath.lastIndexOf(sep);
    if (idx > 0) void navigate(currentPath.slice(0, idx));
  }, [currentPath, navigate]);

  return { open, currentPath, dirs, loading, navigate, openBrowser, closeBrowser, navigateUp };
}
