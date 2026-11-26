import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  enabled: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Özet', enabled: true },
  { to: '/weights', label: 'Kilo', enabled: true },
  { to: '/calories', label: 'Kalori', enabled: false },
  { to: '/workouts', label: 'Antrenman', enabled: false },
];

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

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
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
