import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

interface NavItem {
  to: string;
  label: string;
  enabled: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Özet', enabled: true },
  { to: '/weights', label: 'Kilo', enabled: true },
  { to: '/nutrition', label: 'Beslenme', enabled: true },
  { to: '/workouts', label: 'Antrenman', enabled: true },
  { to: '/profile', label: 'Profil', enabled: true },
];

function SyncStatusBadge() {
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
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
        <span>Çevrimdışı{pendingCount > 0 ? ` · ${pendingCount} bekleyen` : ''}</span>
      </span>
    );
  }

  if (syncState === 'syncing') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
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
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
      >
        <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
        <span>
          Eşitleme hatası{pendingCount > 0 ? ` (${pendingCount})` : ''} · Tekrar dene
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
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-300"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
      <span>{pendingCount > 0 ? `Eşitle (${pendingCount})` : 'Çevrimiçi'}</span>
    </button>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-lg font-bold tracking-tight text-emerald-400 transition hover:text-emerald-300"
            >
              Fitness Tracker
            </Link>
            <nav aria-label="Ana menü" className="flex items-center gap-1.5">
              {NAV_ITEMS.map((item) =>
                item.enabled ? (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <span
                    key={item.to}
                    title="Yakında eklenecek"
                    className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600"
                  >
                    {item.label}
                  </span>
                ),
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusBadge />
            <span className="text-sm text-slate-300">{user?.name}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/60 hover:text-rose-300"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
