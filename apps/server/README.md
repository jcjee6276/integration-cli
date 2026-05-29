# Integration CLI — Server

멀티 에이전트 태스크 실행 백엔드. Claude / Gemini / Codex CLI를 오케스트레이션하고 결과를 WebSocket으로 스트리밍한다.

## 기술 스택

- **Framework**: NestJS 11, TypeScript 5
- **Database**: SQLite (`~/.ji/ji.db`) via TypeORM 0.3
- **WebSocket**: Socket.IO 4 (`/tasks`, `/agents/claude`, `/agents/gemini`)
- **Agent CLI**: Claude Code CLI, Gemini CLI, Codex CLI (node-pty / spawn)
- **Test**: Jest 30, ts-jest, @nestjs/testing

---

## 실행

```bash
npm install
npm run dev          # watch mode (port 3001)
npm run start:prod   # production
```

API 문서: `http://localhost:3001/docs` (Scalar UI)

---

## 테스트

### 명령어

```bash
npm test             # 전체 단위 테스트
npm run test:watch   # watch 모드
npm run test:cov     # 커버리지 리포트 (coverage/ 디렉토리 생성)
npm run test:e2e     # E2E 테스트
```

### 구성 개요

```
src/
├── app.controller.spec.ts                          # 앱 루트 컨트롤러
├── __mocks__/
│   ├── uuid.js                                     # uuid v14 (ESM-only) CJS mock
│   └── glob.js                                     # TypeORM DirectoryLoader glob mock
└── modules/
    ├── tasks/
    │   ├── tasks.service.spec.ts                   # TasksService 단위 테스트
    │   └── tasks.controller.spec.ts                # TasksController 단위 테스트
    ├── conversations/
    │   ├── conversation.service.spec.ts            # ConversationService 단위 테스트
    │   └── conversation.controller.spec.ts         # ConversationController 단위 테스트
    ├── sessions/
    │   ├── session.service.spec.ts                 # SessionService 단위 테스트
    │   └── session.controller.spec.ts              # SessionController 단위 테스트
    ├── harness/
    │   ├── harness.service.spec.ts                 # HarnessService 단위 테스트
    │   └── harness.controller.spec.ts              # HarnessController 단위 테스트
    └── changelog/
        └── changelog.service.spec.ts               # GitChangelogService 단위 테스트
```

---

## 테스트 상세

### TasksService — `tasks.service.spec.ts` (29개)

Repository 5개, `TaskExecutionService`, `GitChangelogService`를 모두 mock으로 교체한 순수 단위 테스트.

| 그룹 | 시나리오 |
|------|---------|
| `findOne` | task 반환 / 미존재 시 `NotFoundException` |
| `findAll` | `archived: false` 필터 + 최신순 정렬 |
| `create` | 요구사항·에이전트 없음 / 요구사항 포함 / 에이전트 포함 / workingDir null |
| `update` | title 변경 / 요구사항 교체 / 빈 배열로 전체 삭제 / 에이전트 교체 / 미존재 예외 |
| `execute` | 정상 실행 → `spawnTask` 호출 / 이미 running 상태 → 재실행 없음 |
| `rerun` | 에이전트 초기화 + 다음 버전 계산 / 실행 이력 없을 때 버전 1 / running 상태 → 재실행 없음 |
| `stop` | `stopTask` 호출 + run 상태를 `stopped` 업데이트 |
| `getRuns` | 버전 내림차순 반환 |
| `archive` | `archived: true` 업데이트 / 미존재 예외 |
| `remove` | `delete` 호출 |
| `mergeAgentAll` | 전체 병합 / 에이전트 없음 예외 / `worktreePath` 없음 / `workingDir` 없으면 `process.cwd()` 사용 |
| `mergeAgentFile` | 단일 파일 병합 / 에이전트 없음 예외 / `worktreePath` 없음 |

```typescript
// 실행 상태 확인 예시
it('이미 running 상태이면 spawnTask를 호출하지 않는다', async () => {
  taskRepo.findOne.mockResolvedValue({ ...baseTask, status: 'running' });
  await service.execute('task-1');
  expect(executionService.spawnTask).not.toHaveBeenCalled();
});
```

---

### TasksController — `tasks.controller.spec.ts` (13개)

`TasksService`를 mock으로 교체. 컨트롤러가 올바른 인수로 서비스 메서드를 위임하는지 검증.

