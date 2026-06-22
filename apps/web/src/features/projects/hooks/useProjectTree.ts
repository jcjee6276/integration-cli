"use client";

import { useCallback, useMemo, useState } from "react";

import { fetchDirectoryTree } from "@/features/fs/api/fs.api";
import type { FsTreeNode, FsTreeResult } from "@/features/fs/api/fs.api";

export interface ExtensionFilterOption {
  extension: string;
  label: string;
}

export const EXTENSION_FILTER_OPTIONS: ExtensionFilterOption[] = [
  { extension: ".ts", label: "TS" },
  { extension: ".tsx", label: "TSX" },
  { extension: ".js", label: "JS" },
  { extension: ".jsx", label: "JSX" },
  { extension: ".mjs", label: "MJS" },
  { extension: ".cjs", label: "CJS" },
  { extension: ".json", label: "JSON" },
  { extension: ".html", label: "HTML" },
  { extension: ".css", label: "CSS" },
  { extension: ".scss", label: "SCSS" },
  { extension: ".md", label: "MD" },
];

function findNodeByPath(node: FsTreeNode, targetPath: string): FsTreeNode | null {
  try {
    if (node.path === targetPath) return node;
    for (const child of node.children ?? []) {
      const found = findNodeByPath(child, targetPath);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "디렉토리 트리를 불러오지 못했습니다";
}

function getExtension(name: string) {
  try {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return name.slice(dotIndex).toLowerCase();
  } catch {
    return "";
  }
}

function countNodes(node: FsTreeNode): number {
  try {
    return 1 + (node.children ?? []).reduce((total, child) => total + countNodes(child), 0);
  } catch {
    return 1;
  }
}

function filterTreeNode(
  node: FsTreeNode,
  whitelist: Set<string>,
  isRoot = false,
): FsTreeNode | null {
  try {
    if (node.type === "file") {
      return whitelist.has(getExtension(node.name)) ? node : null;
    }

    const children = (node.children ?? [])
      .map((child) => filterTreeNode(child, whitelist))
      .filter((child): child is FsTreeNode => Boolean(child));

    return {
      ...node,
      children,
    };
  } catch {
    return node.type === "directory" || isRoot ? { ...node, children: [] } : null;
  }
}

export function useProjectTree() {
  const [projectPath, setProjectPath] = useState("");
  const [tree, setTree] = useState<FsTreeResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [extensionWhitelist, setExtensionWhitelist] = useState<string[]>(
    EXTENSION_FILTER_OPTIONS.map((option) => option.extension),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTree = useMemo<FsTreeResult | null>(() => {
    try {
      if (!tree) return null;
      const whitelist = new Set(extensionWhitelist);
      const root = filterTreeNode(tree.root, whitelist, true) ?? { ...tree.root, children: [] };
      return {
        ...tree,
        root,
        totalNodes: countNodes(root),
      };
    } catch {
      return tree;
    }
  }, [extensionWhitelist, tree]);

  const selectedNode = useMemo(() => {
    try {
      if (!filteredTree || !selectedPath) return null;
      return findNodeByPath(filteredTree.root, selectedPath);
    } catch {
      return null;
    }
  }, [filteredTree, selectedPath]);

  const toggleExtensionFilter = useCallback((extension: string) => {
    setExtensionWhitelist((prev) => {
      try {
        return prev.includes(extension)
          ? prev.filter((item) => item !== extension)
          : [...prev, extension];
      } catch {
        return prev;
      }
    });
  }, []);

  const clearExtensionFilters = useCallback(() => {
    try {
      setExtensionWhitelist(EXTENSION_FILTER_OPTIONS.map((option) => option.extension));
    } catch {}
  }, []);

  const loadTree = useCallback(
    async (path = projectPath) => {
      if (!path.trim()) {
        setError("디렉토리를 선택해 주세요");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchDirectoryTree(path.trim());
        setTree(result);
        setSelectedPath(result.root.path);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [projectPath],
  );

  return {
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
  };
}
