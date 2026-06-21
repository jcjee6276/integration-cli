"use client";

import { useCallback, useState } from "react";

import { fetchFileImporters } from "@/features/fs/api/fs.api";
import type { FsImportersResult } from "@/features/fs/api/fs.api";

export function useImpactCoupling() {
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [resultByPath, setResultByPath] = useState<Record<string, FsImportersResult>>({});
  const [error, setError] = useState<string | null>(null);

  const loadImporters = useCallback(async (root: string | null, filePath: string | null) => {
    try {
      if (!root || !filePath) return null;
      setError(null);
      setLoadingPath(filePath);
      const result = await fetchFileImporters({ root, path: filePath });
      setResultByPath((prev) => ({ ...prev, [filePath]: result }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impact 분석에 실패했습니다";
      setError(message);
      throw err;
    } finally {
      setLoadingPath(null);
    }
  }, []);

  const getResult = useCallback(
    (filePath: string | null) => {
      try {
        return filePath ? resultByPath[filePath] : undefined;
      } catch {
        return undefined;
      }
    },
    [resultByPath],
  );

  return {
    loadingPath,
    error,
    getResult,
    loadImporters,
  };
}
