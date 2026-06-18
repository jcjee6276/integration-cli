# Integration CLI

> A local web workspace for managing Claude Code, Gemini CLI, and Codex CLI sessions, tasks, logs, and agent-generated changes.
>
> Claude Code, Gemini CLI, Codex CLI 세션과 태스크, 로그, 에이전트 변경사항을 로컬 웹 환경에서 통합 관리하는 워크스페이스입니다.

## Overview / 개요

Integration CLI is an npm workspaces + Turborepo monorepo. It contains a Next.js web client, a NestJS API/WebSocket server, a small setup CLI, and shared TypeScript/ESLint configuration packages.

Integration CLI는 npm workspaces와 Turborepo 기반 모노레포입니다. Next.js 웹 클라이언트, NestJS API/WebSocket 서버, 환경 초기화 CLI, 공용 TypeScript/ESLint 설정 패키지로 구성되어 있습니다.

The app is designed around local AI coding agents:

- Chat with Claude Code, Gemini CLI, and Codex CLI sessions.
- Create multi-agent tasks with requirements and role assignments.
- Stream task execution output through Socket.IO.
- Review changelogs, run history, and merge generated file changes.
- Configure per-role harness prompts that are injected into agent runs.

주요 목적은 로컬 AI 코딩 에이전트를 한 화면에서 다루는 것입니다.

- Claude Code, Gemini CLI, Codex CLI 세션 채팅
- 요구사항과 역할을 가진 멀티 에이전트 태스크 생성
- Socket.IO 기반 태스크 실행 출력 스트리밍
- 변경사항, 실행 이력 확인 및 생성 파일 병합
- 에이전트 실행 시 주입되는 역할별 하네스 프롬프트 설정

## Tech Stack / 기술 스택

| Area | English | 한국어 |
| --- | --- | --- |
| Monorepo | npm workspaces, Turborepo | npm workspaces, Turborepo |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest | Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest |
| Server | NestJS 11, TypeScript, Socket.IO, TypeORM | NestJS 11, TypeScript, Socket.IO, TypeORM |
| Database | SQLite via `better-sqlite3` | `better-sqlite3` 기반 SQLite |
| CLI | Commander, TypeScript | Commander, TypeScript |
| Tests | Vitest for web, Jest for server | 웹은 Vitest, 서버는 Jest |

## Repository Structure / 프로젝트 구조

```text
.
├── apps/
│   ├── web/                 # Next.js frontend / Next.js 프론트엔드
│   └── server/              # NestJS backend / NestJS 백엔드
├── packages/
│   ├── cli/                 # jccli setup/check CLI / jccli 초기화·점검 CLI
│   ├── eslint-config/       # shared ESLint configs / 공용 ESLint 설정
│   └── typescript-config/   # shared tsconfig presets / 공용 tsconfig preset
├── package.json             # workspace scripts / 워크스페이스 스크립트
└── turbo.json               # Turborepo pipeline / Turborepo 파이프라인
```

### `apps/web`

English:

- App routes live in `src/app`.
- Feature code is grouped under `src/features`.
- UI atoms/shared components live under `src/components` and `src/lib`.
- Tests are colocated in `__tests__` directories.

한국어:

- App Router 페이지는 `src/app`에 있습니다.
- 기능별 코드는 `src/features` 아래에 모여 있습니다.
- 공용 UI와 유틸은 `src/components`, `src/lib`에 있습니다.
- 테스트는 각 영역의 `__tests__` 디렉토리에 colocate되어 있습니다.

### `apps/server`

English:

- Nest modules are split by domain: agents, tasks, sessions, conversations, harness, changelog.
- SQLite data and local runtime files are stored under `~/.ji`.
- API docs are exposed at `/docs` when the server is running.

한국어:

- Nest 모듈은 agents, tasks, sessions, conversations, harness, changelog 도메인으로 나뉩니다.
- SQLite 데이터와 로컬 런타임 파일은 `~/.ji` 아래에 저장됩니다.
- 서버 실행 중 API 문서는 `/docs`에서 확인할 수 있습니다.

Runtime paths:

```text
~/.ji/
├── ji.db
├── logs/server.log
├── worktrees/
├── harness/
└── agents/
    ├── gemini/
    └── codex/
```

### `packages/cli`

English:

- Provides the `jccli` binary (published as `@jcjeon/integration-cli` on npm).
- `jccli init` — creates `~/.ji` runtime directories and verifies Claude Code, Gemini CLI, and Codex.
- `jccli start` — launches the prebuilt server and web app on a single port (default `3020`).
- `jccli check` — checks agent CLI installation status.

