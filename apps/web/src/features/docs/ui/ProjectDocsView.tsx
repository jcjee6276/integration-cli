"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type {
  DocCard,
  DocEndpoint,
  DocEventGroup,
  DocMetric,
  DocSection,
  DocTone,
} from "../hooks/useProjectDocs";

const toneClasses: Record<
  DocTone,
  { border: string; bg: string; text: string; dot: string; fill: string }
> = {
  orange: {
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.07]",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
    fill: "bg-orange-500/[0.10]",
  },
  blue: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/[0.07]",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    fill: "bg-blue-500/[0.10]",
  },
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.07]",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    fill: "bg-emerald-500/[0.10]",
  },
  purple: {
    border: "border-purple-500/20",
    bg: "bg-purple-500/[0.07]",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
    fill: "bg-purple-500/[0.10]",
  },
  gray: {
    border: "border-gray-900/[0.08] dark:border-white/[0.08]",
    bg: "bg-gray-900/[0.035] dark:bg-white/[0.035]",
    text: "text-gray-900/55 dark:text-white/55",
    dot: "bg-gray-400",
    fill: "bg-gray-900/[0.04] dark:bg-white/[0.04]",
  },
};

const methodClasses: Record<DocEndpoint["method"], string> = {
  GET: "border-blue-500/20 bg-blue-500/[0.08] text-blue-600 dark:text-blue-400",
  POST: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400",
  PATCH: "border-purple-500/20 bg-purple-500/[0.08] text-purple-600 dark:text-purple-400",
  PUT: "border-amber-500/20 bg-amber-500/[0.08] text-amber-600 dark:text-amber-400",
  DELETE: "border-red-500/20 bg-red-500/[0.08] text-red-600 dark:text-red-400",
};

interface ProjectDocsViewProps {
  metrics: DocMetric[];
  sections: DocSection[];
  filteredSections: DocSection[];
  query: string;
  activeSection: string;
  activeSectionTitle: string;
  onQueryChange: (query: string) => void;
  onSectionChange: (sectionId: string) => void;
}

function IconFrame({ children, tone = "gray" }: { children: ReactNode; tone?: DocTone }) {
  const toneClass = toneClasses[tone];

  return (
    <span
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
        toneClass.border,
        toneClass.bg,
        toneClass.text,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" d="m14.5 14.5 3 3" />
      <circle cx="8.8" cy="8.8" r="5.8" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h5.5L15 7v9.5H6z" />
      <path strokeLinecap="round" d="M11.5 3.5V7H15M8 10h4M8 13h4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4.5h5.5V10M11.5 4.5 5 11" />
      <path
        strokeLinecap="round"
        d="M4.5 3h-1A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8A1.5 1.5 0 0 0 13 12.5v-1"
      />
    </svg>
  );
}

