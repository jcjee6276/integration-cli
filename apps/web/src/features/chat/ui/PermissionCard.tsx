interface Props {
  tool: string;
  command: string;
  warning?: string;
  onAllow: () => void;
  onDeny: () => void;
}

export function PermissionCard({ tool, command, warning, onAllow, onDeny }: Props) {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/80 text-xs font-bold text-white">C</div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm">
        <p className="mb-2 font-semibold text-amber-300/90">실행 권한 요청</p>
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 font-mono text-xs text-white/70">
          <span className="mr-2 text-white/30">{tool}</span>
          {command}
        </div>
        {warning && <p className="mb-3 text-xs text-amber-400/70">⚠ {warning}</p>}
        <div className="flex gap-2">
          <button
            onClick={onAllow}
            className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.10] px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/[0.18] hover:text-emerald-300"
          >
            허용
          </button>
          <button
            onClick={onDeny}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          >
            거부
          </button>
        </div>
      </div>
    </div>
  );
}
