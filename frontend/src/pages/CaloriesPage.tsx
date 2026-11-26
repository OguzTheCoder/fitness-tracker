import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import {
  calorieService,
  type CalorieEntry,
  type DailyCalorieTotal,
} from '../services/calorieService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../utils/date';

interface FormErrors {
  date?: string;
  mealName?: string;
  calories?: string;
}

function validateCalorieForm(date: string, mealName: string, caloriesText: string): FormErrors {
  const errors: FormErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Geçerli bir tarih seçiniz.';
  }
  const trimmedMeal = mealName.trim();
  if (!trimmedMeal) {
    errors.mealName = 'Öğün açıklaması giriniz.';
  } else if (trimmedMeal.length > 120) {
    errors.mealName = 'Öğün açıklaması en fazla 120 karakter olabilir.';
  }
  const kcal = Number(caloriesText);
  if (!caloriesText.trim() || Number.isNaN(kcal) || !Number.isInteger(kcal)) {
    errors.calories = 'Kalori tam sayı olmalıdır.';
  } else if (kcal < 1 || kcal > 10000) {
    errors.calories = 'Kalori 1 ile 10000 kcal arasında olmalıdır.';
  }
  return errors;
}

export function CaloriesPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyCalorieTotal[]>([]);
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
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
        const res = await calorieService.list(token, activeRange);
        setEntries(res.entries);
        setDailyTotals(res.dailyTotals);
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : 'Kalori kayıtları yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadEntries(range);
  }, [loadEntries, range]);

  const groupedByDate = useMemo(() => {
    const entriesByDate = new Map<string, CalorieEntry[]>();
    for (const entry of entries) {
      const list = entriesByDate.get(entry.date);
      if (list) list.push(entry);
      else entriesByDate.set(entry.date, [entry]);
    }

    if (dailyTotals.length > 0) {
      return dailyTotals.map((day) => ({
        ...day,
        items: entriesByDate.get(day.date) ?? [],
      }));
    }

    return Array.from(entriesByDate.entries()).map(([dayDate, items]) => ({
      date: dayDate,
      totalCalories: items.reduce((sum, item) => sum + item.calories, 0),
      count: items.length,
      items,
    }));
  }, [entries, dailyTotals]);

  const todayIso = getTodayIsoDate();
  const todayTotal =
    groupedByDate.find((group) => group.date === todayIso)?.totalCalories ?? 0;
  const totalCalories = groupedByDate.reduce((sum, group) => sum + group.totalCalories, 0);

  function resetForm() {
    setEditingId(null);
    setDate(getTodayIsoDate());
    setMealName('');
    setCalories('');
    setFieldErrors({});
    setFormError(null);
  }

  function startEdit(entry: CalorieEntry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setMealName(entry.mealName);
    setCalories(String(entry.calories));
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const errors = validateCalorieForm(date, mealName, calories);
    setFieldErrors(errors);
    setFormError(null);
    setFeedback(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        date,
        mealName: mealName.trim(),
        calories: Number(calories),
      };

      if (editingId) {
        await calorieService.update(token, editingId, payload);
        setFeedback('Kalori kaydı güncellendi.');
      } else {
        await calorieService.create(token, payload);
        setFeedback('Kalori kaydı eklendi.');
      }

      resetForm();
      await loadEntries(range);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) {
          setFieldErrors({
            date: err.fieldErrors.date?.[0],
            mealName: err.fieldErrors.mealName?.[0],
            calories: err.fieldErrors.calories?.[0],
          });
        }
      } else {
        setFormError('Kalori kaydı kaydedilirken bir hata oluştu.');
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
      await calorieService.remove(token, id);
      if (editingId === id) resetForm();
      setFeedback('Kalori kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kalori kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manuel Kalori Takibi</h1>
          <p className="mt-1 text-sm text-slate-400">
            Öğünlerini tarih ve kalori bilgisiyle kaydet, günlük toplam kalori alımını takip et.
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">Bugün: </span>
              <span className="font-semibold text-emerald-400">{todayTotal} kcal</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <span className="text-slate-400">Listelenen Toplam: </span>
              <span className="font-semibold text-slate-200">{totalCalories} kcal</span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? 'Kalori Kaydını Düzenle' : 'Yeni Kalori Kaydı'}
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
              id="calorie-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldErrors.date}
            />
            <FormField
              id="calorie-meal"
              label="Öğün"
              type="text"
              maxLength={120}
              placeholder="Örn. Kahvaltı - 2 yumurta"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              error={fieldErrors.mealName}
            />
            <FormField
              id="calorie-kcal"
              label="Kalori (kcal)"
              type="number"
              step="1"
              min="1"
              max="10000"
              placeholder="Örn. 450"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              error={fieldErrors.calories}
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
          <h2 className="text-base font-semibold text-white">Günlük Kalori Geçmişi</h2>
          <span className="text-xs text-slate-400">
            {groupedByDate.length} gün · {entries.length} öğün
          </span>
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
          <p className="py-8 text-center text-sm text-slate-400">Kalori kayıtları yükleniyor...</p>
        ) : groupedByDate.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {range.from || range.to
              ? 'Seçilen tarih aralığında kalori kaydı bulunamadı.'
              : 'Henüz kalori kaydı eklenmemiş. Yukarıdaki formdan ilk öğününü girebilirsin.'}
          </p>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <div
                key={group.date}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white">
                      {formatTurkishDate(group.date)}
                    </span>
                    <span className="text-xs text-slate-500">{group.date}</span>
                    <span className="text-xs text-slate-400">({group.count} öğün)</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                    Günlük Toplam: {group.totalCalories} kcal
                  </span>
                </div>

                <ul className="divide-y divide-slate-800/80 px-4">
                  {group.items.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="min-w-[82px] text-sm font-bold text-emerald-400">
                          {entry.calories} kcal
                        </span>
                        <span className="text-sm text-slate-200">{entry.mealName}</span>
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
