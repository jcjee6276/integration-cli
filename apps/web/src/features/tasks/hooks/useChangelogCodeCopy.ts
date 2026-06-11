"use client";

import { useCallback } from "react";

import { useCopyToClipboard } from "./useCopyToClipboard";

export function extractCopyableCodeFromPatch(patch: string): string {
  const codeLines: string[] = [];

  for (const line of patch.split("\n")) {
    if (
      line.startsWith("diff --git ") ||
      line.startsWith("index ") ||
      line.startsWith("new file mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("@@") ||
      line.startsWith("\\ No newline")
    ) {
      continue;
    }

    if (line.startsWith("+")) {
      codeLines.push(line.slice(1));
      continue;
    }

    if (line.startsWith("-")) {
      continue;
    }

    if (line.startsWith(" ")) {
      codeLines.push(line.slice(1));
    }
  }

  return codeLines.length > 0 ? codeLines.join("\n").trimEnd() : patch.trim();
}

export function useChangelogCodeCopy() {
  const { copy, status } = useCopyToClipboard();

  const copyCode = useCallback(async (patch: string): Promise<boolean> => {
    return copy(extractCopyableCodeFromPatch(patch));
  }, [copy]);

  return { copyCode, status };
}
