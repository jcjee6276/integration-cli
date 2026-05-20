"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 모달 최대 너비 (Tailwind class). 기본 max-w-lg */
  maxWidth?: string;
  /** 닫기 버튼 없애기 */
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", hideClose = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC 키 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`relative flex w-full ${maxWidth} flex-col rounded-2xl border border-gray-700 bg-[#161b22] shadow-2xl`}>
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-700/60 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          {!hideClose && (
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-200"
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
    </div>
  );
}
