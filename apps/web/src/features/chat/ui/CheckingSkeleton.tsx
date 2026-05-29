"use client";

export function CheckingSkeleton() {
  return (
    <div className="flex h-screen bg-[#faf8f5] dark:bg-[#07090e]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-900/[0.07] dark:border-white/[0.07]">
        <div className="relative overflow-hidden border-b border-gray-900/[0.07] px-4 py-3.5 dark:border-white/[0.07]">
          <div className="animate-shimmer-bg absolute inset-0" />
          <div className="relative flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
            <div className="h-[14px] w-20 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="h-9 rounded-lg bg-orange-500/[0.08]" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-gray-900/[0.04] dark:bg-white/[0.04]" />
            <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-900/[0.04] dark:bg-white/[0.04]" />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-lg p-3">
              <div
                className="animate-shimmer-bg absolute inset-0 rounded-lg"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div className="relative flex flex-col gap-1.5">
                <div className="h-[13px] w-28 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
                <div className="h-2.5 w-16 rounded bg-gray-900/[0.04] dark:bg-white/[0.04]" />
                <div className="h-2.5 w-32 rounded bg-gray-900/[0.03] dark:bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-orange-500 dark:border-white/[0.08]" />
        <span className="text-xs text-gray-900/20 dark:text-white/20">인증 확인 중…</span>
      </div>
    </div>
  );
}
