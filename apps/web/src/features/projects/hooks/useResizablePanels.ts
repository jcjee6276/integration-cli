"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

function clamp(value: number, min: number, max: number) {
  try {
    return Math.min(Math.max(value, min), max);
  } catch {
    return min;
  }
}

export function useResizablePanels(defaultTreeWidth = 34) {
  const containerRef = useRef<HTMLElement>(null);
  const [treeWidth, setTreeWidth] = useState(defaultTreeWidth);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    try {
      event.preventDefault();
      setResizing(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      try {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;
        setTreeWidth(clamp(nextWidth, 24, 68));
      } catch {}
    };

    const handleMouseUp = () => {
      try {
        setResizing(false);
      } catch {}
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  return {
    containerRef,
    treeWidth,
    resizing,
    startResize,
  };
}