function MetricPanel({ metric }: { metric: DocMetric }) {
  const toneClass = toneClasses[metric.tone];

  return (
    <div className={["min-w-0 rounded-xl border p-3", toneClass.border, toneClass.bg].join(" ")}>
      <div className="flex items-center gap-2">
        <span className={["h-1.5 w-1.5 rounded-full", toneClass.dot].join(" ")} />
        <p className="text-[10px] font-semibold tracking-[0.08em] text-gray-900/35 uppercase dark:text-white/35">
          {metric.label}
        </p>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-gray-900/80 dark:text-white/80">
        {metric.value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-900/42 dark:text-white/42">
        {metric.detail}
      </p>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-gray-900/[0.07] bg-gray-900/[0.025] px-2 py-1 text-[10px] font-medium text-gray-900/42 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white/42"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function BulletList({ bullets }: { bullets: string[] }) {
  return (
    <div className="grid gap-2">
      {bullets.map((bullet) => (
        <div
          key={bullet}
          className="flex gap-2 rounded-lg border border-gray-900/[0.06] bg-white/45 p-3 dark:border-white/[0.06] dark:bg-white/[0.025]"
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500/70" />
          <p className="text-sm leading-relaxed text-gray-900/58 dark:text-white/58">{bullet}</p>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ card }: { card: DocCard }) {
  const tone = card.tone ?? "gray";
  const toneClass = toneClasses[tone];

  return (
    <article className="rounded-xl border border-gray-900/[0.07] bg-white/55 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <IconFrame tone={tone}>
          <DocIcon />
        </IconFrame>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900/78 dark:text-white/78">
            {card.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-900/50 dark:text-white/50">
            {card.detail}
          </p>
          {card.meta && (
            <p
              className={[
                "mt-3 w-fit rounded-md px-2 py-1 font-mono text-[10px]",
                toneClass.fill,
                toneClass.text,
              ].join(" ")}
            >
              {card.meta}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function EndpointRow({ endpoint }: { endpoint: DocEndpoint }) {
  return (
    <div className="grid gap-2 rounded-lg border border-gray-900/[0.06] bg-white/50 p-3 md:grid-cols-[86px_minmax(0,1fr)_minmax(220px,0.65fr)] md:items-center dark:border-white/[0.06] dark:bg-white/[0.025]">
      <span
        className={[
          "w-fit rounded-md border px-2 py-1 font-mono text-[10px] font-bold",
          methodClasses[endpoint.method],
        ].join(" ")}
      >
        {endpoint.method}
      </span>
      <code className="min-w-0 font-mono text-xs break-all text-gray-900/72 dark:text-white/72">
        {endpoint.path}
      </code>
      <p className="text-xs leading-relaxed text-gray-900/45 dark:text-white/45">
        {endpoint.description}
      </p>
    </div>
  );
}

function EventGroupPanel({ group }: { group: DocEventGroup }) {
  return (
    <article className="rounded-xl border border-gray-900/[0.07] bg-white/55 p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md border border-blue-500/20 bg-blue-500/[0.08] px-2 py-1 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          {group.namespace}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.08em] text-gray-900/35 uppercase dark:text-white/35">
            Client to Server
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.clientEvents.map((event) => (
              <code
                key={event}
                className="rounded-md bg-gray-900/[0.04] px-2 py-1 text-[11px] text-gray-900/58 dark:bg-white/[0.05] dark:text-white/58"
              >
                {event}
              </code>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.08em] text-gray-900/35 uppercase dark:text-white/35">
            Server to Client
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.serverEvents.map((event) => (
              <code
                key={event}
                className="rounded-md bg-gray-900/[0.04] px-2 py-1 text-[11px] text-gray-900/58 dark:bg-white/[0.05] dark:text-white/58"
              >
                {event}
              </code>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function SectionBlock({ section }: { section: DocSection }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.10em] text-orange-600/80 uppercase dark:text-orange-400/80">
            {section.eyebrow}
          </span>
          <div className="h-px flex-1 bg-gray-900/[0.06] dark:bg-white/[0.06]" />
        </div>
        <h2 className="max-w-3xl text-[1.45rem] leading-tight font-semibold text-gray-900/86 dark:text-white/86">
          {section.title}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-900/52 dark:text-white/52">
          {section.summary}
        </p>
        <TagList tags={section.tags} />
      </div>

      <div className="flex flex-col gap-3">
        {section.bullets && <BulletList bullets={section.bullets} />}

        {section.cards && (
          <div className="grid gap-3 md:grid-cols-2">
            {section.cards.map((card) => (
              <InfoCard key={card.title} card={card} />
            ))}
          </div>
        )}

        {section.endpoints && (
          <div className="grid gap-2">
            {section.endpoints.map((endpoint) => (
              <EndpointRow key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
            ))}
          </div>
        )}

        {section.eventGroups && (
          <div className="grid gap-3">
            {section.eventGroups.map((group) => (
              <EventGroupPanel key={group.namespace} group={group} />
            ))}
          </div>
        )}

        {section.files && (
          <div className="grid gap-2">
            {section.files.map((file) => (
              <div
                key={file.title}
                className="rounded-lg border border-gray-900/[0.06] bg-white/45 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.025]"
              >
                <code className="font-mono text-xs text-gray-900/70 dark:text-white/70">
                  {file.title}
                </code>
                <p className="mt-1 text-xs leading-relaxed text-gray-900/42 dark:text-white/42">
                  {file.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProjectDocsView({
  metrics,
  sections,
  filteredSections,
  query,
  activeSection,
  activeSectionTitle,
  onQueryChange,
  onSectionChange,
}: ProjectDocsViewProps) {
  const handleSectionClick = (sectionId: string) => {
    try {
      onSectionChange(sectionId);
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      onSectionChange(sectionId);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-16 left-1/2 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-orange-500/[0.045] blur-[110px] dark:bg-orange-500/[0.035]" />
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: "radial-gradient(circle, var(--dot-color) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 62%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 62%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-gray-900/[0.07] bg-[#faf8f5]/82 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 dark:border-white/[0.07] dark:bg-[#07090e]/82">
          <div className="flex h-full flex-col gap-5">
            <div className="flex items-center gap-3">
              <IconFrame tone="orange">
                <DocIcon />
              </IconFrame>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900/82 dark:text-white/82">
                  JI CLI Docs
                </p>
                <p className="text-[11px] text-gray-900/35 dark:text-white/35">
                  Project architecture guide
                </p>
              </div>
            </div>

            <label className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-900/28 dark:text-white/28">
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="문서 검색"
                className="h-10 w-full rounded-lg border border-gray-900/[0.08] bg-white/65 pr-3 pl-9 text-sm text-gray-900/75 transition-colors outline-none placeholder:text-gray-900/25 focus:border-orange-500/35 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/75 dark:placeholder:text-white/25"
              />
            </label>

            <nav className="grid gap-1 lg:overflow-y-auto">
              {sections.map((section) => {
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionClick(section.id)}
                    className={[
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-orange-500/[0.10] text-orange-700 dark:text-orange-300"
                        : "text-gray-900/45 hover:bg-gray-900/[0.04] hover:text-gray-900/72 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/72",
                    ].join(" ")}
                  >
                    <span className="truncate">{section.nav}</span>
                    <span className={active ? "opacity-100" : "opacity-25"}>
                      <ArrowIcon />
                    </span>
                  </button>
                );
              })}
            </nav>

            <a
              href="http://localhost:3001/docs"
              target="_blank"
              rel="noreferrer"
              className="mt-auto hidden items-center justify-between rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.025] px-3 py-2 text-xs text-gray-900/48 transition-colors hover:border-gray-900/[0.12] hover:text-gray-900/70 lg:flex dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white/48 dark:hover:border-white/[0.12] dark:hover:text-white/70"
            >
              <span>Server OpenAPI</span>
              <ExternalIcon />
            </a>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 md:px-8 lg:px-10 lg:py-8">
          <header className="mb-6 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.10em] text-gray-900/35 uppercase dark:text-white/35">
                  Active section
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-normal text-gray-900/88 dark:text-white/88">
                  {activeSectionTitle}
                </h1>
              </div>
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-900/[0.08] bg-white/55 px-3 text-sm font-medium text-gray-900/54 transition-colors hover:border-gray-900/[0.14] hover:text-gray-900/78 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/54 dark:hover:border-white/[0.14] dark:hover:text-white/78"
              >
                <span>앱으로 이동</span>
                <ArrowIcon />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricPanel key={metric.label} metric={metric} />
              ))}
            </div>
          </header>

          {filteredSections.length === 0 ? (
            <div className="rounded-xl border border-gray-900/[0.07] bg-white/55 px-4 py-16 text-center dark:border-white/[0.07] dark:bg-white/[0.03]">
              <p className="text-sm font-medium text-gray-900/65 dark:text-white/65">
                검색 결과가 없습니다.
              </p>
              <p className="mt-1 text-xs text-gray-900/35 dark:text-white/35">
                모듈명, API 경로, 이벤트 이름으로 다시 찾아보세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-12 pb-16">
              {filteredSections.map((section) => (
                <SectionBlock key={section.id} section={section} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
