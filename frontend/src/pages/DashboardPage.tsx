import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendChart } from '../components/TrendChart';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import {
  statsService,
  type StatsDays,
  type StatsSummaryResponse,
} from '../services/statsService';
import { formatTurkishDate } from '../utils/date';

const PERIOD_OPTIONS: { days: StatsDays; label: string }[] = [
  { days: 7, label: 'Son 7 Gün' },
  { days: 30, label: 'Son 30 Gün' },
  { days: 90, label: 'Son 90 Gün' },
];

function formatWeightChange(changeKg: number | null): { text: string; tone: string } {
  if (changeKg === null) {
    return { text: 'Değişim için en az 2 ölçüm gerekli', tone: 'text-slate-400' };
  }
  if (changeKg === 0) {
    return { text: 'Dönem değişimi: 0 kg (Sabit)', tone: 'text-slate-300' };
  }
  const sign = changeKg > 0 ? '+' : '';
  return {
    text: `Dönem değişimi: ${sign}${changeKg} kg`,
    tone: changeKg < 0 ? 'text-emerald-400' : 'text-amber-300',
  };
}

export function DashboardPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<StatsDays>(7);
  const [stats, setStats] = useState<StatsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    statsService
      .getSummary(days)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'İstatistikler yüklenemedi.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const summary = stats?.summary;
  const weightDelta = formatWeightChange(summary?.weightChangeKg ?? null);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Hoş geldin, {user?.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Aktif oturum:{' '}
            <span className="text-slate-200">
              {user?.email === 'personal@local.fitness' ? 'Kişisel Profil' : user?.email}
            </span>
          </p>
        </div>

        <div role="group" aria-label="İstatistik dönemi" className="flex items-center gap-1.5">
          {PERIOD_OPTIONS.map((option) => {
            const active = days === option.days;
            return (
              <button
                key={option.days}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(option.days)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      <section aria-label="Özet kartları" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Son Kilo</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {isLoading
              ? '...'
              : summary?.latestWeightKg !== null && summary?.latestWeightKg !== undefined
                ? `${summary.latestWeightKg} kg`
                : 'Kayıt yok'}
          </p>
          <p className={`mt-1 text-xs ${weightDelta.tone}`}>
            {isLoading
              ? 'Yükleniyor...'
              : summary?.latestWeightDate
                ? `${weightDelta.text} · ${formatTurkishDate(summary.latestWeightDate)}`
                : 'Henüz ölçüm girilmedi'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Bugünkü Kalori</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {isLoading ? '...' : `${summary?.todayCalories ?? 0} kcal`}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {isLoading
              ? 'Yükleniyor...'
              : `Günlük Ort: ${summary?.averageDailyCalories ?? 0} kcal (${summary?.calorieDaysLogged ?? 0} gün)`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Antrenman Sayısı</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {isLoading ? '...' : `${summary?.workoutCount ?? 0}`}
          </p>
          <p className="mt-1 text-xs text-slate-400">Son {days} gün toplamı</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Antrenman Süresi</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {isLoading ? '...' : `${summary?.workoutDurationMinutes ?? 0} dk`}
          </p>
          <p className="mt-1 text-xs text-slate-400">Son {days} gün toplamı</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="Kilo Trendi"
          subtitle={`Son ${days} gündeki günlük kilo ölçümleri`}
          data={stats?.trends.weights ?? []}
          unit="kg"
          accent="emerald"
          emptyMessage="Bu dönem için kilo ölçümü bulunmuyor. Kilo sayfasından ilk kaydını ekleyebilirsin."
        />
        <TrendChart
          title="Günlük Kalori Trendi"
          subtitle={`Son ${days} gündeki toplam günlük kalori alımı`}
          data={stats?.trends.calories ?? []}
          unit="kcal"
          accent="sky"
          emptyMessage="Bu dönem için kalori kaydı bulunmuyor. Kalori sayfasından öğün ekleyebilirsin."
        />
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
            <h2 className="text-base font-semibold text-white group-hover:text-emerald-300">
              {card.title}
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">{card.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
