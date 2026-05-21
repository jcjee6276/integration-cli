"use client";

import { useCallback, useEffect, useState } from "react";

import type { Harness, HarnessExt, HarnessRole } from "../api/harness.api";
import { fetchHarness, saveHarness } from "../api/harness.api";

export function useHarness(role: HarnessRole | null) {
  const [harness, setHarness] = useState<Harness | null>(null);
  const [content, setContent] = useState("");
  const [ext, setExt] = useState<HarnessExt>("md");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (r: HarnessRole) => {
    setLoading(true);
    try {
      const data = await fetchHarness(r);
      setHarness(data);
      setContent(data.content);
      setExt(data.ext);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role) void load(role);
  }, [role, load]);

  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  const handleExtChange = (newExt: HarnessExt) => {
    setExt(newExt);
    setDirty(true);
  };

  const save = useCallback(async () => {
    if (!role) return;
    setSaving(true);
    try {
      const saved = await saveHarness(role, content, ext);
      setHarness(saved);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [role, content, ext]);

  return {
    harness,
    content,
    ext,
    loading,
    saving,
    dirty,
    setContent: handleContentChange,
    setExt: handleExtChange,
    save,
  };
}
