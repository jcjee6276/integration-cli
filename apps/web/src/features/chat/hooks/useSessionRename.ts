"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSessionRename(onRename: (sessionId: string, newTitle: string) => void) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (!menuOpenId) return;

    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const startRename = useCallback((sessionId: string, currentTitle: string) => {
    setMenuOpenId(null);
    setRenamingId(sessionId);
    setRenameValue(currentTitle);
  }, []);

  const confirmRename = useCallback(() => {
    if (skipNextBlurRef.current) {
      skipNextBlurRef.current = false;
      return;
    }

    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  }, [onRename, renameValue, renamingId]);

  const cancelRename = useCallback(() => {
    skipNextBlurRef.current = true;
    setRenamingId(null);
    setRenameValue("");
  }, []);

  return {
    menuOpenId,
    setMenuOpenId,
    renamingId,
    renameValue,
    setRenameValue,
    menuRef,
    startRename,
    confirmRename,
    cancelRename,
  };
}
