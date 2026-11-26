import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { FormField } from '../components/FormField';
import { ApiError } from '../services/api';
import { weightService, type WeightEntry } from '../services/weightService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../utils/date';

interface FormErrors {
  date?: string;
  weightKg?: string;
  note?: string;
}

function validateWeightForm(date: string, weightText: string, note: string): FormErrors {
  const errors: FormErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Geçerli bir tarih seçiniz.';
  }
  const weight = Number(weightText);
  if (!weightText.trim() || Number.isNaN(weight)) {
    errors.weightKg = 'Geçerli bir kilo değeri giriniz.';
  } else if (weight < 20 || weight > 350) {
    errors.weightKg = 'Kilo 20 ile 350 kg arasında olmalıdır.';
  }
  if (note.trim().length > 300) {
    errors.note = 'Not en fazla 300 karakter olabilir.';
  }
  return errors;
}

export function WeightsPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [weightKg, setWeightKg] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async (activeRange: DateRange) => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await weightService.list(activeRange);
      setEntries(res.entries);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Kilo kayıtları yüklenemedi.');
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
    setWeightKg('');
    setNote('');
    setFieldErrors({});
    setFormError(null);
  }

  function startEdit(entry: WeightEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setWeightKg(String(entry.weightKg));
    setNote(entry.note ?? '');
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const errors = validateWeightForm(date, weightKg, note);
    setFieldErrors(errors);
    setFormError(null);
    setFeedback(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        date,
        weightKg: Number(weightKg),
        note: note.trim() || null,
      };

      if (editingId) {
        await weightService.update(editingId, payload);
        setFeedback('Kilo kaydı güncellendi.');
      } else {
        const res = await weightService.upsert(payload);
        setFeedback(res.updated ? 'Bu tarihteki kilo kaydı güncellendi.' : 'Kilo kaydı eklendi.');
      }

      resetForm();
      await loadEntries(range);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) {
          setFieldErrors({
            date: err.fieldErrors.date?.[0],
            weightKg: err.fieldErrors.weightKg?.[0],
            note: err.fieldErrors.note?.[0],
          });
        }
      } else {
        setFormError('Kilo kaydı kaydedilirken bir hata oluştu.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await weightService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Kilo kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kilo kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  const latest = entries[0];
  const weights = entries.map((e) => e.weightKg);
  const minWeight = weights.length > 0 ? Math.min(...weights) : null;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Günlük Kilo Takibi</h1>
          <p className="mt-1 text-sm text-slate-400">
            Aynı tarihe yeni ölçüm girildiğinde mevcut gün kaydı otomatik güncellenir.
          </p>
        </div>
        {latest && (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">Son: </span>
              <span className="font-semibold text-emerald-400">{latest.weightKg} kg</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">En Düşük / Yüksek: </span>
              <span className="font-semibold text-slate-200">
                {minWeight} / {maxWeight} kg
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? 'Kilo Kaydını Düzenle' : 'Yeni Kilo Kaydı'}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="weight-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldErrors.date}
            />
            <FormField
              id="weight-kg"
              label="Kilo (kg)"
              type="number"
              step="0.1"
              min="20"
              max="350"
              placeholder="Örn. 78.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              error={fieldErrors.weightKg}
            />
            <FormField
              id="weight-note"
              label="Not (Opsiyonel)"
              type="text"
              maxLength={300}
              placeholder="Örn. Sabah aç karnına"
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
          <h2 className="text-base font-semibold text-white">Kayıt Geçmişi</h2>
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
          <p className="py-8 text-center text-sm text-slate-400">Kilo kayıtları yükleniyor...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {range.from || range.to
              ? 'Seçilen tarih aralığında kilo kaydı bulunamadı.'
              : 'Henüz kilo kaydı eklenmemiş. Yukarıdaki formdan ilk ölçümünü girebilirsin.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-emerald-400">{entry.weightKg} kg</span>
                    <span className="text-sm font-medium text-slate-200">
                      {formatTurkishDate(entry.date)}
                    </span>
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
