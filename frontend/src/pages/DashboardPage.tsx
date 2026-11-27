import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Plus,
  Scale,
  ScanBarcode,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { FormField } from '../components/FormField';
import { TrendChart } from '../components/TrendChart';
import { ProgressRing } from '../components/ui/ProgressRing';
import { SlideOver } from '../components/ui/SlideOver';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import {
  statsService,
  type StatsDays,
  type StatsSummaryResponse,
} from '../services/statsService';
import { weightService } from '../services/weightService';
import { stepService } from '../services/workoutService';
import { formatTurkishDate, getTodayIsoDate } from '../utils/date';

const PERIOD_OPTIONS: { days: StatsDays; label: string }[] = [
  { days: 7, label: 'Son 7 Gün' },
  { days: 30, label: 'Son 30 Gün' },
  { days: 90, label: 'Son 90 Gün' },
];

type QuickDrawerType = 'weight' | 'steps' | null;

function formatWeightChange(changeKg: number | null): { text: string; tone: string } {
  if (changeKg === null) {
    return { text: 'Değişim için en az 2 ölçüm gerekli', tone: 'text-ink-muted' };
  }
  if (changeKg === 0) {
    return { text: 'Dönem değişimi: 0 kg (Sabit)', tone: 'text-ink-secondary' };
  }
  const sign = changeKg > 0 ? '+' : '';
  return {
    text: `Dönem değişimi: ${sign}${changeKg} kg`,
    tone:
      changeKg < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-300',
  };
}

