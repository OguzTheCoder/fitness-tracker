import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { FormField } from '../components/FormField';
import { TrendChart } from '../components/TrendChart';
import { SlideOver } from '../components/ui/SlideOver';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
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

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setEditingId(null);
      setDrawerOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function resetForm() {
    setEditingId(null);
    setDate(getTodayIsoDate());
    setWeightKg('');
    setNote('');
    setFieldErrors({});
    setFormError(null);
  }

  function openNewDrawer() {
    resetForm();
    setDrawerOpen(true);
  }

  function startEdit(entry: WeightEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setWeightKg(String(entry.weightKg));
    setNote(entry.note ?? '');
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    resetForm();
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

      closeDrawer();
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
      if (editingId === id) closeDrawer();
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
  const chartData = useMemo(
    () =>
      [...entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ date: e.date, value: e.weightKg })),
    [entries],
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Günlük Kilo Takibi
          </h1>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            Aynı tarihe yeni ölçüm girildiğinde mevcut gün kaydı otomatik güncellenir.
          </p>
        </div>

        <button type="button" onClick={openNewDrawer} className="ft-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Yeni Kilo Kaydı</span>
        </button>
      </section>

      {feedback && (
        <div role="status" className="ft-alert-success">
          {feedback}
        </div>
      )}

      {latest && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="ft-card p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <Scale className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              <span>Son Ölçüm</span>
            </span>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {latest.weightKg} kg
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{formatTurkishDate(latest.date)}</p>
          </div>

          <div className="ft-card p-4">
            <span className="text-xs font-medium text-ink-muted">En Düşük</span>
            <p className="mt-1.5 text-2xl font-bold text-ink">{minWeight} kg</p>
            <p className="mt-0.5 text-xs text-ink-muted">Listelenen aralık</p>
          </div>

          <div className="ft-card p-4">
            <span className="text-xs font-medium text-ink-muted">En Yüksek</span>
            <p className="mt-1.5 text-2xl font-bold text-ink">{maxWeight} kg</p>
            <p className="mt-0.5 text-xs text-ink-muted">{entries.length} ölçüm</p>
          </div>
        </section>
      )}

      {chartData.length >= 2 && (
        <TrendChart
          title="Kilo Grafiği"
          subtitle="Seçili aralıktaki kilo değişimin"
          data={chartData}
          unit="kg"
          accent="emerald"
          emptyMessage="Kilo grafiği için en az 2 ölçüm gereklidir."
        />
      )}

      <DateRangeFilter value={range} onApply={setRange} />

      <section className="ft-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Kayıt Geçmişi</h2>
          <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            {entries.length} kayıt
          </span>
        </div>

        {listError && (
          <div role="alert" className="ft-alert-error">
            {listError}
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Kilo kayıtları yükleniyor...</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-subtle px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">
              {range.from || range.to
                ? 'Seçilen tarih aralığında kilo kaydı bulunamadı.'
                : 'Henüz kilo kaydı eklenmemiş. Yeni Kilo Kaydı butonundan ilk ölçümünü girebilirsin.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.weightKg} kg
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {formatTurkishDate(entry.date)}
                    </span>
                    <span className="text-xs text-ink-muted">{entry.date}</span>
                  </div>
                  {entry.note && <p className="text-xs text-ink-muted">{entry.note}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="ft-btn-secondary py-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Düzenle</span>
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === entry.id}
                    onClick={() => handleDelete(entry.id)}
                    className="ft-btn-danger py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{deletingId === entry.id ? 'Siliniyor...' : 'Sil'}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SlideOver
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingId ? 'Kilo Kaydını Düzenle' : 'Yeni Kilo Kaydı'}
        subtitle="Aynı tarihteki mevcut ölçüm otomatik olarak güncellenir."
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="ft-alert-error">
              {formError}
            </div>
          )}

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

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={closeDrawer} className="ft-btn-ghost text-sm">
              İptal
            </button>
            <button type="submit" disabled={isSaving} className="ft-btn-primary">
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
