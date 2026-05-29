"use client";

import { useMemo, useState } from "react";

export type DocTone = "orange" | "blue" | "emerald" | "purple" | "gray";

export interface DocMetric {
  label: string;
  value: string;
  detail: string;
  tone: DocTone;
}

export interface DocCard {
  title: string;
  detail: string;
  meta?: string;
  tone?: DocTone;
}

export interface DocEndpoint {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  description: string;
}

export interface DocEventGroup {
  namespace: string;
  clientEvents: string[];
  serverEvents: string[];
}

export interface DocSection {
  id: string;
  nav: string;
  eyebrow: string;
  title: string;
  summary: string;
  tags: string[];
  bullets?: string[];
  cards?: DocCard[];
  endpoints?: DocEndpoint[];
  eventGroups?: DocEventGroup[];
  files?: DocCard[];
}

const metrics: DocMetric[] = [
  {
    label: "Frontend",
    value: "Next.js 16",
    detail: "React 19, TypeScript, Tailwind v4 기반의 feature 단위 UI",
    tone: "orange",
  },
  {
    label: "Backend",
    value: "NestJS",
    detail: "Module / Layer 패턴, REST API, Socket.IO 게이트웨이",
    tone: "blue",
  },
  {
    label: "Storage",
    value: "SQLite",
    detail: "TypeORM + better-sqlite3, ~/.ji 경로에 로컬 데이터 저장",
    tone: "emerald",
  },
  {
    label: "Agents",
    value: "3 CLI",
    detail: "Claude, Gemini, Codex 세션과 인증을 통합 관리",
    tone: "purple",
  },
];

