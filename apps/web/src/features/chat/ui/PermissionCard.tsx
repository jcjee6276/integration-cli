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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">C</div>
      <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm border border-yellow-700/50 bg-yellow-950/40 px-4 py-3 text-sm">
        <p className="mb-2 font-semibold text-yellow-300">실행 권한 요청</p>
        <div className="mb-3 rounded-lg bg-gray-900 px-3 py-2 font-mono text-xs text-gray-200">
          <span className="mr-2 text-gray-500">{tool}</span>
          {command}
        </div>
        {warning && <p className="mb-3 text-xs text-yellow-500/80">⚠ {warning}</p>}
        <div className="flex gap-2">
          <button onClick={onAllow} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600">허용</button>
          <button onClick={onDeny} className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-600">거부</button>
        </div>
      </div>
    </div>
  );
}