| 메서드 | 검증 항목 |
|--------|---------|
| `POST /tasks` | `service.create(dto)` 위임 |
| `GET /tasks` | `service.findAll()` 위임 |
| `GET /tasks/:id` | `service.findOne(id)` 위임 |
| `PATCH /tasks/:id` | `service.update(id, dto)` 위임 |
| `POST /tasks/:id/execute` | `service.execute(id)` 위임 |
| `POST /tasks/:id/stop` | `service.stop(id)` 위임 |
| `POST /tasks/:id/rerun` | `service.rerun(id, supplementNote)` / `supplementNote` 없을 때 undefined 전달 |
| `GET /tasks/:id/runs` | `service.getRuns(id)` 위임 |
| `POST /tasks/:id/archive` | `service.archive(id)` 위임 |
| `POST /tasks/:id/agents/:agentId/merge` | `agentId`를 `Number`로 변환 후 위임 |
| `POST /tasks/:id/agents/:agentId/merge-file` | `filePath` + `Number(agentId)` 위임 |
| `DELETE /tasks/:id` | `service.remove(id)` 위임 |

---

### ConversationService — `conversation.service.spec.ts` (14개)

`ConversationEntity` Repository를 mock으로 교체.

| 그룹 | 시나리오 |
|------|---------|
| `create` | 기본 메시지 저장 / `agentId` + `runId` 포함 저장 |
| `findBySession` | `sessionId` 필터 + ASC 정렬 / 빈 결과 |
| `findByRun` | `runId` 필터 + ASC 정렬 |
| `findOne` | ID 조회 / 미존재 `NotFoundException` |
| `remove` | 조회 후 삭제 / 미존재 `NotFoundException` |
| `removeBySession` | `sessionId` 기준 전체 삭제 |

---

### ConversationController — `conversation.controller.spec.ts` (5개)

`ConversationService` mock. 각 엔드포인트 위임 검증.

| 엔드포인트 | 검증 |
|-----------|------|
| `POST /conversations` | `service.create(dto)` |
| `GET /conversations/session/:sessionId` | `service.findBySession(sessionId)` |
| `GET /conversations/:id` | `service.findOne(id)` |
| `DELETE /conversations/:id` | `service.remove(id)` |
| `DELETE /conversations/session/:sessionId` | `service.removeBySession(sessionId)` |

---

### SessionService — `session.service.spec.ts` (7개)

`SessionEntity` Repository mock.

| 그룹 | 시나리오 |
|------|---------|
| `findAll` | 전체 최신순 / `agentType: 'claude'` 필터 / `agentType: 'gemini'` 필터 / 빈 결과 |
| `findOne` | `sessionId` 조회 / 미존재 `NotFoundException` (메시지 포함) |

---

### SessionController — `session.controller.spec.ts` (3개)

`SessionService` mock. `agentType` query param 유무 모두 검증.

---

### HarnessService — `harness.service.spec.ts` (17개)

`fs` 모듈 전체를 `jest.mock('fs')`로 교체. 파일시스템 접근을 직접 제어.

| 그룹 | 시나리오 |
|------|---------|
| `findAll` | 존재하는 파일만 수집 / 없으면 빈 배열 / `md` → `tsx` 순서로 탐색 |
| `findOne` | `.md` 파일 반환 / `.tsx` 파일 반환 / 없으면 null / `readFileSync` utf8 호출 확인 |
| `save` | `.md` 저장 / `.tsx` 저장 / 확장자 변경 시 기존 파일 삭제 / 다른 확장자 없으면 삭제 안 함 |
| `remove` | `.md` 삭제 / `.tsx` 삭제 / 두 파일 모두 존재하면 둘 다 삭제 / 없으면 삭제 안 함 |

```typescript
// 확장자 변경 처리 예시
it('확장자 변경 시 기존 파일을 삭제한다', () => {
  const oldPath = path.join(harnessDir, 'common.tsx');
  (fs.existsSync as jest.Mock).mockImplementation((p) => p === oldPath);

  service.save('common', 'content', 'md'); // tsx → md로 변경

  expect(fs.unlinkSync).toHaveBeenCalledWith(oldPath);
});
```

---

### HarnessController — `harness.controller.spec.ts` (6개)

`HarnessService` mock. `findOne`이 null 반환 시 기본값(`{ role, ext: 'md', content: '' }`) 반환 검증 포함.

---

### GitChangelogService — `changelog.service.spec.ts` (30개)

`child_process`(`execSync`, `execFileSync`)와 `fs`를 모두 mock. private 메서드 `parseDiff`는 `(service as any).parseDiff()`로 직접 접근.

