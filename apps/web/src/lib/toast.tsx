"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastCtx {
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 4500;

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  ToastType,
  { wrap: string; iconColor: string; icon: React.ReactNode }
> = {
  success: {
    wrap: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-200",
    iconColor: "text-emerald-500",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    wrap: "border-red-500/30 bg-red-500/[0.08] text-red-800 dark:text-red-200",
    iconColor: "text-red-500",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.47 6.47a.75.75 0 011.06 0L8 6.94l.47-.47a.75.75 0 111.06 1.06L9.06 8l.47.47a.75.75 0 11-1.06 1.06L8 9.06l-.47.47a.75.75 0 01-1.06-1.06L6.94 8l-.47-.47a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  info: {
    wrap: "border-blue-500/30 bg-blue-500/[0.08] text-blue-800 dark:text-blue-200",
    iconColor: "text-blue-500",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4.5a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V5.5zm-.75 7.25a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

interface ToastItemProps {
  toast: ToastItem;
  onRemove: () => void;
}

function ToastEntry({ toast, onRemove }: ToastItemProps) {
  const [leaving, setLeaving] = useState(false);
  const style = TYPE_STYLES[toast.type];

  const handleRemove = useCallback(() => {
    setLeaving(true);
    setTimeout(onRemove, 190);
  }, [onRemove]);

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg",
        style.wrap,
        leaving ? "animate-toast-out" : "animate-toast-in",
      ].join(" ")}
    >
      <span className={`mt-0.5 shrink-0 ${style.iconColor}`}>{style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-xs opacity-60 leading-snug">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRemove}
        className="mt-0.5 shrink-0 cursor-pointer opacity-35 transition-opacity hover:opacity-70"
        aria-label="닫기"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-80 flex-col gap-2">
            {toasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastEntry toast={toast} onRemove={() => removeToast(toast.id)} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
