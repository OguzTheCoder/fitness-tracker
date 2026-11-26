import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-bold text-white">Hoş geldin, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Aktif oturum: <span className="text-slate-200">{user?.email}</span>
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            to: '/weights',
            title: 'Günlük Kilo',
            desc: 'Günlük kilonu kaydet, tarih aralığına göre geçmişini incele.',
          },
          {
            to: '/calories',
            title: 'Kalori Takibi',
            desc: 'Öğünlerini kaydet ve günlük toplam kalori alımını takip et.',
          },
          {
            to: '/workouts',
            title: 'Antrenman Kaydı',
            desc: 'Antrenmanlarını süre ve notlarınla düzenli olarak kaydet.',
          },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-emerald-500/50 hover:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white group-hover:text-emerald-300">
                {card.title}
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                Aktif
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{card.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