const sections: DocSection[] = [
  {
    id: "overview",
    nav: "Overview",
    eyebrow: "PROJECT",
    title: "JI CLI는 여러 AI CLI를 하나의 작업 공간에서 운영하는 통합 콘솔입니다.",
    summary:
      "프론트엔드는 채팅, 작업 생성, 실행 이력, 변경 사항 확인을 제공하고, 백엔드는 Claude, Gemini, Codex 프로세스와 작업 실행 파이프라인을 관리합니다.",
    tags: ["Next.js", "NestJS", "Socket.IO", "SQLite"],
    bullets: [
      "사용자는 에이전트 인증을 마친 뒤 세션을 만들고 메시지를 스트리밍으로 주고받습니다.",
      "작업(Task)은 요구사항과 에이전트 역할을 묶어 실행하며, 실행 로그와 변경 파일을 버전 단위로 남깁니다.",
      "로컬 상태는 ~/.ji 아래 DB, 로그, worktree, patch, harness 디렉터리에 저장됩니다.",
    ],
    cards: [
      {
        title: "Primary UI",
        detail: "홈 인증 화면, 통합 채팅 화면, 작업 생성/목록/상세 화면으로 구성됩니다.",
        meta: "web/src/app",
        tone: "orange",
      },
      {
        title: "API Surface",
        detail:
          "에이전트 인증/세션, 작업, 대화, 하네스, 변경 로그를 REST와 WebSocket으로 노출합니다.",
        meta: "server/src/modules",
        tone: "blue",
      },
      {
        title: "Execution Model",
        detail:
          "작업 실행 시 에이전트별 실행 기록, 출력, 비용, 변경 파일, 재실행 메모를 추적합니다.",
        meta: "tasks, task_runs, task_agent_runs",
        tone: "emerald",
      },
    ],
  },
  {
    id: "frontend",
    nav: "Frontend",
    eyebrow: "WEB APP",
    title: "프론트엔드는 feature 폴더를 중심으로 hook, UI, container를 분리합니다.",
    summary:
      "라우트는 app 디렉터리에 얇게 두고, 실제 화면 조합은 container에서 담당합니다. 데이터 호출은 feature별 api 파일에 모여 있습니다.",
    tags: ["custom hooks", "presentation", "container", "named export"],
    bullets: [
      "src/app은 라우팅 진입점입니다. /claude, /codex, /gemini, /task/[id] 같은 페이지가 container를 호출합니다.",
      "src/features/chat은 통합 세션 목록, 채팅 워크스페이스, 메시지 스트리밍, 세션 이름 변경을 담당합니다.",
      "src/features/tasks는 작업 생성, 수정, 목록, 상세, 실행 이력, 변경 로그 UI를 담당합니다.",
      "src/features/auth는 Claude, Gemini, Codex 인증 상태 확인과 로그인 플로우를 담당합니다.",
    ],
    files: [
      {
        title: "src/features/chat/container/ClaudePageContainer.tsx",
        detail: "인증 상태, 세션 상태, 작업 모달, 상태 모달을 조합하는 채팅 화면 container입니다.",
      },
      {
        title: "src/features/chat/hooks/useUnifiedSessions.ts",
        detail: "Claude, Gemini, Codex 세션을 하나의 화면 모델로 통합합니다.",
      },
      {
        title: "src/features/tasks/api/tasks.api.ts",
        detail: "작업 CRUD, 실행, 중지, 재실행, 실행 버전 조회 API 클라이언트입니다.",
      },
      {
        title: "src/lib/constants.ts",
        detail: "SERVER_URL과 에이전트 WebSocket namespace 상수를 제공합니다.",
      },
    ],
  },
  {
    id: "backend",
    nav: "Backend",
    eyebrow: "SERVER",
    title: "백엔드는 NestJS 모듈 단위로 CLI 프로세스, 작업 실행, 영속화를 나눕니다.",
    summary:
      "AppModule은 Database, Agents, Conversation, Harness, Session, Tasks 모듈을 묶고, main.ts에서 CORS, ValidationPipe, Socket.IO, OpenAPI 문서를 설정합니다.",
    tags: ["module/layer", "ValidationPipe", "Swagger", "Scalar"],
    bullets: [
      "DatabaseModule은 TypeORM better-sqlite3 연결과 entity 등록을 담당합니다.",
      "AgentsModule은 Claude, Gemini, Codex별 인증 관리자, 세션 관리자, 게이트웨이를 포함합니다.",
      "TasksModule은 작업 CRUD와 실행 orchestration을 담당하며 /tasks WebSocket으로 진행 상태를 브로드캐스트합니다.",
      "HarnessModule은 역할별 프롬프트/지침 파일을 ~/.ji/harness에 저장하고 읽습니다.",
    ],
    files: [
      {
        title: "server/src/main.ts",
        detail:
          "전역 ValidationPipe, CORS, Socket.IO adapter, /docs Scalar API reference를 설정합니다.",
      },
      {
        title: "server/src/database/database.module.ts",
        detail: "SQLite DB 경로와 entity 목록을 TypeORM에 등록합니다.",
      },
      {
        title: "server/src/common/ji-paths.ts",
        detail: "~/.ji 아래 DB, logs, worktrees, patches, harness, agent secret 경로를 관리합니다.",
      },
      {
        title: "server/src/modules/tasks/task-execution.service.ts",
        detail: "에이전트 실행, 로그 버퍼, 변경 사항 수집, 작업 상태 이벤트의 중심 레이어입니다.",
      },
    ],
  },
  {
    id: "flows",
    nav: "Flows",
    eyebrow: "USER FLOWS",
    title: "핵심 흐름은 인증, 세션 채팅, 작업 실행, 실행 결과 검토로 이어집니다.",
    summary:
      "각 흐름은 REST로 상태를 만들고 WebSocket으로 실시간 이벤트를 받는 형태입니다. 작업 실행은 DB와 worktree, changelog를 함께 갱신합니다.",
    tags: ["auth", "session", "task", "rerun"],
    cards: [
      {
        title: "1. 인증",
        detail:
          "홈 화면에서 CLI 설치와 로그인 상태를 확인하고, 필요한 경우 WebSocket 기반 로그인 출력을 표시합니다.",
        meta: "auth/status, auth:output, auth:done",
        tone: "orange",
      },
      {
        title: "2. 세션 생성",
        detail:
          "선택한 agentType과 workingDirectory로 세션을 만들고, 세션별 메시지를 REST 또는 Socket.IO로 전송합니다.",
        meta: "session:create, sessions/:id/message",
        tone: "blue",
      },
      {
        title: "3. 작업 실행",
        detail:
          "요구사항과 역할별 에이전트를 가진 Task를 만들고, execute/rerun으로 병렬 실행과 상태 갱신을 시작합니다.",
        meta: "tasks/:id/execute, task:status",
        tone: "emerald",
      },
      {
        title: "4. 결과 확인",
        detail:
          "실행 로그, agent run, 변경 파일, patch preview를 작업 상세 화면에서 버전별로 확인합니다.",
        meta: "tasks/:id/runs, changelog",
        tone: "purple",
      },
    ],
  },
  {
    id: "api",
    nav: "REST API",
    eyebrow: "HTTP",
    title: "REST API는 상태 생성과 조회를 담당합니다.",
    summary:
      "프론트엔드 api 레이어는 NEXT_PUBLIC_SERVER_URL 또는 기본 http://localhost:3001을 서버 주소로 사용합니다.",
    tags: ["REST", "DTO", "ValidationPipe"],
    endpoints: [
      { method: "GET", path: "/agents/claude/auth/status", description: "Claude 인증 상태 조회" },
      { method: "POST", path: "/agents/claude/sessions", description: "Claude 세션 생성" },
      {
        method: "POST",
        path: "/agents/claude/sessions/:id/message",
        description: "Claude 세션에 입력 전송",
      },
      {
        method: "GET",
        path: "/agents/gemini/auth/status",
        description: "Gemini 설치와 인증 상태 조회",
      },
      {
        method: "POST",
        path: "/agents/gemini/auth/configure",
        description: "Gemini API key 또는 GCA 인증 설정",
      },
      {
        method: "GET",
        path: "/agents/codex/auth/status",
        description: "Codex 설치와 로그인 상태 조회",
      },
      { method: "POST", path: "/agents/codex/auth/configure", description: "Codex API key 저장" },
      { method: "GET", path: "/tasks", description: "작업 목록 조회" },
      { method: "POST", path: "/tasks", description: "작업 생성" },
      { method: "POST", path: "/tasks/:id/execute", description: "작업 실행 시작" },
      { method: "POST", path: "/tasks/:id/rerun", description: "작업 전체 재실행" },
      {
        method: "POST",
        path: "/tasks/:id/agents/:agentId/rerun",
        description: "특정 에이전트만 재실행",
      },
      { method: "GET", path: "/tasks/:id/runs", description: "작업 실행 버전 이력 조회" },
      { method: "GET", path: "/sessions", description: "DB에 저장된 세션 목록 조회" },
      { method: "POST", path: "/conversations", description: "대화 메시지 저장" },
      { method: "GET", path: "/harness", description: "역할별 하네스 목록 조회" },
    ],
  },
  {
    id: "realtime",
    nav: "Realtime",
    eyebrow: "SOCKET.IO",
    title: "실시간 출력은 네임스페이스별 Socket.IO 이벤트로 전달됩니다.",
    summary:
      "채팅은 에이전트 네임스페이스를 사용하고, 작업 실행 로그와 알림은 /tasks 네임스페이스를 사용합니다.",
    tags: ["WebSocket", "streaming", "notifications"],
    eventGroups: [
      {
        namespace: "/agents/claude",
        clientEvents: [
          "session:create",
          "session:message",
          "session:terminate",
          "auth:login:start",
          "auth:login:cancel",
        ],
        serverEvents: [
          "session:created",
          "session:text",
          "session:tool",
          "session:result",
          "session:exit",
          "auth:output",
          "auth:done",
          "error",
        ],
      },
      {
        namespace: "/agents/gemini",
        clientEvents: [
          "session:create",
          "session:message",
          "session:terminate",
          "auth:gca:start",
          "auth:login:cancel",
        ],
        serverEvents: [
          "session:created",
          "session:text",
          "session:result",
          "session:exit",
          "auth:output",
          "auth:done",
          "error",
        ],
      },
      {
        namespace: "/agents/codex",
        clientEvents: [
          "session:join",
          "session:message",
          "session:terminate",
          "auth:login:start",
          "auth:login:cancel",
        ],
        serverEvents: [
          "session:text",
          "session:result",
          "session:exit",
          "session:replaced",
          "auth:output",
          "auth:done",
          "error",
        ],
      },
      {
        namespace: "/tasks",
        clientEvents: [
          "task:subscribe",
          "task:unsubscribe",
          "task:get-logs",
          "task:watch-all",
          "task:unwatch-all",
        ],
        serverEvents: [
          "agent:output",
          "agent:tool",
          "agent:done",
          "agent:error",
          "task:status",
          "task:buffered-logs",
        ],
      },
    ],
  },
  {
    id: "data",
    nav: "Data",
    eyebrow: "PERSISTENCE",
    title: "데이터는 SQLite entity와 ~/.ji 파일 시스템을 함께 사용합니다.",
    summary:
      "작업, 요구사항, 에이전트, 실행 이력, 대화, 변경 파일은 DB에 저장하고, patch와 harness 같은 파일성 데이터는 ~/.ji 하위 디렉터리에 둡니다.",
    tags: ["TypeORM", "entities", "~/.ji"],
    cards: [
      {
        title: "tasks",
        detail:
          "작업 제목, 상태, workingDir, archived 플래그와 요구사항/에이전트 관계를 저장합니다.",
        tone: "orange",
      },
      {
        title: "task_runs / task_agent_runs",
        detail:
          "실행 버전, 보완 메모, agent별 상태, worktreePath, startCommitHash, durationMs, costUsd를 저장합니다.",
        tone: "blue",
      },
      {
        title: "conversations / sessions",
        detail: "세션 제목과 사용자/에이전트 메시지 기록을 저장해 이전 대화를 복원합니다.",
        tone: "emerald",
      },
      {
        title: "agent_changelogs",
        detail:
          "agentId, runId, filePath, changeType, patchPath, additions, deletions로 변경 내역을 추적합니다.",
        tone: "purple",
      },
    ],
    files: [
      { title: "~/.ji/ji.db", detail: "SQLite 데이터베이스 파일" },
      { title: "~/.ji/logs/server.log", detail: "서버 stdout 로그 미러링 파일" },
      { title: "~/.ji/worktrees", detail: "작업 실행 시 에이전트별 worktree 저장소" },
      { title: "~/.ji/patches", detail: "변경 사항 patch 저장소" },
      { title: "~/.ji/harness", detail: "역할별 하네스 문서 저장소" },
    ],
  },
  {
    id: "dev",
    nav: "Dev Notes",
    eyebrow: "MAINTENANCE",
    title: "새 기능은 기존 feature 경계를 유지하며 작게 확장하는 것이 안전합니다.",
    summary:
      "프론트엔드는 hook에 로직, UI에 표현, container에 조합을 두고, 백엔드는 controller/service/manager/entity 경계를 유지합니다.",
    tags: ["convention", "testing", "docs"],
    bullets: [
      "프론트 API 호출은 반드시 try/catch가 있는 hook 또는 container 레이어에서 사용자 표시용 error 상태로 바꾸는 패턴이 좋습니다.",
      "새 작업 관련 기능은 tasks.api.ts, useTask* hook, Task* UI, TasksController/TasksService 순서로 추적하면 빠릅니다.",
      "새 에이전트를 추가할 때는 auth manager, session manager, controller, gateway, 프론트 세션 통합 hook을 함께 확장해야 합니다.",
      "OpenAPI 문서는 서버 /docs에서 자동 생성되고, 이 문서 UI는 제품 구조와 운영 흐름을 설명하는 사용자용 문서입니다.",
    ],
  },
];

