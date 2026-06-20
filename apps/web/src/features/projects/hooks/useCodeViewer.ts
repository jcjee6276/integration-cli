"use client";

import { useCallback, useState } from "react";

import { fetchFileContent } from "@/features/fs/api/fs.api";
import type { FsFileResult, FsTreeNode } from "@/features/fs/api/fs.api";

export interface CodeViewerPane {
  id: string;
  filePaths: string[];
  activePath: string | null;
}

export type DropSide = "left" | "right";

function createPane(filePath?: string): CodeViewerPane {
  try {
    return {
      id: crypto.randomUUID(),
      filePaths: filePath ? [filePath] : [],
      activePath: filePath ?? null,
    };
  } catch {
    const fallbackId = `pane-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      id: fallbackId,
      filePaths: filePath ? [filePath] : [],
      activePath: filePath ?? null,
    };
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "파일을 불러오지 못했습니다";
}

function removeEmptyPanes(panes: CodeViewerPane[]) {
  try {
    const nextPanes = panes.filter((pane) => pane.filePaths.length > 0);
    return nextPanes.length > 0 ? nextPanes : [createPane()];
  } catch {
    return [createPane()];
  }
}

export function useCodeViewer() {
  const [filesByPath, setFilesByPath] = useState<Record<string, FsFileResult>>({});
  const [panes, setPanes] = useState<CodeViewerPane[]>(() => [createPane()]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const focusFile = useCallback(
    (path: string) => {
      setPanes((prev) =>
        prev.map((pane) => (pane.filePaths.includes(path) ? { ...pane, activePath: path } : pane)),
      );
      setActivePaneId((prev) => {
        const pane = panes.find((item) => item.filePaths.includes(path));
        return pane?.id ?? prev;
      });
    },
    [panes],
  );

  const openFile = useCallback(
    async (node: FsTreeNode) => {
      if (node.type !== "file") return;

      const existingPane = panes.find((pane) => pane.filePaths.includes(node.path));
      if (existingPane) {
        setPanes((prev) =>
          prev.map((pane) =>
            pane.id === existingPane.id ? { ...pane, activePath: node.path } : pane,
          ),
        );
        setActivePaneId(existingPane.id);
        return;
      }

      const targetPaneId = activePaneId ?? panes[0]?.id ?? null;
      setError(null);
      setPanes((prev) => {
        const paneId = targetPaneId ?? prev[0]?.id;
        if (!paneId) return [createPane(node.path)];

        return prev.map((pane) =>
          pane.id === paneId
            ? {
                ...pane,
                filePaths: pane.filePaths.includes(node.path)
                  ? pane.filePaths
                  : [...pane.filePaths, node.path],
                activePath: node.path,
              }
            : pane,
        );
      });
      setActivePaneId(targetPaneId);

      if (filesByPath[node.path]) return;

      setLoadingPath(node.path);

      try {
        const file = await fetchFileContent(node.path);
        setFilesByPath((prev) => ({ ...prev, [node.path]: file }));
      } catch (err) {
        setError(toErrorMessage(err));
        setPanes((prev) =>
          removeEmptyPanes(
            prev.map((pane) => {
              if (!pane.filePaths.includes(node.path)) return pane;
              const filePaths = pane.filePaths.filter((filePath) => filePath !== node.path);
              return {
                ...pane,
                filePaths,
                activePath:
                  pane.activePath === node.path ? (filePaths.at(-1) ?? null) : pane.activePath,
              };
            }),
          ),
        );
      } finally {
        setLoadingPath(null);
      }
    },
    [activePaneId, filesByPath, panes],
  );

  const activateFile = useCallback((paneId: string, path: string) => {
    setPanes((prev) =>
      prev.map((pane) => (pane.id === paneId ? { ...pane, activePath: path } : pane)),
    );
    setActivePaneId(paneId);
  }, []);

  const closeFile = useCallback((paneId: string, path: string) => {
    setPanes((prev) => {
      const nextPanes = prev.map((pane) => {
        if (pane.id !== paneId) return pane;
        const filePaths = pane.filePaths.filter((filePath) => filePath !== path);
        return {
          ...pane,
          filePaths,
          activePath: pane.activePath === path ? (filePaths.at(-1) ?? null) : pane.activePath,
        };
      });
      return removeEmptyPanes(nextPanes);
    });
  }, []);

  const splitWithFile = useCallback(
    (sourcePaneId: string, targetPaneId: string, path: string, side: DropSide) => {
      setPanes((prev) => {
        const sourceIndex = prev.findIndex((pane) => pane.id === sourcePaneId);
        const targetIndex = prev.findIndex((pane) => pane.id === targetPaneId);
        if (sourceIndex < 0 || targetIndex < 0) return prev;

        const visiblePaneCount = prev.filter((pane) => pane.filePaths.length > 0).length;
        const withoutFile = prev.map((pane) => {
          if (pane.id !== sourcePaneId) return pane;
          const filePaths = pane.filePaths.filter((filePath) => filePath !== path);
          return {
            ...pane,
            filePaths,
            activePath: pane.activePath === path ? (filePaths.at(-1) ?? null) : pane.activePath,
          };
        });

        if (visiblePaneCount >= 2) {
          const movedPanes = withoutFile.map((pane) => {
            if (pane.id !== targetPaneId) return pane;
            return {
              ...pane,
              filePaths: pane.filePaths.includes(path) ? pane.filePaths : [...pane.filePaths, path],
              activePath: path,
            };
          });
          setActivePaneId(targetPaneId);
          return removeEmptyPanes(movedPanes);
        }

        const compactPanes = withoutFile.filter((pane) => pane.filePaths.length > 0);
        const compactTargetIndex = Math.max(
          0,
          compactPanes.findIndex((pane) => pane.id === targetPaneId),
        );
        const insertIndex =
          side === "left"
            ? compactTargetIndex
            : Math.min(compactTargetIndex + 1, compactPanes.length);
        const nextPane = createPane(path);
        const nextPanes = [...compactPanes];
        nextPanes.splice(insertIndex, 0, nextPane);
        setActivePaneId(nextPane.id);
        return nextPanes;
      });
    },
    [],
  );

  return {
    filesByPath,
    panes,
    activePaneId,
    loadingPath,
    error,
    openFile,
    activateFile,
    closeFile,
    splitWithFile,
    focusFile,
    setActivePaneId,
  };
}
