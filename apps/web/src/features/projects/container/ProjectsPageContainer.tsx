"use client";

import { useCallback, useRef } from "react";

import type { FsTreeNode } from "@/features/fs/api/fs.api";

import type { InspectorElement } from "../api/inspector.api";
import { useCodeViewer } from "../hooks/useCodeViewer";
import { useInspector } from "../hooks/useInspector";
import { useProjectTree } from "../hooks/useProjectTree";
import { ProjectTreeView } from "../ui/ProjectTreeView";

/** 절대경로에서 monorepo/프로젝트 루트를 추정 — 흔한 워크스페이스 경계 직전까지 */
function guessProjectRoot(fileName: string): string | null {
  try {
    const normalized = fileName.replace(/\\/g, "/");
    const markers = ["/src/", "/app/", "/pages/", "/components/"];
    for (const marker of markers) {
      const idx = normalized.indexOf(marker);
      if (idx > 0) return normalized.slice(0, idx);
    }
    // fallback: 파일이 들어있는 디렉토리
    const dir = normalized.slice(0, normalized.lastIndexOf("/"));
    return dir || null;
  } catch {
    return null;
  }
}

export function ProjectsPageContainer() {
  const {
    projectPath,
    setProjectPath,
    tree,
    filteredTree,
    selectedPath,
    setSelectedPath,
    extensionWhitelist,
    toggleExtensionFilter,
    clearExtensionFilters,
    loading,
    error,
    loadTree,
  } = useProjectTree();
  const codeViewer = useCodeViewer();

  // 첫 inspect resolve 시 한 번만 루트 추정 → 스캔
  const scannedRootRef = useRef(false);

  const handleInspectElement = useCallback(
    (element: InspectorElement) => {
      try {
        if (!element.fileName) return;

        if (!scannedRootRef.current) {
          const root = guessProjectRoot(element.fileName);
          if (root) {
            scannedRootRef.current = true;
            setProjectPath(root);
            void loadTree(root);
          }
        }

        const name = element.fileName.split(/[/\\]/).filter(Boolean).at(-1) ?? element.fileName;
        const node: FsTreeNode = { name, path: element.fileName, type: "file" };
        setSelectedPath(element.fileName);
        void codeViewer.openFile(node);
        if (element.line && element.line >= 1) {
          codeViewer.focusLine(element.fileName, element.line, element.endLine);
        }
      } catch {}
    },
    [codeViewer, loadTree, setProjectPath, setSelectedPath],
  );

  const inspector = useInspector({ onElement: handleInspectElement });

  const handleSelectNode = (node: FsTreeNode) => {
    setSelectedPath(node.path);
    if (node.type === "file") void codeViewer.openFile(node);
  };

  return (
    <ProjectTreeView
      projectPath={projectPath}
      tree={tree}
      filteredTree={filteredTree}
      selectedPath={selectedPath}
      extensionWhitelist={extensionWhitelist}
      loading={loading}
      error={error}
      codeViewer={codeViewer}
      inspector={inspector}
      onProjectPathChange={setProjectPath}
      onLoadTree={() => void loadTree()}
      onSelectNode={handleSelectNode}
      onToggleExtension={toggleExtensionFilter}
      onClearExtensions={clearExtensionFilters}
    />
  );
}
