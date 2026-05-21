"use client";

import { useState } from "react";
import { ThemeToggle } from "@/lib/theme";
import { LoginForm } from "@/features/auth/ui/LoginForm";

// ─── Container ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 로그인 로직 연결
  };

  const handleGuestLogin = () => {
    // TODO: 게스트 로그인 로직 연결
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#faf8f5] px-6 py-12 dark:bg-[#07090e]">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[40%] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.04] blur-[120px] dark:bg-orange-500/[0.035]" />
        <div className="absolute -left-24 bottom-1/4 h-[350px] w-[450px] rounded-full bg-blue-600/[0.03] blur-[100px] dark:bg-blue-600/[0.025]" />
        <div className="absolute -right-24 top-1/4 h-[300px] w-[400px] rounded-full bg-purple-600/[0.03] blur-[100px] dark:bg-purple-600/[0.025]" />
      </div>

      {/* Dot-grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-color) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Form */}
      <div className="relative w-full flex justify-center">
        <LoginForm
          email={email}
          password={password}
          loading={loading}
          error={error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          onGuestLogin={handleGuestLogin}
        />
      </div>

      {/* Bottom rule */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-900/[0.05] to-transparent dark:via-white/[0.05]" />
    </div>
  );
}
