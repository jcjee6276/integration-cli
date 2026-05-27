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

- Provides the `jccli` binary.
- Supports `jccli init` and `jccli check`.
- When this repository is published to npm, installing the root package exposes `jccli`.
- `jccli init [dir]` can scaffold the full project, install dependencies, create `~/.ji` runtime folders, and verify Claude Code, Gemini CLI, and Codex.

한국어:

- `jccli` 바이너리를 제공합니다.
- `jccli init`, `jccli check` 명령을 지원합니다.

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

After publishing the root package, users can install the CLI globally and initialize a project:

```bash
npm install -g ji
jccli init my-app
cd my-app
npm run dev
```

`jccli init` also supports:

```bash
jccli init --skip-install
jccli init --skip-agents
jccli check
```

### Run Everything / 전체 개발 서버 실행

```bash
npm run dev
```

This runs workspace `dev` scripts through Turborepo.

Turborepo를 통해 각 workspace의 `dev` 스크립트를 실행합니다.

### Run Apps Separately / 앱별 실행

```bash
# Web / 웹
npm run dev --workspace=@ji/web

# Server / 서버
npm run dev --workspace=@ji/server
```

Default ports:

- Web: Next.js default dev port, usually `3000`.
- Server: `3001`, unless `PORT` is set.

기본 포트:

- Web: Next.js 기본 개발 포트, 일반적으로 `3000`
- Server: `PORT` 환경변수가 없으면 `3001`

Server docs:

```text
http://localhost:3001/docs
http://localhost:3001/docs-json
```

## Scripts / 스크립트

Run from the repository root:

루트에서 실행:

```bash
npm run dev
npm run build
npm run lint
npm run lint:fix
npm run test
npm run format
npm run format:check
npm run clean
```

Workspace-specific examples:

workspace별 예시:

```bash
npm run test --workspace=@ji/web
npm run test:coverage --workspace=@ji/web

npm run test --workspace=@ji/server
npm run test:cov --workspace=@ji/server

npm run build --workspace=@ji/cli
```

## Testing / 테스트

### Web / 웹

The web app uses Vitest with jsdom and Testing Library.

웹 앱은 jsdom 환경의 Vitest와 Testing Library를 사용합니다.

```bash
npm run test --workspace=@ji/web
npm run test:coverage --workspace=@ji/web
```

Coverage currently includes `src/features/**`, `src/lib/**`, and `src/components/**`.

커버리지 대상은 현재 `src/features/**`, `src/lib/**`, `src/components/**`입니다.

### Server / 서버

The server uses Jest and ts-jest.

서버는 Jest와 ts-jest를 사용합니다.

```bash
npm run test --workspace=@ji/server
npm run test:cov --workspace=@ji/server
npm run test:e2e --workspace=@ji/server
```

## Environment / 환경

### Web

```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

If unset, the web client defaults to `http://localhost:3001`.

설정하지 않으면 웹 클라이언트는 기본값 `http://localhost:3001`을 사용합니다.

### Server

```bash
PORT=3001
```

The server creates local runtime directories automatically under `~/.ji`.

서버는 실행 시 `~/.ji` 아래의 로컬 런타임 디렉토리를 자동 생성합니다.

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

한국어:

- 세션은 SQLite에 저장됩니다.
- 메시지 이력은 서버에서 불러옵니다.
- 스트리밍 출력은 에이전트별 Socket.IO namespace를 통해 수신합니다.

### Tasks / 태스크

English:

- Create tasks with title, working directory, requirements, and assigned agents.
- Execute, stop, rerun, archive, and delete tasks.
- Inspect execution logs, changelog, and run history.
- Merge all changes from an agent or merge individual files.

한국어:

- 제목, 작업 디렉토리, 요구사항, 담당 에이전트를 가진 태스크를 생성합니다.
- 태스크 실행, 중지, 재실행, 보관, 삭제를 지원합니다.
- 실행 로그, 변경사항, 실행 이력을 확인합니다.
- 에이전트 전체 변경사항 또는 개별 파일 단위 병합을 지원합니다.

### Harness / 하네스

English:

- Per-role harness prompts can be edited from the web UI.
- Harness files are stored under `~/.ji/harness`.

한국어:

- 역할별 하네스 프롬프트를 웹 UI에서 편집할 수 있습니다.
- 하네스 파일은 `~/.ji/harness` 아래에 저장됩니다.

## API and WebSocket Namespaces / API 및 WebSocket namespace

Common HTTP areas:

- `/agents/claude`
- `/agents/gemini`
- `/agents/codex`
- `/tasks`
- `/sessions`
- `/conversations`
- `/harness`

Socket.IO namespaces:

- `/tasks`
- `/agents/claude`
- `/agents/gemini`
- `/agents/codex`

## Development Notes / 개발 메모

English:

- Frontend logic should live in custom hooks; UI should stay presentation-focused and be composed at container layers.
- Backend code follows a module/layer style.
- Error handling should use `try/catch` where appropriate.
- Be careful with local runtime state under `~/.ji` when debugging database or agent behavior.

한국어:

- 프론트엔드 로직은 custom hook에 두고, UI는 presentation 중심으로 유지한 뒤 container layer에서 조합합니다.
- 백엔드는 module/layer 패턴을 따릅니다.
- 에러 처리는 필요한 곳에서 `try/catch`를 사용합니다.
- DB나 에이전트 동작을 디버깅할 때는 `~/.ji` 아래의 로컬 런타임 상태를 함께 확인하세요.

## Useful Commands / 자주 쓰는 명령어

```bash
# Install dependencies / 의존성 설치
npm install

# Start all dev processes / 전체 개발 프로세스 시작
npm run dev

# Start only web / 웹만 실행
npm run dev --workspace=@ji/web

# Start only server / 서버만 실행
npm run dev --workspace=@ji/server

# Web tests with coverage / 웹 테스트 및 커버리지
npm run test:coverage --workspace=@ji/web

# Server tests with coverage / 서버 테스트 및 커버리지
npm run test:cov --workspace=@ji/server

# Build setup CLI / CLI 빌드
npm run build --workspace=@ji/cli
```
