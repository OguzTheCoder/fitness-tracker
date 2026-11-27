import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Moon,
  RefreshCw,
  Scale,
  Sun,
  User,
  UtensilsCrossed,
  WifiOff,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface NavItem {
  to: string;
  label: string;
  title: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Özet', title: 'Özet Paneli', icon: LayoutDashboard },
  { to: '/nutrition', label: 'Beslenme', title: 'Beslenme & Tarifler', icon: UtensilsCrossed },
  { to: '/workouts', label: 'Antrenman', title: 'Antrenman, Kardiyo & Adım', icon: Dumbbell },
  { to: '/weights', label: 'Kilo', title: 'Günlük Kilo', icon: Scale },
  { to: '/profile', label: 'Profil', title: 'Profil & Ayarlar', icon: User },
];

function SyncStatusBadge({ compact = false }: { compact?: boolean }) {
  const { isOnline, syncState, pendingCount, lastSyncedAt, syncError, triggerSync } = useSync();

  const lastSyncTitle = lastSyncedAt
    ? `Son eşitleme: ${new Date(lastSyncedAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Henüz eşitlenmedi';

  if (!isOnline || syncState === 'offline') {
    return (
      <span
        role="status"
        aria-live="polite"
        title="İnternet bağlantısı yok. Değişiklikler cihazda saklanıp çevrimiçi olunca eşitlenir."
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Çevrimdışı{pendingCount > 0 ? ` · ${pendingCount} bekleyen` : ''}
        </span>
      </span>
    );
  }

  if (syncState === 'syncing') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
        <span>Eşitleniyor...</span>
      </span>
    );
  }

  if (syncState === 'error') {
    return (
      <button
        type="button"
        onClick={() => void triggerSync(false)}
        title={syncError ?? 'Tekrar eşitle'}
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {compact
            ? `Hata${pendingCount > 0 ? ` (${pendingCount})` : ''}`
            : `Eşitleme hatası${pendingCount > 0 ? ` (${pendingCount})` : ''} · Tekrar dene`}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void triggerSync(false)}
      title={`${lastSyncTitle} · Eşitlemek için tıklayın`}
      aria-label="Şimdi eşitle"
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary transition hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-300"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
      <span>{pendingCount > 0 ? `Eşitle (${pendingCount})` : 'Çevrimiçi'}</span>
    </button>
  );
}

function ThemeToggleButton({ showLabel = false }: { showLabel?: boolean }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Açık Tema' : 'Koyu Tema';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      title={label}
      className={
        showLabel
          ? 'flex w-full items-center justify-between rounded-xl border border-line bg-subtle px-3 py-2 text-xs font-medium text-ink-secondary transition hover:border-emerald-500/50 hover:text-ink'
          : 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-ink-secondary transition hover:border-emerald-500/50 hover:text-ink'
      }
    >
      {showLabel ? (
        <>
          <span className="flex items-center gap-2">
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-sky-600" aria-hidden="true" />
            )}
            <span>{label}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
            {isDark ? 'Koyu' : 'Açık'}
          </span>
        </>
      ) : isDark ? (
        <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-sky-600" aria-hidden="true" />
      )}
    </button>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const currentNav =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.to)) ?? NAV_ITEMS[0];

  if (isDesktop) {
    return (
      <div className="flex min-h-screen bg-canvas text-ink">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Kenar çubuğu"
          className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-surface"
        >
          <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 font-bold tracking-tight text-ink transition hover:opacity-90"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-sm">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-sm font-bold">Fitness Tracker</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Kişisel Takip
                </span>
              </span>
            </Link>
          </div>

          <nav aria-label="Ana menü" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300'
                        : 'text-ink-secondary hover:bg-elevated hover:text-ink'
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-line p-4">
            <ThemeToggleButton showLabel />

            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-subtle px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-[11px] text-ink-muted">Aktif oturum</p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Çıkış Yap"
                title="Çıkış Yap"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Desktop Main Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/85 px-8 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <currentNav.icon className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>{currentNav.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <SyncStatusBadge />
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-7 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  // Mobile PWA Layout (Top Slim Header + Bottom Navigation Bar)
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="truncate text-sm font-bold text-ink">{currentNav.label}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <SyncStatusBadge compact />
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Çıkış Yap"
              title="Çıkış Yap"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-subtle text-ink-secondary transition hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 pb-24 pt-5">
        <Outlet />
      </main>

      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md pb-safe"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-ink-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
