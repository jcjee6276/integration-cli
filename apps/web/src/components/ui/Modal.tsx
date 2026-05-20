"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", hideClose = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md dark:bg-black/70"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={[
          "relative flex w-full flex-col rounded-2xl",
          "border border-gray-900/[0.08] bg-white dark:border-white/[0.08] dark:bg-[#0a0c10]",
          "shadow-[0_24px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.7)]",
          maxWidth,
        ].join(" ")}
        style={{ animation: "modal-in 0.18s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-900/[0.06] px-5 py-4 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-gray-900/85 dark:text-white/85">{title}</h2>
          {!hideClose && (
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-900/25 transition-colors hover:bg-gray-900/[0.07] hover:text-gray-900/70 dark:text-white/25 dark:hover:bg-white/[0.07] dark:hover:text-white/70"
              aria-label="닫기"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: "calc(90vh - 64px)" }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
