"use client";

import { useCallback, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

function fallbackCopyText(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function useCopyToClipboard() {
  const [status, setStatus] = useState<CopyStatus>("idle");

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (!text) throw new Error("복사할 내용이 없습니다.");

      if (globalThis.navigator.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(text);
      } else {
        fallbackCopyText(text);
      }

      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1500);
      return true;
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1500);
      return false;
    }
  }, []);

  return { copy, status };
}
