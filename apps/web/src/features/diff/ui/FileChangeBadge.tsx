"use client";

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

const CONFIG: Record<ChangeType, { label: string; className: string }> = {
  added:    { label: "추가", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  modified: { label: "수정", className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  deleted:  { label: "삭제", className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  renamed:  { label: "이동", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
};

interface Props {
  type: ChangeType;
}

export function FileChangeBadge({ type }: Props) {
  const { label, className } = CONFIG[type];
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}
