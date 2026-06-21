"use client";

import { useCallback, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SERVER_URL } from "@/lib/constants";

import { runCrawl, type CrawlProgress, type CrawlReport } from "../api/crawl.api";

const INSPECTOR_WS_NAMESPACE = "/inspector";

export function useCrawlAudit() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [report, setReport] = useState<CrawlReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const run = useCallback(async (appUrl: string, projectPath?: string | null) => {
    if (!appUrl.trim()) {
      setError("앱 URL이 필요합니다");
      return;
    }
    setError(null);
    setReport(null);
    setProgress(null);
    setRunning(true);

    // 진행률은 /inspector WS의 inspector:crawl-progress 로 수신
    let socket: Socket | null = null;
    try {
      socket = io(`${SERVER_URL}${INSPECTOR_WS_NAMESPACE}`, { transports: ["websocket"] });
      socket.on("inspector:crawl-progress", (p: CrawlProgress) => setProgress(p));
      socketRef.current = socket;
    } catch {}

    try {
      const result = await runCrawl({ appUrl: appUrl.trim(), projectPath });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "크롤에 실패했습니다");
    } finally {
      setRunning(false);
      setProgress(null);
      try {
        socket?.disconnect();
        socketRef.current = null;
      } catch {}
    }
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setProgress(null);
    setError(null);
  }, []);

  return { running, progress, report, error, run, reset };
}
