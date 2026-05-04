import Link from "next/link";

const AGENTS = [
  {
    href: "/claude",
    name: "Claude CLI",
    description: "Anthropic Claude를 터미널에서 실행",
    color: "from-orange-500 to-amber-500",
    available: true,
  },
  {
    href: "#",
    name: "Gemini CLI",
    description: "Google Gemini 통합 (준비 중)",
    color: "from-blue-500 to-cyan-500",
    available: false,
  },
  {
    href: "#",
    name: "Codex CLI",
    description: "OpenAI Codex 통합 (준비 중)",
    color: "from-green-500 to-emerald-500",
    available: false,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">ji-cli</h1>
        <p className="mt-3 text-gray-400">하나의 플랫폼에서 모든 AI CLI를 제어합니다</p>
      </header>

      <div className="grid w-full max-w-2xl gap-4">
        {AGENTS.map((agent) => (
          <Link
            key={agent.name}
            href={agent.href}
            aria-disabled={!agent.available}
            className={[
              "group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-6 transition-all",
              agent.available
                ? "hover:border-gray-500 hover:shadow-lg hover:shadow-black/40"
                : "cursor-not-allowed opacity-40",
            ].join(" ")}
          >
            <div
              className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${agent.color}`}
            />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                <p className="mt-1 text-sm text-gray-400">{agent.description}</p>
              </div>
              {agent.available ? (
                <span className="rounded-full bg-green-900/50 px-2.5 py-1 text-xs font-medium text-green-400">
                  사용 가능
                </span>
              ) : (
                <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-500">
                  준비 중
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