| 그룹 | 시나리오 |
|------|---------|
| `isGitRepo` | git repo 확인 (`true`) / 아닐 때 (`false`) |
| `getCurrentHead` | HEAD SHA 반환 + trim |
| `getCurrentBranch` | 브랜치명 반환 / 특수문자 → `-` 치환 + 40자 자름 / 에러 → `'unknown'` |
| `getRepoRoot` | `--show-toplevel` 결과 반환 |
| `mergeAll` | 전체 병합 성공 / worktree 없음 실패 / 충돌 시 `false` + abort 시도 |
| `mergeFile` | 단일 파일 병합 성공 / worktree 없음 실패 / checkout 실패 → 에러 메시지 |
| `getLatestRunId` | 최근 runId 반환 / 없으면 null |
| `getByTask` | 에이전트별 그룹핑 / runId 직접 지정 / 없으면 빈 배열 |
| `parseDiff` | `modified` 파일 / `added` 파일 / `deleted` 파일 / `renamed` 파일 / 멀티파일 / 빈 diff / 200KB 초과 truncation / `+++`·`---` 헤더 카운트 제외 |
| `captureAndSave` | 변경사항 있음 → DB 저장 + SHA 반환 / 없음 → DB 미저장 / 에러 → null |
| `mergeToMain` | merge 성공 / 충돌 → abort 후 예외 미전파 |

```typescript
// parseDiff truncation 예시
it('200KB 초과 patch는 truncated 처리한다', () => {
  const longContent = '+' + 'x'.repeat(210_000);
  // ...
  expect(result[0].patch).toContain('(truncated)');
});
```

---

## Jest 설정 (`package.json`)

```json
"jest": {
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^uuid$": "<rootDir>/__mocks__/uuid.js",
    "^glob$": "<rootDir>/__mocks__/glob.js"
  },
  "coverageDirectory": "../coverage"
}
```

### `__mocks__/uuid.js`

uuid v14는 ESM-only 패키지여서 Jest(CJS)에서 직접 import 시 파싱 에러 발생. `jest.fn()`으로 감싼 CJS mock으로 대체.

### `__mocks__/glob.js`

TypeORM v0.3이 로드될 때 `DirectoryExportedClassesLoader`가 `glob`을 통해 `path-scurry`(ESM)를 불러온다. 단위 테스트에서는 디렉터리 스캔이 필요 없으므로 no-op mock으로 차단.

### `tsconfig.json`

`"isolatedModules": true` — ts-jest가 각 파일을 독립적으로 트랜스파일. 타입 체크를 생략해 테스트 속도를 높이고 NodeNext 모듈 해석의 부작용을 방지.

---

## 커버리지 현황

> `npm run test:cov` 실행 기준

| 모듈 | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `tasks/tasks.service.ts` | 99% | 85% | 100% | 100% |
| `tasks/tasks.controller.ts` | 100% | 75% | 100% | 100% |
| `conversations/conversation.service.ts` | 100% | 83% | 100% | 100% |
| `conversations/conversation.controller.ts` | 100% | 75% | 100% | 100% |
| `sessions/session.service.ts` | 100% | 88% | 100% | 100% |
| `sessions/session.controller.ts` | 100% | 75% | 100% | 100% |
| `harness/harness.service.ts` | 100% | 100% | 100% | 100% |
| `harness/harness.controller.ts` | 100% | 80% | 100% | 100% |
| `changelog/changelog.service.ts` | 85% | 81% | 87% | 85% |

**미커버 영역**: `task-execution.service.ts`, `*.gateway.ts`, 에이전트 모듈(`claude/`, `gemini/`, `codex/`) — CLI 서브프로세스·PTY 세션 의존으로 단위 테스트 제외. 통합/E2E 테스트 대상.

---

## 테스트 전략

```
┌─────────────────────────────────────────────────────────┐
│  단위 테스트 (현재)                                        │
│  Service / Controller — Repository·외부 의존 전부 mock    │
├─────────────────────────────────────────────────────────┤
│  통합 테스트 (미구현)                                      │
│  실제 SQLite in-memory DB + TypeORM                      │
│  대상: TasksService CRUD, ConversationService            │
├─────────────────────────────────────────────────────────┤
│  E2E 테스트 (test/app.e2e-spec.ts)                       │
│  실 서버 기동 + supertest HTTP 요청                        │
└─────────────────────────────────────────────────────────┘
```

### Mock 원칙

- **Repository**: `create / save / findOne / find / update / delete`를 `jest.fn()`으로 교체
- **ExternalProcess (`task-execution.service`)**: `jest.mock('./task-execution.service', () => ...)` 으로 모듈 레벨 대체 — CLI 프로세스를 실제로 실행하지 않음
- **Git CLI (`child_process`)**: `execSync` / `execFileSync`를 `jest.Mock`으로 교체
- **FileSystem (`fs`)**: `jest.mock('fs')`로 전체 대체 — 실 파일시스템 접근 없음
