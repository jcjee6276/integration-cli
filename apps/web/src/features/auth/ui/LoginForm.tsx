"use client";

// ─── Atoms ────────────────────────────────────────────────────────────────────

interface LogoMarkProps {
  className?: string;
}

function LogoMark({ className }: LogoMarkProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="flex h-12 w-64 items-center justify-center rounded-[16px] border border-gray-900/[0.10] bg-gray-900/[0.05] shadow-[inset_0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/[0.10] dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <span className="font-mono text-sm font-bold tracking-widest text-gray-900/65 dark:text-white/65">
          INTEGRATION-CLI
        </span>
      </div>
      <div className="absolute -inset-2 rounded-[20px] bg-orange-500/10 blur-xl" />
    </div>
  );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

function InputField({ label, id, ...props }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-gray-900/50 dark:text-white/50">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-xl border border-gray-900/[0.10] bg-gray-900/[0.03] px-4 py-3 text-sm text-gray-900/90 placeholder:text-gray-900/25 outline-none ring-0 transition-all duration-200 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/15 dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/25 dark:focus:border-orange-400/50 dark:focus:ring-orange-400/10"
      />
    </div>
  );
}

interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  onClick?: () => void;
}

function SubmitButton({ label, loading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="relative w-full cursor-pointer overflow-hidden rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-orange-500 active:scale-[0.99] disabled:cursor-default disabled:opacity-60"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          로그인 중…
        </span>
      ) : (
        label
      )}
    </button>
  );
}

interface DividerProps {
  label: string;
}

function Divider({ label }: DividerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-900/[0.07] dark:bg-white/[0.07]" />
      <span className="text-xs text-gray-900/25 dark:text-white/25">{label}</span>
      <div className="h-px flex-1 bg-gray-900/[0.07] dark:bg-white/[0.07]" />
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export interface LoginFormProps {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGuestLogin: () => void;
}

export function LoginForm({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGuestLogin,
}: LoginFormProps) {
  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-8 animate-fade-in-up">
      {/* Logo */}
      <header className="flex flex-col items-center gap-5 text-center">
        <LogoMark />
        <div>
          <h1
            className="text-[2.25rem] font-bold leading-none tracking-[-0.03em]"
            style={{
              background: "var(--heading-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            JC-CLI
          </h1>
          <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.06em] text-gray-900/28 dark:text-white/28">
            하나의 플랫폼에서 모든 AI CLI를 제어합니다
          </p>
        </div>
      </header>

      {/* Card */}
      <div className="w-full rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.025] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.025]">
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />

        <div className="flex flex-col gap-1.5 mb-6">
          <h2 className="text-[15px] font-semibold text-gray-900/90 dark:text-white/90">
            로그인
          </h2>
          <p className="text-[13px] text-gray-900/35 dark:text-white/35">
            계정에 로그인하여 서비스를 이용하세요.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <InputField
            id="email"
            label="이메일"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <InputField
            id="password"
            label="비밀번호"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-500 dark:text-red-400">
              {error}
            </p>
          )}

          <SubmitButton label="로그인" loading={loading} />
        </form>

        <div className="mt-4 flex flex-col gap-4">
          <Divider label="또는" />
          <button
            type="button"
            onClick={onGuestLogin}
            className="w-full cursor-pointer rounded-xl border border-gray-900/[0.09] bg-transparent py-3 text-sm font-medium text-gray-900/60 transition-all duration-200 hover:border-gray-900/[0.14] hover:bg-gray-900/[0.03] hover:text-gray-900/80 dark:border-white/[0.09] dark:text-white/60 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.03] dark:hover:text-white/80"
          >
            게스트로 계속하기
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-900/25 dark:text-white/25">
        계정이 없으신가요?{" "}
        <button type="button" className="cursor-pointer text-orange-600 transition-colors hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300">
          회원가입
        </button>
      </p>
    </div>
  );
}
