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

export interface CodeFocus {
  path: string;
  line: number;
  /** 요소가 끝나는 줄 (범위 하이라이트). 없으면 시작 줄만 */
  endLine?: number;
  /** 사용자가 Code Viewer에서 직접 선택한 줄인지 여부 */
  manual?: boolean;
  /** 같은 라인을 다시 클릭해도 재스크롤되도록 하는 증가 카운터 */
  nonce: number;
}

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

function findValidPaneId(panes: CodeViewerPane[], paneId: string | null) {
  try {
    if (paneId && panes.some((pane) => pane.id === paneId)) return paneId;
    return panes[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function useCodeViewer() {
  const [filesByPath, setFilesByPath] = useState<Record<string, FsFileResult>>({});
  const [panes, setPanes] = useState<CodeViewerPane[]>(() => [createPane()]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<CodeFocus | null>(null);

  const focusLine = useCallback((path: string, line: number, endLine?: number, manual = false) => {
    setFocus((prev) => ({ path, line, endLine, manual, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

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

      setError(null);
      let nextActivePaneId: string | null = null;
      setPanes((prev) => {
        const paneId = findValidPaneId(prev, activePaneId);
        if (!paneId) {
          const nextPane = createPane(node.path);
          nextActivePaneId = nextPane.id;
          return [nextPane];
        }

        nextActivePaneId = paneId;
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
      setActivePaneId(nextActivePaneId);

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

  const closeFile = useCallback(
    (paneId: string, path: string) => {
      let nextActivePaneId: string | null = null;
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
        const compactPanes = removeEmptyPanes(nextPanes);
        nextActivePaneId = findValidPaneId(compactPanes, activePaneId);
        return compactPanes;
      });
      setActivePaneId(nextActivePaneId);
    },
    [activePaneId],
  );

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
    focus,
    focusLine,
    openFile,
    activateFile,
    closeFile,
    splitWithFile,
    focusFile,
    setActivePaneId,
  };
}
