import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold tracking-tight text-emerald-400">
            Fitness Tracker
          </span>
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h1 className="text-2xl font-bold text-white">Hoş geldin, {user?.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Aktif oturum: <span className="text-slate-200">{user?.email}</span>
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Günlük Kilo', desc: 'Faz 2 (AUTH-8) ile eklenecek.' },
            { title: 'Kalori Takibi', desc: 'Faz 2 (AUTH-9) ile eklenecek.' },
            { title: 'Antrenman Kaydı', desc: 'Faz 2 (AUTH-10) ile eklenecek.' },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <h2 className="text-base font-semibold text-white">{card.title}</h2>
              <p className="mt-1 text-xs text-slate-400">{card.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
