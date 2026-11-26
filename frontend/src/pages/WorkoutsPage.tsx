import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import {
  workoutService,
  type WorkoutEntry,
  type WorkoutSummary,
} from '../services/workoutService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../utils/date';

interface FormErrors {
  date?: string;
  name?: string;
  durationMinutes?: string;
  note?: string;
}

function validateWorkoutForm(
  date: string,
  name: string,
  durationText: string,
  note: string,
): FormErrors {
  const errors: FormErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Geçerli bir tarih seçiniz.';
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    errors.name = 'Antrenman adı giriniz.';
  } else if (trimmedName.length > 120) {
    errors.name = 'Antrenman adı en fazla 120 karakter olabilir.';
  }
  const duration = Number(durationText);
  if (!durationText.trim() || Number.isNaN(duration) || !Number.isInteger(duration)) {
    errors.durationMinutes = 'Süre tam sayı olmalıdır.';
  } else if (duration < 1 || duration > 1440) {
    errors.durationMinutes = 'Süre 1 ile 1440 dakika arasında olmalıdır.';
  }
  if (note.trim().length > 300) {
    errors.note = 'Not en fazla 300 karakter olabilir.';
  }
  return errors;
}

export function WorkoutsPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [summary, setSummary] = useState<WorkoutSummary>({
    totalCount: 0,
    totalDurationMinutes: 0,
  });
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(
    async (activeRange: DateRange) => {
      if (!token) return;
      setIsLoading(true);
      setListError(null);
      try {
        const res = await workoutService.list(token, activeRange);
        setEntries(res.entries);
        setSummary(res.summary);
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : 'Antrenman kayıtları yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadEntries(range);
  }, [loadEntries, range]);

  function resetForm() {
    setEditingId(null);
    setDate(getTodayIsoDate());
    setName('');
    setDurationMinutes('');
    setNote('');
    setFieldErrors({});
    setFormError(null);
  }

  function startEdit(entry: WorkoutEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setName(entry.name);
    setDurationMinutes(String(entry.durationMinutes));
    setNote(entry.note ?? '');
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const errors = validateWorkoutForm(date, name, durationMinutes, note);
    setFieldErrors(errors);
    setFormError(null);
    setFeedback(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        date,
        name: name.trim(),
        durationMinutes: Number(durationMinutes),
        note: note.trim() || null,
      };

      if (editingId) {
        await workoutService.update(token, editingId, payload);
        setFeedback('Antrenman kaydı güncellendi.');
      } else {
        await workoutService.create(token, payload);
        setFeedback('Antrenman kaydı eklendi.');
      }

      resetForm();
      await loadEntries(range);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) {
          setFieldErrors({
            date: err.fieldErrors.date?.[0],
            name: err.fieldErrors.name?.[0],
            durationMinutes: err.fieldErrors.durationMinutes?.[0],
            note: err.fieldErrors.note?.[0],
          });
        }
      } else {
        setFormError('Antrenman kaydı kaydedilirken bir hata oluştu.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await workoutService.remove(token, id);
      if (editingId === id) resetForm();
      setFeedback('Antrenman kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Antrenman kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Antrenman Kaydı</h1>
          <p className="mt-1 text-sm text-slate-400">
            Yaptığın antrenmanları tarih, ad, süre ve notlarınla düzenli olarak kaydet.
          </p>
        </div>
        {summary.totalCount > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">Toplam Antrenman: </span>
              <span className="font-semibold text-emerald-400">{summary.totalCount}</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">Toplam Süre: </span>
              <span className="font-semibold text-slate-200">
                {summary.totalDurationMinutes} dk
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? 'Antrenman Kaydını Düzenle' : 'Yeni Antrenman Kaydı'}
        </h2>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
            >
              {formError}
            </div>
          )}
          {feedback && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300"
            >
              {feedback}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="workout-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldErrors.date}
            />
            <FormField
              id="workout-name"
              label="Antrenman Adı"
              type="text"
              maxLength={120}
              placeholder="Örn. Üst Vücut Ağırlık"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <FormField
              id="workout-duration"
              label="Süre (dk)"
              type="number"
              step="1"
              min="1"
              max="1440"
              placeholder="Örn. 45"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              error={fieldErrors.durationMinutes}
            />
            <FormField
              id="workout-note"
              label="Not (Opsiyonel)"
              type="text"
              maxLength={300}
              placeholder="Örn. Bench press 3x10"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={fieldErrors.note}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
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
          <h2 className="text-base font-semibold text-white">Antrenman Geçmişi</h2>
          <span className="text-xs text-slate-400">{entries.length} kayıt</span>
        </div>

        {listError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            {listError}
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Antrenman kayıtları yükleniyor...
          </p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {range.from || range.to
              ? 'Seçilen tarih aralığında antrenman kaydı bulunamadı.'
              : 'Henüz antrenman kaydı eklenmemiş. Yukarıdaki formdan ilk antrenmanını girebilirsin.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base font-semibold text-white">{entry.name}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      {entry.durationMinutes} dk
                    </span>
                    <span className="text-sm text-slate-300">{formatTurkishDate(entry.date)}</span>
                    <span className="text-xs text-slate-500">{entry.date}</span>
                  </div>
                  {entry.note && <p className="text-sm text-slate-400">{entry.note}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === entry.id}
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-50"
                  >
                    {deletingId === entry.id ? 'Siliniyor...' : 'Sil'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
