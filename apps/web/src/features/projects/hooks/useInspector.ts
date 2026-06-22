"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SERVER_URL } from "@/lib/constants";

import {
  startInspectorSession,
  stopInspectorSession,
  type InspectorElement,
  type InspectorState,
  type InspectorStatus,
} from "../api/inspector.api";

const INSPECTOR_WS_NAMESPACE = "/inspector";

interface UseInspectorOptions {
  /** _debugSource resolve 성공 시 호출 — Code Viewer 열기 등 */
  onElement?: (element: InspectorElement) => void;
}

export function useInspector({ onElement }: UseInspectorOptions = {}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [appUrl, setAppUrl] = useState("http://localhost:3000");
  const [state, setState] = useState<InspectorState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastElement, setLastElement] = useState<InspectorElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const onElementRef = useRef(onElement);

  useEffect(() => {
    onElementRef.current = onElement;
  }, [onElement]);

  const ensureSocket = useCallback(() => {
    try {
      if (socketRef.current) return socketRef.current;
      const socket = io(`${SERVER_URL}${INSPECTOR_WS_NAMESPACE}`, {
        transports: ["websocket"],
      });

      socket.on("inspector:status", (status: InspectorStatus) => {
        setState(status.state);
        if (status.error) setError(status.error);
      });

      socket.on("inspector:element", (element: InspectorElement) => {
        setLastElement(element);
        if (!element.notFound && element.fileName) {
          onElementRef.current?.(element);
        }
      });

      socketRef.current = socket;
      return socket;
    } catch {
      return null;
    }
  }, []);

  const start = useCallback(
    async (url: string) => {
      try {
        setError(null);
        setState("connecting");
        ensureSocket();
        const status = await startInspectorSession(url.trim());
        setState(status.state);
        if (status.error) setError(status.error);
      } catch (err) {
        setState("idle");
        setError(err instanceof Error ? err.message : "인스펙터를 시작하지 못했습니다");
      }
    },
    [ensureSocket],
  );

  const stop = useCallback(async () => {
    try {
      await stopInspectorSession();
    } catch {
    } finally {
      setState("idle");
    }
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      try {
        socketRef.current?.disconnect();
        socketRef.current = null;
      } catch {}
    };
  }, []);

  return {
    panelOpen,
    setPanelOpen,
    togglePanel,
    appUrl,
    setAppUrl,
    state,
    error,
    lastElement,
    start,
    stop,
  };
}
