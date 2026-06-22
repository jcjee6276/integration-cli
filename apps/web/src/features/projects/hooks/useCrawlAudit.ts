"use client";

import { useCallback, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SERVER_URL } from "@/lib/constants";

import {
  discoverCrawlRoutes,
  runCrawl,
  type CrawlProgress,
  type CrawlReport,
} from "../api/crawl.api";

const INSPECTOR_WS_NAMESPACE = "/inspector";

export function useCrawlAudit() {
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [report, setReport] = useState<CrawlReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routePreview, setRoutePreview] = useState<string[]>(["/"]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const loadRoutes = useCallback(async (projectPath?: string | null) => {
    try {
      setRoutesError(null);
      if (!projectPath) {
        setRoutePreview(["/"]);
        return ["/"];
      }
      setRoutesLoading(true);
      const routes = await discoverCrawlRoutes({ projectPath });
      setRoutePreview(routes);
      return routes;
    } catch (err) {
      const message = err instanceof Error ? err.message : "라우트 조회에 실패했습니다";
      setRoutesError(message);
      setRoutePreview(["/"]);
      return ["/"];
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const run = useCallback(
    async (appUrl: string, projectPath?: string | null, routes?: string[]) => {
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
        const result = await runCrawl({
          appUrl: appUrl.trim(),
          projectPath,
          routes: routes && routes.length ? routes : undefined,
        });
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
    },
    [],
  );

  /** 영향 라우트만 재크롤 — 메인 report는 건드리지 않고 신선한 결과만 반환 (토큰 0) */
  const verify = useCallback(
    async (
      appUrl: string,
      projectPath: string | null,
      routes: string[],
    ): Promise<CrawlReport | null> => {
      if (!appUrl.trim() || routes.length === 0) return null;
      setVerifying(true);
      try {
        return await runCrawl({ appUrl: appUrl.trim(), projectPath, routes });
      } catch (err) {
        setError(err instanceof Error ? err.message : "재크롤에 실패했습니다");
        return null;
      } finally {
        setVerifying(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setReport(null);
    setProgress(null);
    setError(null);
  }, []);

  return {
    running,
    verifying,
    progress,
    report,
    error,
    routePreview,
    routesLoading,
    routesError,
    loadRoutes,
    run,
    verify,
    reset,
  };
}