export function DashboardPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<StatsDays>(7);
  const [stats, setStats] = useState<StatsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Add Drawer state (Weight or Steps right from Dashboard)
  const [quickDrawer, setQuickDrawer] = useState<QuickDrawerType>(null);
  const [quickDate, setQuickDate] = useState(getTodayIsoDate);
  const [quickValue, setQuickValue] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const loadSummary = useCallback(async (targetDays: StatsDays) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await statsService.getSummary(targetDays);
      setStats(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İstatistikler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  function openQuickDrawer(type: 'weight' | 'steps') {
    setQuickDrawer(type);
    setQuickDate(getTodayIsoDate());
    setQuickValue('');
    setQuickNote('');
    setQuickError(null);
  }

  async function handleQuickSubmit(e: FormEvent) {
    e.preventDefault();
    setQuickError(null);
    const num = Number(quickValue);

    if (quickDrawer === 'weight') {
      if (!quickValue.trim() || Number.isNaN(num) || num < 20 || num > 350) {
        setQuickError('Kilo 20 ile 350 kg arasında olmalıdır.');
        return;
      }
      setIsQuickSaving(true);
      try {
        await weightService.upsert({
          date: quickDate,
          weightKg: num,
          note: quickNote.trim() || null,
        });
        setQuickDrawer(null);
        setQuickFeedback('Hızlı kilo kaydı kaydedildi.');
        await loadSummary(days);
      } catch (err) {
        setQuickError(err instanceof ApiError ? err.message : 'Kilo kaydedilemedi.');
      } finally {
        setIsQuickSaving(false);
      }
      return;
    }

    if (quickDrawer === 'steps') {
      if (!quickValue.trim() || !Number.isInteger(num) || num < 0 || num > 200000) {
        setQuickError('Adım sayısı 0 ile 200.000 arasında tam sayı olmalıdır.');
        return;
      }
      setIsQuickSaving(true);
      try {
        await stepService.upsert({
          date: quickDate,
          steps: num,
          note: quickNote.trim() || null,
        });
        setQuickDrawer(null);
        setQuickFeedback('Hızlı adım kaydı kaydedildi.');
        await loadSummary(days);
      } catch (err) {
        setQuickError(err instanceof ApiError ? err.message : 'Adım kaydedilemedi.');
      } finally {
        setIsQuickSaving(false);
      }
    }
  }

  const summary = stats?.summary;
  const weightDelta = formatWeightChange(summary?.weightChangeKg ?? null);
  const todayCalories = summary?.todayCalories ?? 0;
  const calorieReference = Math.max(summary?.averageDailyCalories ?? 0, 2000);
  const caloriePct = Math.round((todayCalories / calorieReference) * 100);
  const todaySteps = summary?.todaySteps ?? 0;
  const dailyStepGoal = summary?.dailyStepGoal ?? 8000;
  const stepPercent = dailyStepGoal > 0 ? Math.round((todaySteps / dailyStepGoal) * 100) : 0;
  const cardioCount = summary?.cardioCount ?? 0;
  const cardioDurationMinutes = summary?.cardioDurationMinutes ?? 0;
  const cardioDistanceKm = summary?.cardioDistanceKm ?? 0;
  const stepTrend = stats?.trends.steps ?? [];

  return (
    <div className="space-y-6">
      {/* Greeting & Period Selector */}
      <section className="ft-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Hoş geldin, {user?.name}
            </h1>
            <p className="mt-1 text-xs text-ink-muted sm:text-sm">
              Aktif oturum:{' '}
              <span className="font-medium text-ink-secondary">
                {user?.email === 'personal@local.fitness' ? 'Kişisel Profil' : user?.email}
              </span>
            </p>
          </div>

          <div
            role="group"
            aria-label="İstatistik dönemi"
            className="inline-flex items-center gap-1 rounded-xl border border-line bg-subtle p-1"
          >
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
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-ink-secondary hover:bg-elevated hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div
          aria-label="Hızlı işlemler"
          className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4"
        >
          <Link to="/nutrition?action=add" className="ft-btn-primary py-2 text-xs">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Besin Ekle</span>
          </Link>
          <Link to="/nutrition?action=barcode" className="ft-btn-secondary">
            <ScanBarcode className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span>Barkod Tara</span>
          </Link>
          <button
            type="button"
            onClick={() => openQuickDrawer('weight')}
            className="ft-btn-secondary"
          >
            <Scale className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span>+ Hızlı Kilo</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickDrawer('steps')}
            className="ft-btn-secondary"
          >
            <Footprints className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span>+ Hızlı Adım</span>
          </button>
          <Link to="/workouts?action=add" className="ft-btn-secondary">
            <Dumbbell className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
            <span>+ Antrenman</span>
          </Link>
        </div>
      </section>

      {quickFeedback && (
        <div role="status" className="ft-alert-success">
          {quickFeedback}
        </div>
      )}

      {error && (
        <div role="alert" className="ft-alert-error">
          {error}
        </div>
      )}

      {/* Bento Grid: Today's Focus + Period Summary */}
      <section aria-label="Özet kartları" className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        {/* Featured Bento 1: Today's Calories Ring */}
        <div className="ft-card flex items-center justify-between gap-4 p-5 lg:col-span-6">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <Flame className="h-4 w-4 text-sky-500" aria-hidden="true" />
              <span>Bugünkü Kalori</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {isLoading ? '...' : `${todayCalories} kcal`}
            </p>
            <p className="text-xs text-ink-muted">
              {isLoading
                ? 'Yükleniyor...'
                : `Günlük Ort: ${summary?.averageDailyCalories ?? 0} kcal (${summary?.calorieDaysLogged ?? 0} gün)`}
            </p>
            <Link
              to="/nutrition"
              className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400"
            >
              <span>Beslenmeye git</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ProgressRing
            value={todayCalories}
            max={calorieReference}
            accent="sky"
            size={96}
            strokeWidth={9}
            label="Bugünkü kalori ilerlemesi"
            centerText={isLoading ? '...' : `%${caloriePct}`}
            centerSubtext="günlük"
          />
        </div>

        {/* Featured Bento 2: Today's Steps Ring */}
        <div className="ft-card flex items-center justify-between gap-4 p-5 lg:col-span-6">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <Footprints className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <span>Bugünkü Adım</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {isLoading ? '...' : todaySteps.toLocaleString('tr-TR')}
            </p>
            <p className="text-xs text-ink-muted">
              {isLoading
                ? 'Yükleniyor...'
                : `Hedef: ${dailyStepGoal.toLocaleString('tr-TR')} · Ort: ${(summary?.averageDailySteps ?? 0).toLocaleString('tr-TR')}`}
            </p>
            <Link
              to="/workouts"
              className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400"
            >
              <span>Adım & Kardiyo</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ProgressRing
            value={todaySteps}
            max={dailyStepGoal}
            accent="amber"
            size={96}
            strokeWidth={9}
            label="Bugünkü adım hedefi ilerlemesi"
            centerText={isLoading ? '...' : `%${stepPercent}`}
            centerSubtext="hedef"
          />
        </div>

        {/* Secondary Bento Row: Weight, Workouts, Cardio */}
        <div className="ft-card p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <Scale className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>Son Kilo</span>
            </span>
            {summary?.weightChangeKg !== null &&
              summary?.weightChangeKg !== undefined &&
              summary.weightChangeKg !== 0 &&
              (summary.weightChangeKg < 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              ) : (
                <TrendingUp className="h-4 w-4 text-amber-500" aria-hidden="true" />
              ))}
          </div>
          <p className="mt-2.5 text-2xl font-bold text-ink">
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

        <div className="ft-card p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <Dumbbell className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>Antrenman (Son {days} Gün)</span>
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-3">
            <p className="text-2xl font-bold text-ink">
              {isLoading ? '...' : `${summary?.workoutDurationMinutes ?? 0} dk`}
            </p>
            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {isLoading ? '...' : `${summary?.workoutCount ?? 0} seans`}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Son {days} gün toplam antrenman süresi</p>
        </div>

        <div className="ft-card p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <HeartPulse className="h-4 w-4 text-rose-500" aria-hidden="true" />
              <span>Kardiyo (Son {days} Gün)</span>
            </span>
          </div>
          <p className="mt-2.5 text-2xl font-bold text-ink">
            {isLoading ? '...' : `${cardioDurationMinutes} dk`}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {isLoading
              ? 'Yükleniyor...'
              : `${cardioCount} seans${cardioDistanceKm > 0 ? ` · ${cardioDistanceKm} km` : ''}`}
          </p>
        </div>
      </section>

      {/* Interactive Trend Charts */}
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
          emptyMessage="Bu dönem için kalori kaydı bulunmuyor. Beslenme sayfasından öğün ekleyebilirsin."
        />
      </section>

      {stepTrend.length > 0 && (
        <TrendChart
          title="Günlük Adım Trendi"
          subtitle={`Son ${days} gündeki günlük adım kayıtları`}
          data={stepTrend}
          unit="adım"
          accent="amber"
          goalValue={dailyStepGoal}
          goalLabel={`Hedef: ${dailyStepGoal.toLocaleString('tr-TR')}`}
          emptyMessage="Bu dönem için adım kaydı bulunmuyor."
        />
      )}

      {/* Quick Add Drawer (Weight / Steps) */}
      <SlideOver
        open={quickDrawer !== null}
        onClose={() => setQuickDrawer(null)}
        title={quickDrawer === 'weight' ? 'Hızlı Kilo Kaydı' : 'Hızlı Adım Kaydı'}
        subtitle={
          quickDrawer === 'weight'
            ? 'Aynı gün için mevcut kayıt varsa otomatik güncellenir.'
            : 'Bugünkü adım sayını tek adımda kaydet veya güncelle.'
        }
      >
        <form onSubmit={handleQuickSubmit} noValidate className="space-y-4">
          {quickError && (
            <div role="alert" className="ft-alert-error">
              {quickError}
            </div>
          )}

          <FormField
            id="quick-date"
            label="Tarih"
            type="date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
          />

          {quickDrawer === 'weight' ? (
            <FormField
              id="quick-weight"
              label="Kilo (kg)"
              type="number"
              step="0.1"
              min="20"
              max="350"
              placeholder="Örn. 78.4"
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
            />
          ) : (
            <FormField
              id="quick-steps"
              label="Adım Sayısı"
              type="number"
              step="1"
              min="0"
              max="200000"
              placeholder="Örn. 8500"
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
            />
          )}

          <FormField
            id="quick-note"
            label="Not (Opsiyonel)"
            type="text"
            maxLength={300}
            placeholder="Kısa not ekleyebilirsin"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setQuickDrawer(null)}
              className="ft-btn-ghost text-sm"
            >
              İptal
            </button>
            <button type="submit" disabled={isQuickSaving} className="ft-btn-primary">
              {isQuickSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