function matchesSection(section: DocSection, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  const searchable = [
    section.nav,
    section.eyebrow,
    section.title,
    section.summary,
    ...section.tags,
    ...(section.bullets ?? []),
    ...(section.cards ?? []).flatMap((card) => [card.title, card.detail, card.meta ?? ""]),
    ...(section.files ?? []).flatMap((file) => [file.title, file.detail]),
    ...(section.endpoints ?? []).flatMap((endpoint) => [
      endpoint.method,
      endpoint.path,
      endpoint.description,
    ]),
    ...(section.eventGroups ?? []).flatMap((group) => [
      group.namespace,
      ...group.clientEvents,
      ...group.serverEvents,
    ]),
  ].join(" ");

  return searchable.toLowerCase().includes(normalizedQuery);
}

export function useProjectDocs() {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "overview");

  const filteredSections = useMemo(() => {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      return sections.filter((section) => matchesSection(section, normalizedQuery));
    } catch {
      return sections;
    }
  }, [query]);

  const activeSectionTitle = useMemo(() => {
    try {
      return sections.find((section) => section.id === activeSection)?.nav ?? "Overview";
    } catch {
      return "Overview";
    }
  }, [activeSection]);

  return {
    metrics,
    sections,
    filteredSections,
    query,
    activeSection,
    activeSectionTitle,
    setQuery,
    setActiveSection,
  };
}
