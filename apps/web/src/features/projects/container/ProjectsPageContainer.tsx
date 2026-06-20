"use client";

import { useProjectTree } from "../hooks/useProjectTree";
import { ProjectTreeView } from "../ui/ProjectTreeView";

export function ProjectsPageContainer() {
  const {
    projectPath,
    setProjectPath,
    tree,
    filteredTree,
    selectedNode,
    selectedPath,
    setSelectedPath,
    extensionWhitelist,
    toggleExtensionFilter,
    clearExtensionFilters,
    loading,
    error,
    loadTree,
  } = useProjectTree();

  return (
    <ProjectTreeView
      projectPath={projectPath}
      tree={tree}
      filteredTree={filteredTree}
      selectedNode={selectedNode}
      selectedPath={selectedPath}
      extensionWhitelist={extensionWhitelist}
      loading={loading}
      error={error}
      onProjectPathChange={setProjectPath}
      onLoadTree={() => void loadTree()}
      onSelectNode={setSelectedPath}
      onToggleExtension={toggleExtensionFilter}
      onClearExtensions={clearExtensionFilters}
    />
  );
}
