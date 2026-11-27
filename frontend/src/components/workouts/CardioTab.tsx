import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../DateRangeFilter';
import { FormField } from '../FormField';
import { ApiError } from '../../services/api';
import {
  cardioService,
  type CardioEntry,
  type CardioSummary,
} from '../../services/workoutService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../../utils/date';

const DEFAULT_CARDIO_TYPES = [
  'Yürüyüş',
  'Koşu',
  'Bisiklet',
  'Eliptik',
  'Yüzme',
  'Kürek',
  'HIIT',
  'İp Atlama',
];

export function CardioTab() {
  const [entries, setEntries] = useState<CardioEntry[]>([]);
  const [cardioTypes, setCardioTypes] = useState<string[]>(DEFAULT_CARDIO_TYPES);
  const [summary, setSummary] = useState<CardioSummary>({
    totalCount: 0,
    totalDurationMinutes: 0,
    totalDistanceKm: 0,
    totalCaloriesBurned: 0,
  });
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [cardioType, setCardioType] = useState('Yürüyüş');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async (activeRange: DateRange) => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await cardioService.list(activeRange);
      setEntries(res.entries);
      setSummary(res.summary);
      if (res.cardioTypes?.length) {
        setCardioTypes(res.cardioTypes);
      }
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Kardiyo kayıtları yüklenemedi.');
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
    setCardioType('Yürüyüş');
    setDurationMinutes('');
    setDistanceKm('');
    setCaloriesBurned('');
    setNote('');
    setFormError(null);
  }

  function startEdit(entry: CardioEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setCardioType(entry.cardioType);
    setDurationMinutes(String(entry.durationMinutes));
    setDistanceKm(entry.distanceKm !== null ? String(entry.distanceKm) : '');
    setCaloriesBurned(entry.caloriesBurned !== null ? String(entry.caloriesBurned) : '');
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
    if (!cardioType.trim()) {
      setFormError('Kardiyo türü giriniz.');
      return;
    }
    const duration = Number(durationMinutes);
    if (!durationMinutes.trim() || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
      setFormError('Süre 1 ile 1440 dakika arasında tam sayı olmalıdır.');
      return;
    }

    const parsedDistance = distanceKm.trim() ? Number(distanceKm) : null;
    if (parsedDistance !== null && (Number.isNaN(parsedDistance) || parsedDistance < 0 || parsedDistance > 500)) {
      setFormError('Mesafe 0 ile 500 km arasında olmalıdır.');
      return;
    }

    const parsedCalories = caloriesBurned.trim() ? Number(caloriesBurned) : null;
    if (
      parsedCalories !== null &&
      (!Number.isInteger(parsedCalories) || parsedCalories < 0 || parsedCalories > 10000)
    ) {
      setFormError('Yakılan kalori 0 ile 10000 arasında tam sayı olmalıdır.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        date,
        cardioType: cardioType.trim(),
        durationMinutes: duration,
        distanceKm: parsedDistance,
        caloriesBurned: parsedCalories,
        note: note.trim() || null,
      };
      if (editingId) {
        await cardioService.update(editingId, payload);
        setFeedback('Kardiyo kaydı güncellendi.');
      } else {
        await cardioService.create(payload);
        setFeedback('Kardiyo kaydı eklendi.');
      }
      resetForm();
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kardiyo kaydı kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await cardioService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Kardiyo kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kardiyo kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {summary.totalCount > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="ft-card p-3.5">
            <span className="text-ink-muted">Kardiyo Sayısı</span>
            <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {summary.totalCount}
            </p>
          </div>
          <div className="ft-card p-3.5">
            <span className="text-ink-muted">Toplam Süre</span>
            <p className="mt-1 text-lg font-bold text-ink">{summary.totalDurationMinutes} dk</p>
          </div>
          {summary.totalDistanceKm > 0 && (
            <div className="ft-card p-3.5">
              <span className="text-ink-muted">Toplam Mesafe</span>
              <p className="mt-1 text-lg font-bold text-sky-600 dark:text-sky-400">
                {summary.totalDistanceKm} km
              </p>
            </div>
          )}
          {summary.totalCaloriesBurned > 0 && (
            <div className="ft-card p-3.5">
              <span className="text-ink-muted">Tahmini Yakılan</span>
              <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-300">
                {summary.totalCaloriesBurned} kcal
              </p>
            </div>
          )}
        </div>
      )}

      <section className="ft-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">
            {editingId ? 'Kardiyo Kaydını Düzenle' : 'Yeni Kardiyo Kaydı'}
          </h2>
          <p className="text-xs text-ink-muted">
            Yakılan kalori yalnızca bilgi amaçlıdır, günlük beslenme hedefine eklenmez.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError && (
            <div role="alert" className="ft-alert-error">
              {formError}
            </div>
          )}
          {feedback && (
            <div role="status" className="ft-alert-success">
              {feedback}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {cardioTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCardioType(type)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  cardioType === type
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-line-strong bg-subtle text-ink-secondary hover:text-ink'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="cardio-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <FormField
              id="cardio-type"
              label="Kardiyo Türü"
              type="text"
              maxLength={60}
              placeholder="Örn. Tempolu Yürüyüş"
              value={cardioType}
              onChange={(e) => setCardioType(e.target.value)}
            />
            <FormField
              id="cardio-duration"
              label="Süre (dk)"
              type="number"
              min="1"
              max="1440"
              step="1"
              placeholder="Örn. 30"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
            <FormField
              id="cardio-distance"
              label="Mesafe (km, Opsiyonel)"
              type="number"
              min="0"
              max="500"
              step="0.1"
              placeholder="Örn. 4.5"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
            />
            <FormField
              id="cardio-calories"
              label="Yakılan Kalori (kcal, Opsiyonel)"
              type="number"
              min="0"
              max="10000"
              step="1"
              placeholder="Örn. 260"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
            />
            <FormField
              id="cardio-note"
              label="Not (Opsiyonel)"
              type="text"
              maxLength={300}
              placeholder="Örn. Açık hava parkuru"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={isSaving} className="ft-btn-primary">
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kardiyo Kaydet'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="ft-btn-ghost text-sm">
                İptal
              </button>
            )}
          </div>
        </form>
      </section>

      <DateRangeFilter value={range} onApply={setRange} />

      <section className="ft-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Kardiyo Geçmişi</h2>
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
          <p className="py-8 text-center text-sm text-ink-muted">Kardiyo kayıtları yükleniyor...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Henüz kardiyo kaydı eklenmemiş.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-ink">{entry.cardioType}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {entry.durationMinutes} dk
                    </span>
                    {entry.distanceKm !== null && (
                      <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                        {entry.distanceKm} km
                      </span>
                    )}
                    {entry.caloriesBurned !== null && (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {entry.caloriesBurned} kcal
                      </span>
                    )}
                    <span className="text-xs text-ink-muted">{formatTurkishDate(entry.date)}</span>
                  </div>
                  {entry.note && <p className="text-xs text-ink-muted">{entry.note}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="ft-btn-secondary py-1.5"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === entry.id}
                    onClick={() => void handleDelete(entry.id)}
                    className="ft-btn-danger py-1.5"
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