한국어:

- `jccli` 바이너리를 제공합니다 (npm 패키지명: `@jcjeon/integration-cli`).
- `jccli init` — `~/.ji` 런타임 디렉터리 생성 및 에이전트 CLI 설치 상태 확인.
- `jccli start` — 프리빌드된 서버와 웹 앱을 단일 포트(기본 `3020`)에서 실행.
- `jccli check` — 에이전트 CLI 설치 상태만 확인.

## Getting Started / 시작하기

### Prerequisites / 사전 요구사항

- Node.js `>=20` for the monorepo.
- npm `10.9.7` is the pinned package manager.
- Claude Code, Gemini CLI, and Codex CLI are expected for full agent functionality.

- 모노레포 실행에는 Node.js `>=20`이 필요합니다.
- 패키지 매니저는 npm `10.9.7` 기준입니다.
- 전체 에이전트 기능을 사용하려면 Claude Code, Gemini CLI, Codex CLI가 필요합니다.

### Install / 설치

```bash
npm install
```

### Install From npm / npm 패키지로 설치

패키지를 전역 설치한 뒤 `jccli init`으로 런타임을 초기화하고, `jccli start`로 앱을 실행합니다.

```bash
npm install -g @jcjeon/integration-cli
jccli init
jccli start
```

옵션:

```bash
jccli init --skip-agents       # 에이전트 CLI 설치 확인 건너뜀
jccli start --port 4000        # 포트 지정 (기본 3020)
jccli check                    # Claude Code, Gemini CLI, Codex 설치 상태 확인
```

## Main Features / 주요 기능

### Agent Authentication / 에이전트 인증

English:

- Claude Code login flow is handled over WebSocket.
- Gemini supports API key and Google Cloud Application Default Credentials style login.
- Codex supports device login and API key configuration.

한국어:

- Claude Code 로그인 흐름은 WebSocket으로 처리됩니다.
- Gemini는 API key 및 Google Cloud Application Default Credentials 방식 로그인을 지원합니다.
- Codex는 device login 및 API key 설정을 지원합니다.

### Chat Sessions / 채팅 세션

English:

- Sessions are persisted in SQLite.
- Message history is loaded from the server.
- Streaming output is received through agent-specific Socket.IO namespaces.
- Model and reasoning level can be selected per session when creating or restoring.

한국어:

- 세션은 SQLite에 저장됩니다.
- 메시지 이력은 서버에서 불러옵니다.
- 스트리밍 출력은 에이전트별 Socket.IO namespace를 통해 수신합니다.
- 세션 생성·복원 시 모델과 추론 레벨을 선택할 수 있습니다.

### Tasks / 태스크

English:

- Create tasks with title, working directory (browsable via server-side directory picker), requirements, and assigned agents.
- Execute, stop, rerun per-agent, archive, and delete tasks.
- Inspect execution logs, changelog, and run history.
- Merge all changes from an agent or merge individual files (patch-based).
- Option to instruct sub-agents to write test code alongside implementation.

한국어:

- 제목, 작업 디렉토리(서버 API 기반 디렉토리 피커), 요구사항, 담당 에이전트를 가진 태스크를 생성합니다.
- 태스크 전체 또는 에이전트 단위 실행·중지·재실행, 보관, 삭제를 지원합니다.
- 실행 로그, 변경사항, 실행 이력을 확인합니다.
- patch 기반 병합으로 에이전트 전체 변경사항 또는 개별 파일 단위 병합을 지원합니다.
- 서브에이전트에게 테스트 코드 작성을 함께 요청하는 옵션을 제공합니다.

### Changelog / 변경사항

English:

- Displays file-level diffs generated by agent runs.
- Supports copying individual file changes to clipboard.
- Merge is applied via patch to avoid overwriting unrelated edits.

한국어:

- 에이전트 실행으로 생성된 파일별 diff를 표시합니다.
- 개별 파일 변경 코드를 클립보드로 복사할 수 있습니다.
- 병합은 patch 방식으로 적용되어 관련 없는 수정을 덮어쓰지 않습니다.

### Harness / 하네스

English:

- Per-role harness prompts can be edited from the web UI.
- Harness files are stored under `~/.ji/harness`.

한국어:

- 역할별 하네스 프롬프트를 웹 UI에서 편집할 수 있습니다.
- 하네스 파일은 `~/.ji/harness` 아래에 저장됩니다.
