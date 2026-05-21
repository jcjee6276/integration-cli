"use client";

import Link from "next/link";
import { useState } from "react";

import type { DiffFile } from "@/features/diff/ui/DiffFileRow";
import { DiffFileRow } from "@/features/diff/ui/DiffFileRow";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_FILES: DiffFile[] = [
  {
    filePath: "src/features/auth/hooks/useLogin.ts",
    changeType: "added",
    additions: 42,
    deletions: 0,
    lines: [
      { type: "hunk", content: "@@ -0,0 +1,42 @@" },
      { type: "added", content: '"use client";', newLineNo: 1 },
      { type: "added", content: "", newLineNo: 2 },
      { type: "added", content: "import { useState } from \"react\";", newLineNo: 3 },
      { type: "added", content: "", newLineNo: 4 },
      { type: "added", content: "export function useLogin() {", newLineNo: 5 },
      { type: "added", content: "  const [loading, setLoading] = useState(false);", newLineNo: 6 },
      { type: "added", content: "  const [error, setError] = useState<string | null>(null);", newLineNo: 7 },
      { type: "added", content: "", newLineNo: 8 },
      { type: "added", content: "  const login = async (email: string, password: string) => {", newLineNo: 9 },
      { type: "added", content: "    setLoading(true);", newLineNo: 10 },
      { type: "added", content: "    try {", newLineNo: 11 },
      { type: "added", content: "      await authApi.login({ email, password });", newLineNo: 12 },
      { type: "added", content: "    } catch (e) {", newLineNo: 13 },
      { type: "added", content: "      setError(e instanceof Error ? e.message : \"로그인 실패\");", newLineNo: 14 },
      { type: "added", content: "    } finally {", newLineNo: 15 },
      { type: "added", content: "      setLoading(false);", newLineNo: 16 },
      { type: "added", content: "    }", newLineNo: 17 },
      { type: "added", content: "  };", newLineNo: 18 },
      { type: "added", content: "", newLineNo: 19 },
      { type: "added", content: "  return { loading, error, login };", newLineNo: 20 },
      { type: "added", content: "}", newLineNo: 21 },
    ],
  },
  {
    filePath: "src/features/auth/ui/LoginForm.tsx",
    changeType: "modified",
    additions: 15,
    deletions: 8,
    lines: [
      { type: "hunk", content: "@@ -12,18 +12,25 @@" },
      { type: "context", content: "export function LoginForm() {", oldLineNo: 12, newLineNo: 12 },
      { type: "context", content: "  const { loading, error, login } = useLogin();", oldLineNo: 13, newLineNo: 13 },
      { type: "context", content: "", oldLineNo: 14, newLineNo: 14 },
      { type: "removed", content: "  const [email, setEmail] = useState(\"\");", oldLineNo: 15 },
      { type: "removed", content: "  const [password, setPassword] = useState(\"\");", oldLineNo: 16 },
      { type: "added",   content: "  const [form, setForm] = useState({ email: \"\", password: \"\" });", newLineNo: 15 },
      { type: "added",   content: "", newLineNo: 16 },
      { type: "added",   content: "  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {", newLineNo: 17 },
      { type: "added",   content: "    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));", newLineNo: 18 },
      { type: "added",   content: "  };", newLineNo: 19 },
      { type: "context", content: "", oldLineNo: 17, newLineNo: 20 },
      { type: "context", content: "  const handleSubmit = async (e: React.FormEvent) => {", oldLineNo: 18, newLineNo: 21 },
      { type: "context", content: "    e.preventDefault();", oldLineNo: 19, newLineNo: 22 },
      { type: "removed", content: "    await login(email, password);", oldLineNo: 20 },
      { type: "added",   content: "    await login(form.email, form.password);", newLineNo: 23 },
      { type: "context", content: "  };", oldLineNo: 21, newLineNo: 24 },
    ],
  },
  {
    filePath: "src/features/auth/api/auth.api.ts",
    changeType: "modified",
    additions: 6,
    deletions: 2,
    lines: [
      { type: "hunk", content: "@@ -28,10 +28,14 @@" },
      { type: "context", content: "export async function login(dto: LoginDto) {", oldLineNo: 28, newLineNo: 28 },
      { type: "context", content: "  const res = await fetch(`${SERVER_URL}/auth/login`, {", oldLineNo: 29, newLineNo: 29 },
      { type: "context", content: "    method: \"POST\",", oldLineNo: 30, newLineNo: 30 },
      { type: "removed", content: "    body: JSON.stringify(dto),", oldLineNo: 31 },
      { type: "added",   content: "    headers: { \"Content-Type\": \"application/json\" },", newLineNo: 31 },
      { type: "added",   content: "    body: JSON.stringify(dto),", newLineNo: 32 },
      { type: "context", content: "  });", oldLineNo: 32, newLineNo: 33 },
      { type: "removed", content: "  if (!res.ok) throw new Error(\"HTTP \" + res.status);", oldLineNo: 33 },
      { type: "added",   content: "  if (!res.ok) {", newLineNo: 34 },
      { type: "added",   content: "    const body = await res.json().catch(() => ({}));", newLineNo: 35 },
      { type: "added",   content: "    throw new Error(body.message ?? `HTTP ${res.status}`);", newLineNo: 36 },
      { type: "added",   content: "  }", newLineNo: 37 },
      { type: "context", content: "  return res.json();", oldLineNo: 34, newLineNo: 38 },
      { type: "context", content: "}", oldLineNo: 35, newLineNo: 39 },
    ],
  },
  {
    filePath: "src/features/auth/utils/validators.ts",
    changeType: "deleted",
    additions: 0,
    deletions: 18,
    lines: [
      { type: "hunk", content: "@@ -1,18 +0,0 @@" },
      { type: "removed", content: "export function validateEmail(email: string) {", oldLineNo: 1 },
      { type: "removed", content: "  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);", oldLineNo: 2 },
      { type: "removed", content: "}", oldLineNo: 3 },
      { type: "removed", content: "", oldLineNo: 4 },
      { type: "removed", content: "export function validatePassword(password: string) {", oldLineNo: 5 },
      { type: "removed", content: "  return password.length >= 8;", oldLineNo: 6 },
      { type: "removed", content: "}", oldLineNo: 7 },
    ],
  },
  {
    filePath: "src/features/auth/utils/validation.ts",
    changeType: "renamed",
    additions: 4,
    deletions: 0,
    lines: [
      { type: "hunk", content: "@@ -0,0 +1,12 @@ (validators.ts → validation.ts)" },
      { type: "context", content: "export function validateEmail(email: string) {", oldLineNo: 1, newLineNo: 1 },
      { type: "context", content: "  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);", oldLineNo: 2, newLineNo: 2 },
      { type: "context", content: "}", oldLineNo: 3, newLineNo: 3 },
      { type: "context", content: "", oldLineNo: 4, newLineNo: 4 },
      { type: "context", content: "export function validatePassword(password: string) {", oldLineNo: 5, newLineNo: 5 },
      { type: "context", content: "  return password.length >= 8;", oldLineNo: 6, newLineNo: 6 },
      { type: "context", content: "}", oldLineNo: 7, newLineNo: 7 },
      { type: "added",   content: "", newLineNo: 8 },
      { type: "added",   content: "export function validateRequired(value: string) {", newLineNo: 9 },
      { type: "added",   content: "  return value.trim().length > 0;", newLineNo: 10 },
      { type: "added",   content: "}", newLineNo: 11 },
    ],
  },
];

