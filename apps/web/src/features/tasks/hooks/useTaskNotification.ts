"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SERVER_URL } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { fetchTasks } from "../api/tasks.api";

const TASKS_WS_NAMESPACE = "/tasks";

interface TaskStatusEvent {
  taskId: string;
  status: string;
  title?: string;
}

export function useTaskNotification() {
  const { addToast } = useToast();
  const [hasNew, setHasNew] = useState(false);

  // 이전 상태 추적 — running → completed/error 전환 감지
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const titleRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // 초기 상태를 기준점으로 저장 (toast 미발행)
    void fetchTasks().then((tasks) => {
      tasks.forEach((t) => {
        prevStatusRef.current.set(t.id, t.status);
        titleRef.current.set(t.id, t.title);
      });
    });

    const socket: Socket = io(`${SERVER_URL}${TASKS_WS_NAMESPACE}`, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      // 전역 알림 룸 구독 — 모든 task:status 이벤트 수신
      socket.emit("task:watch-all");
    });

    socket.on("task:status", ({ taskId, status, title }: TaskStatusEvent) => {
      const prev = prevStatusRef.current.get(taskId);

      // 서버가 title을 내려주면 갱신, 없으면 초기 로드 값 사용
      const taskTitle = title ?? titleRef.current.get(taskId) ?? "작업";
      if (title) titleRef.current.set(taskId, title);

      // pending/running/undefined → completed/error/stopped 전환 시 알림
      // (prev === "running" 만 체크하면 초기 로드 이전 신규 작업을 놓침)
      const isFinished = (s: string) =>
        s === "completed" || s === "error" || s === "stopped";

      if (!isFinished(prev ?? "")) {
        if (status === "completed") {
          addToast({ type: "success", title: "작업 완료", message: taskTitle });
          setHasNew(true);
        } else if (status === "error") {
          addToast({ type: "error", title: "작업 오류", message: taskTitle });
          setHasNew(true);
        } else if (status === "stopped") {
          addToast({ type: "info", title: "작업 중지됨", message: taskTitle });
        }
      }

      prevStatusRef.current.set(taskId, status);
    });

    return () => {
      socket.emit("task:unwatch-all");
      socket.disconnect();
    };
  }, [addToast]);

  const clearNew = useCallback(() => setHasNew(false), []);

  return { hasNew, clearNew };
}
