import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../DateRangeFilter';
import { FormField } from '../FormField';
import { ApiError } from '../../services/api';
import { stepService, type StepEntry, type StepSummary } from '../../services/workoutService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../../utils/date';

export function StepsTab() {
  const [entries, setEntries] = useState<StepEntry[]>([]);
  const [summary, setSummary] = useState<StepSummary>({
    dailyStepGoal: 8000,
    todayDate: getTodayIsoDate(),
    todaySteps: 0,
    todayProgressPercent: 0,
    totalSteps: 0,
    averageDailySteps: 0,
    daysLogged: 0,
    goalMetDays: 0,
  });
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async (activeRange: DateRange) => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await stepService.list(activeRange);
      setEntries(res.entries);
      setSummary(res.summary);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Adım kayıtları yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries(range);
  }, [loadEntries, range]);

  function resetForm() {
    setEditingId(null);
    setDate(getTodayIsoDate());
    setSteps('');
    setNote('');
    setFormError(null);
  }

  function startEdit(entry: StepEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setSteps(String(entry.steps));
    setNote(entry.note ?? '');
    setFormError(null);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('Geçerli bir tarih seçiniz.');
      return;
    }
    const parsedSteps = Number(steps);
    if (!steps.trim() || !Number.isInteger(parsedSteps) || parsedSteps < 0 || parsedSteps > 200000) {
      setFormError('Adım sayısı 0 ile 200.000 arasında tam sayı olmalıdır.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        date,
        steps: parsedSteps,
        note: note.trim() || null,
      };
      if (editingId) {
        await stepService.update(editingId, payload);
        setFeedback('Adım kaydı güncellendi.');
      } else {
        const res = await stepService.upsert(payload);
        setFeedback(
          res.updated
            ? 'Bu tarihteki adım kaydı güncellendi.'
            : 'Günlük adım kaydı eklendi.',
        );
      }
      resetForm();
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Adım kaydı kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await stepService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Adım kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Adım kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  const barPercent = Math.min(100, summary.todayProgressPercent);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-400">Bugünkü Adım İlerlemesi</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {summary.todaySteps.toLocaleString('tr-TR')}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {summary.dailyStepGoal.toLocaleString('tr-TR')} adım
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <span className="text-slate-400">Günlük Ort: </span>
              <span className="font-semibold text-slate-200">
                {summary.averageDailySteps.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <span className="text-slate-400">Hedef Tutulan: </span>
              <span className="font-semibold text-emerald-400">
                {summary.goalMetDays} / {summary.daysLogged} gün
              </span>
            </div>
          </div>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${barPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          %{summary.todayProgressPercent} tamamlandı · Günlük hedefi Profil sayfasından değiştirebilirsin.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? 'Adım Kaydını Düzenle' : 'Günlük Adım Gir / Güncelle'}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Aynı tarih için tekrar giriş yaptığında o günün adım sayısı otomatik güncellenir.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {formError}
            </div>
          )}
          {feedback && (
            <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {feedback}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="steps-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <FormField
              id="steps-count"
              label="Adım Sayısı"
              type="number"
              min="0"
              max="200000"
              step="1"
              placeholder="Örn. 9500"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
            <FormField
              id="steps-note"
              label="Not (Opsiyonel)"
              type="text"
              maxLength={200}
              placeholder="Örn. Akşam yürüyüşü"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Adım Kaydet'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
              >
                İptal
              </button>
            )}
          </div>
        </form>
      </section>

      <DateRangeFilter value={range} onApply={setRange} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Adım Geçmişi</h2>
          <span className="text-xs text-slate-400">{entries.length} gün</span>
        </div>

        {listError && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {listError}
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Adım kayıtları yükleniyor...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Henüz günlük adım kaydı eklenmemiş.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {entries.map((entry) => {
              const goalMet = entry.steps >= summary.dailyStepGoal;
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-base font-semibold text-white">
                        {entry.steps.toLocaleString('tr-TR')} adım
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          goalMet
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {goalMet ? 'Hedef Tamam' : `%${Math.round((entry.steps / summary.dailyStepGoal) * 100)}`}
                      </span>
                      <span className="text-sm text-slate-300">{formatTurkishDate(entry.date)}</span>
                    </div>
                    {entry.note && <p className="text-sm text-slate-400">{entry.note}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/60 hover:text-emerald-300"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === entry.id}
                      onClick={() => void handleDelete(entry.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-50"
                    >
                      {deletingId === entry.id ? 'Siliniyor...' : 'Sil'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