const STATS = MOCK_FILES.reduce(
  (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
  { additions: 0, deletions: 0 },
);

// ─── DiffSummaryBar ───────────────────────────────────────────────────────────

function DiffSummaryBar() {
  const total = STATS.additions + STATS.deletions;
  const addRatio = total > 0 ? (STATS.additions / total) * 100 : 50;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
        +{STATS.additions}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-900/[0.06] dark:bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${addRatio}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-red-600 dark:text-red-400">
        -{STATS.deletions}
      </span>
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

type FilterType = "all" | "added" | "modified" | "deleted" | "renamed";

const FILTER_LABELS: Record<FilterType, string> = {
  all:      "전체",
  added:    "추가",
  modified: "수정",
  deleted:  "삭제",
  renamed:  "이동",
};

interface FilterBarProps {
  active: FilterType;
  onChange: (f: FilterType) => void;
}

function FilterBar({ active, onChange }: FilterBarProps) {
  const filters = (Object.keys(FILTER_LABELS) as FilterType[]);
  return (
    <div className="flex gap-1 rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.02] p-0.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={[
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            active === f
              ? "bg-white text-gray-900/70 shadow-sm dark:bg-white/[0.08] dark:text-white/70"
              : "text-gray-900/35 hover:text-gray-900/60 dark:text-white/35 dark:hover:text-white/60",
          ].join(" ")}
        >
          {FILTER_LABELS[f]}
          {f !== "all" && (
            <span className="ml-1 opacity-50">
              {MOCK_FILES.filter((file) => file.changeType === f).length}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiffTestPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandAll, setExpandAll] = useState(false);

  const filtered = filter === "all"
    ? MOCK_FILES
    : MOCK_FILES.filter((f) => f.changeType === filter);

  return (
    <div className="min-h-screen bg-[#faf8f5] px-4 py-8 dark:bg-[#07090e]">
      <div className="mx-auto max-w-3xl">

        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-900/[0.08] text-gray-900/30 transition-colors hover:border-gray-900/[0.15] hover:text-gray-900/60 dark:border-white/[0.08] dark:text-white/30 dark:hover:border-white/[0.15] dark:hover:text-white/60"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 010 1.06L7.06 8l2.72 2.72a.75.75 0 11-1.06 1.06L5.47 8.53a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-gray-900/80 dark:text-white/80">
                Diff 뷰어 테스트
              </h1>
              <p className="text-[11px] text-gray-900/30 dark:text-white/30">
                feat/auth-refactor → main
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-2.5 py-1.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <span className="text-[11px] text-gray-900/40 dark:text-white/40">
              {MOCK_FILES.length}개 파일
            </span>
            <span className="text-gray-900/10 dark:text-white/10">·</span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              +{STATS.additions}
            </span>
            <span className="font-mono text-[11px] text-red-600 dark:text-red-400">
              -{STATS.deletions}
            </span>
          </div>
        </div>

        {/* 통계 바 */}
        <div className="mb-4 rounded-xl border border-gray-900/[0.07] bg-white/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
          <p className="mb-2 text-[11px] font-medium text-gray-900/40 dark:text-white/40">변경 통계</p>
          <DiffSummaryBar />
        </div>

        {/* 툴바 */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <FilterBar active={filter} onChange={setFilter} />
          <button
            type="button"
            onClick={() => setExpandAll((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-900/[0.07] px-2.5 py-1 text-[11px] font-medium text-gray-900/35 transition-colors hover:border-gray-900/[0.13] hover:text-gray-900/70 dark:border-white/[0.07] dark:text-white/35 dark:hover:border-white/[0.13] dark:hover:text-white/70"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              {expandAll ? (
                <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              )}
            </svg>
            {expandAll ? "모두 접기" : "모두 펼치기"}
          </button>
        </div>

        {/* 파일 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-900/[0.06] py-12 text-center dark:border-white/[0.06]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/15 dark:text-white/15">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" />
            </svg>
            <p className="text-xs text-gray-900/30 dark:text-white/30">해당 유형의 변경사항이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.map((file) => (
              <DiffFileRow
                key={`${file.filePath}-${String(expandAll)}`}
                file={file}
                defaultOpen={expandAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
