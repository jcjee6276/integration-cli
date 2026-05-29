"use client";

import { useCallback, useEffect, useState } from "react";

export function useSessionWorkingDirectories(selectedSessionId: string | null) {
  const [sessionDirs, setSessionDirs] = useState<Record<string, string>>({});
  const [currentDir, setCurrentDir] = useState("");

  useEffect(() => {
    setCurrentDir(selectedSessionId ? (sessionDirs[selectedSessionId] ?? "") : "");
  }, [selectedSessionId, sessionDirs]);

  const handleDirChange = useCallback(
    (path: string) => {
      setCurrentDir(path);
      if (selectedSessionId) {
        setSessionDirs((prev) => ({ ...prev, [selectedSessionId]: path }));
      }
    },
    [selectedSessionId],
  );

  const assignDirectoryToSession = useCallback((sessionId: string, path: string) => {
    setSessionDirs((prev) => ({ ...prev, [sessionId]: path }));
    setCurrentDir(path);
  }, []);

  return {
    sessionDirs,
    currentDir,
    handleDirChange,
    assignDirectoryToSession,
  };
}
