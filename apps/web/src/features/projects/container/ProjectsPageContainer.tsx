"use client";

import type { FsTreeNode } from "@/features/fs/api/fs.api";

import { useCodeViewer } from "../hooks/useCodeViewer";
import { useProjectTree } from "../hooks/useProjectTree";
import { ProjectTreeView } from "../ui/ProjectTreeView";

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
      onProjectPathChange={setProjectPath}
      onLoadTree={() => void loadTree()}
      onSelectNode={handleSelectNode}
      onToggleExtension={toggleExtensionFilter}
      onClearExtensions={clearExtensionFilters}
    />
  );
}
