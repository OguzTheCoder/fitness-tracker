import type { ReactNode } from 'react';
import { Activity, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      {/* Subtle ambient background accent */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/12 blur-3xl" />
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
        className="fixed right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-secondary shadow-sm transition hover:border-emerald-500/50 hover:text-ink"
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4 text-sky-600" aria-hidden="true" />
        )}
      </button>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-line bg-surface p-7 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-sm">
            <Activity className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="mt-3 inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Fitness Tracker
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        </div>

        {children}

        {footer && (
          <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
