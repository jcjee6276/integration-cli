"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const initial = saved ?? preferred;
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ─── Toggle Button ────────────────────────────────────────────────────────────

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        "text-gray-900/35 hover:bg-gray-900/[0.05] hover:text-gray-900/70",
        "dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/70",
        className,
      ].join(" ")}
    >
      {theme === "dark" ? (
        /* Sun icon */
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm4.47 2.53a.75.75 0 011.06 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06zm-10 0l1.06 1.06a.75.75 0 01-1.06 1.06L3.47 5.59a.75.75 0 011.06-1.06zM10 5.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zm-16.25.75a.75.75 0 010-1.5h1.5a.75.75 0 010 1.5h-1.5zm12.78 5.72a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06zm-10 0l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 1.06zM10 17.25a.75.75 0 01-.75-.75v-1.5a.75.75 0 011.5 0v1.5a.75.75 0 01-.75.75z" />
        </svg>
      ) : (
        /* Moon icon */
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}
