import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ScanBarcode,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { ApiError } from '../../services/api';
import {
  nutritionService,
  type FoodItem,
  type NutritionLog,
  type NutritionLogsResponse,
  type Recipe,
} from '../../services/nutritionService';
import { formatTurkishDate, getTodayIsoDate } from '../../utils/date';
import { ProgressRing } from '../ui/ProgressRing';
import { SlideOver } from '../ui/SlideOver';
import { BarcodeLookupPanel } from './BarcodeLookupPanel';

const MEAL_PRESETS = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün'];

interface DailyNutritionTabProps {
  foods: FoodItem[];
  recipes: Recipe[];
  initialAction?: 'add' | 'barcode' | null;
  onConsumeInitialAction?: () => void;
  onCatalogChanged: () => Promise<void>;
  onDefineCustomFood: (barcode: string) => void;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

function clampPercent(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

export function DailyNutritionTab({
  foods,
  recipes,
  initialAction,
  onConsumeInitialAction,
  onCatalogChanged,
  onDefineCustomFood,
}: DailyNutritionTabProps) {
  const [date, setDate] = useState(getTodayIsoDate);
  const [data, setData] = useState<NutritionLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [showBarcodePanel, setShowBarcodePanel] = useState(false);

  const [kind, setKind] = useState<'food' | 'recipe'>('food');
  const [mealLabel, setMealLabel] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [foodMode, setFoodMode] = useState<'grams' | 'servings'>('grams');
  const [foodAmount, setFoodAmount] = useState('100');

  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipeMode, setRecipeMode] = useState<'servings' | 'grams' | 'decompose'>('servings');
  const [recipeAmount, setRecipeAmount] = useState('1');

  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editGrams, setEditGrams] = useState('');
  const [editMealLabel, setEditMealLabel] = useState('');
  const [busyLogId, setBusyLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'add') {
      setAddDrawerOpen(true);
    } else if (initialAction === 'barcode') {
      setShowBarcodePanel(true);
    }
    onConsumeInitialAction?.();
  }, [initialAction, onConsumeInitialAction]);

  const loadDay = useCallback(async (targetDate: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await nutritionService.listLogs({ date: targetDate });
      setData(res);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Günlük beslenme verileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDay(date);
  }, [date, loadDay]);

  const filteredFoods = useMemo(() => {
    const needle = foodSearch.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return foods;
    return foods.filter(
      (f) =>
        f.name.toLocaleLowerCase('tr-TR').includes(needle) ||
        (f.brand?.toLocaleLowerCase('tr-TR').includes(needle) ?? false) ||
        (f.barcode?.toLocaleLowerCase('tr-TR').includes(needle) ?? false),
    );
  }, [foods, foodSearch]);

  useEffect(() => {
    if (!selectedFoodId && filteredFoods.length > 0) {
      setSelectedFoodId(filteredFoods[0].id);
    } else if (
      selectedFoodId &&
      filteredFoods.length > 0 &&
      !filteredFoods.some((f) => f.id === selectedFoodId)
    ) {
      setSelectedFoodId(filteredFoods[0].id);
    }
  }, [filteredFoods, selectedFoodId]);

  useEffect(() => {
    if (!selectedRecipeId && recipes.length > 0) {
      setSelectedRecipeId(recipes[0].id);
    }
  }, [recipes, selectedRecipeId]);

  const selectedFood = useMemo(
    () => foods.find((f) => f.id === selectedFoodId) ?? null,
    [foods, selectedFoodId],
  );
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  );

  const preview = useMemo(() => {
    const amount = Number(foodAmount);
    if (kind === 'food' && selectedFood && amount > 0) {
      const grams =
        foodMode === 'servings' ? amount * (selectedFood.servingGrams ?? 100) : amount;
      const factor = grams / 100;
      return {
        grams: Math.round(grams * 10) / 10,
        calories: Math.round(selectedFood.caloriesPer100g * factor * 10) / 10,
        proteinG: Math.round(selectedFood.proteinPer100g * factor * 10) / 10,
        carbsG: Math.round(selectedFood.carbsPer100g * factor * 10) / 10,
        fatG: Math.round(selectedFood.fatPer100g * factor * 10) / 10,
      };
    }

    const rAmount = Number(recipeAmount);
    if (kind === 'recipe' && selectedRecipe && rAmount > 0) {
      const factor =
        recipeMode === 'grams'
          ? rAmount / Math.max(selectedRecipe.totalWeightG, 1)
          : rAmount / Math.max(selectedRecipe.servingsCount, 1);
      return {
        grams: Math.round(selectedRecipe.totalWeightG * factor * 10) / 10,
        calories: Math.round(selectedRecipe.totals.calories * factor * 10) / 10,
        proteinG: Math.round(selectedRecipe.totals.proteinG * factor * 10) / 10,
        carbsG: Math.round(selectedRecipe.totals.carbsG * factor * 10) / 10,
        fatG: Math.round(selectedRecipe.totals.fatG * factor * 10) / 10,
      };
    }
    return null;
  }, [kind, selectedFood, foodMode, foodAmount, selectedRecipe, recipeMode, recipeAmount]);

  async function handleAddLog(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFeedback(null);

    const trimmedMeal = mealLabel.trim() || null;

    if (kind === 'food') {
      const num = Number(foodAmount);
      if (!selectedFoodId) {
        setFormError('Lütfen bir besin seçiniz.');
        return;
      }
      if (!Number.isFinite(num) || num <= 0) {
        setFormError('Geçerli bir miktar giriniz.');
        return;
      }

      setIsSubmitting(true);
      try {
        await nutritionService.createLog({
          kind: 'food',
          date,
          mealLabel: trimmedMeal,
          foodId: selectedFoodId,
          quantityMode: foodMode,
          ...(foodMode === 'grams' ? { grams: num } : { servings: num }),
        });
        setFeedback('Besin günlük kayda eklendi.');
        await loadDay(date);
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : 'Kayıt eklenemedi.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const num = Number(recipeAmount);
    if (!selectedRecipeId) {
      setFormError('Lütfen bir tarif seçiniz.');
      return;
    }
    if (!Number.isFinite(num) || num <= 0) {
      setFormError('Geçerli bir miktar giriniz.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await nutritionService.createLog({
        kind: 'recipe',
        date,
        mealLabel: trimmedMeal,
        recipeId: selectedRecipeId,
        mode: recipeMode,
        ...(recipeMode === 'grams' ? { grams: num } : { servings: num }),
      });
      setFeedback(
        recipeMode === 'decompose'
          ? `Tarif ${res.logs.length} malzeme halinde günlük kayda eklendi.`
          : 'Tarif günlük kayda eklendi.',
      );
      await loadDay(date);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Tarif eklenemedi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditLog(log: NutritionLog) {
    setEditingLogId(log.id);
    setEditGrams(String(log.grams));
    setEditMealLabel(log.mealLabel ?? '');
    setFormError(null);
    setFeedback(null);
  }

  async function saveEditLog(logId: string) {
    const grams = Number(editGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      setFormError('Geçerli bir gram değeri giriniz.');
      return;
    }
    setBusyLogId(logId);
    setFormError(null);
    try {
      await nutritionService.updateLog(logId, {
        grams,
        mealLabel: editMealLabel.trim() || null,
      });
      setEditingLogId(null);
      setFeedback('Kayıt güncellendi (snapshot değerleri korundu).');
      await loadDay(date);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kayıt güncellenemedi.');
    } finally {
      setBusyLogId(null);
    }
  }

  async function handleDeleteLog(logId: string) {
    setBusyLogId(logId);
    setFormError(null);
    setFeedback(null);
    try {
      await nutritionService.removeLog(logId);
      if (editingLogId === logId) setEditingLogId(null);
      setFeedback('Kayıt silindi.');
      await loadDay(date);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kayıt silinemedi.');
    } finally {
      setBusyLogId(null);
    }
  }

  const totals = data?.totals;
  const goals = data?.goals;

  return (
    <div className="space-y-5">
      {/* Tarih seçici + Hızlı Ekleme Aksiyonları */}
      <section className="ft-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDate((prev) => shiftIsoDate(prev, -1))}
            aria-label="Önceki gün"
            className="ft-btn-secondary px-2.5 py-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            aria-label="Beslenme tarihi"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ft-input w-auto py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setDate((prev) => shiftIsoDate(prev, 1))}
            aria-label="Sonraki gün"
            className="ft-btn-secondary px-2.5 py-2"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDate(getTodayIsoDate())}
            className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
          >
            Bugün
          </button>
          <span className="ml-1 hidden text-xs font-medium text-ink-muted sm:inline">
            {formatTurkishDate(date)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={showBarcodePanel}
            onClick={() => setShowBarcodePanel(true)}
            className="ft-btn-secondary py-2"
          >
            <ScanBarcode className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <span>Barkod / QR Tara</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setAddDrawerOpen(true);
            }}
            className="ft-btn-primary py-2 text-xs"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Besin / Tarif Ekle</span>
          </button>
        </div>
      </section>

      {feedback && !addDrawerOpen && (
        <div role="status" className="ft-alert-success">
          {feedback}
        </div>
      )}

      {loadError && (
        <div role="alert" className="ft-alert-error">
          {loadError}
        </div>
      )}

      {/* Günlük Kalori Halkası + Makro İlerleme Çubukları */}
      {totals && goals && (
        <section className="ft-card grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={totals.calories}
              max={goals.dailyCalorieGoal}
              size={108}
              strokeWidth={10}
              accent="emerald"
              label="Günlük kalori hedefi"
              centerText={`${totals.calories}`}
              centerSubtext="kcal"
            />
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Günlük Kalori
              </p>
              <p className="text-2xl font-bold text-ink">{totals.calories} kcal</p>
              <p className="text-xs text-ink-muted">Hedef: {goals.dailyCalorieGoal} kcal</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Protein',
                value: totals.proteinG,
                goal: goals.proteinGoalG,
                barClass: 'bg-sky-500',
              },
              {
                label: 'Karbonhidrat',
                value: totals.carbsG,
                goal: goals.carbsGoalG,
                barClass: 'bg-amber-500',
              },
              {
                label: 'Yağ',
                value: totals.fatG,
                goal: goals.fatGoalG,
                barClass: 'bg-rose-500',
              },
            ].map((macro) => {
              const pct = clampPercent(macro.value, macro.goal);
              return (
                <div key={macro.label} className="ft-card-subtle p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-secondary">{macro.label}</span>
                    <span className="text-[11px] text-ink-muted">Hedef: {macro.goal} g</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {macro.value} <span className="text-xs font-normal text-ink-muted">g</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${macro.barClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Görünür Mikro Besinler */}
      {data && (
        <section className="ft-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Görünür Mikro Besinler</h2>
              <p className="text-xs text-ink-muted">
                Profilinde seçili vitamin ve minerallerin günlük toplamı
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Görünürleri düzenle →</span>
            </Link>
          </div>
          {data.visibleMicronutrients.length === 0 ? (
            <p className="mt-3 text-xs text-ink-muted">
              Profil ayarlarında görünür mikro besin seçilmemiş.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {data.visibleMicronutrients.map((micro) => (
                <div key={micro.key} className="ft-card-subtle px-3 py-2.5">
                  <p className="truncate text-[11px] font-medium text-ink-muted">{micro.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-ink">
                    {micro.amount}{' '}
                    <span className="text-xs font-normal text-ink-muted">{micro.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Günlük Kayıtlar Listesi */}
      <section className="ft-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Günün Kayıtları</h2>
          <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            {data?.logs.length ?? 0} kayıt
          </span>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Kayıtlar yükleniyor...</p>
        ) : !data || data.logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-subtle px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">
              Bu tarih için henüz beslenme kaydı yok. Yukarıdan besin, tarif veya barkod
              ekleyebilirsin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.logs.map((log) => {
              const isEditing = editingLogId === log.id;
              return (
                <li key={log.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{log.entryName}</span>
                        {log.mealLabel && (
                          <span className="rounded-full border border-line bg-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                            {log.mealLabel}
                          </span>
                        )}
                        <span className="text-xs text-ink-muted">
                          {log.grams} g{log.servings ? ` (${log.servings} pors.)` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {log.calories} kcal
                        </span>{' '}
                        · P: {log.proteinG}g · K: {log.carbsG}g · Y: {log.fatG}g
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditLog(log)}
                          className="ft-btn-secondary py-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Düzenle</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyLogId === log.id}
                        onClick={() => void handleDeleteLog(log.id)}
                        className="ft-btn-danger py-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Sil</span>
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="ft-card-subtle mt-3 flex flex-wrap items-end gap-2 p-3">
                      <div>
                        <label className="block text-[11px] font-medium text-ink-muted">Gram</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={editGrams}
                          onChange={(e) => setEditGrams(e.target.value)}
                          className="ft-input-sm mt-1 w-28"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-muted">
                          Öğün Etiketi
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={editMealLabel}
                          onChange={(e) => setEditMealLabel(e.target.value)}
                          className="ft-input-sm mt-1 w-40"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busyLogId === log.id}
                        onClick={() => void saveEditLog(log.id)}
                        className="ft-btn-primary py-1.5 text-xs"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLogId(null)}
                        className="ft-btn-ghost py-1.5"
                      >
                        İptal
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Açılır Çekmece / Panel: Günlük Kayda Besin veya Tarif Ekle (Canlı Arama Combobox) */}
      <SlideOver
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        title="Günlük Kayda Ekle"
        subtitle={`${formatTurkishDate(date)} için besin veya tarif ekle`}
      >
        <div className="space-y-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-subtle p-1"
            role="group"
            aria-label="Kayıt türü"
          >
            <button
              type="button"
              onClick={() => setKind('food')}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                kind === 'food'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Besin Ekle
            </button>
            <button
              type="button"
              onClick={() => setKind('recipe')}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                kind === 'recipe'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Tarif Ekle
            </button>
          </div>

          <form onSubmit={handleAddLog} noValidate className="space-y-4">
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

            {/* Opsiyonel öğün etiketi */}
            <div className="space-y-2">
              <label htmlFor="log-meal-label" className="block text-xs font-semibold text-ink-secondary">
                Öğün Etiketi (Opsiyonel)
              </label>
              <input
                id="log-meal-label"
                type="text"
                maxLength={40}
                placeholder="Boş bırakılabilir (örn. Kahvaltı)"
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                className="ft-input py-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {MEAL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMealLabel(mealLabel === preset ? '' : preset)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      mealLabel === preset
                        ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/50 dark:text-emerald-300'
                        : 'border border-line-strong bg-subtle text-ink-muted hover:text-ink'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {kind === 'food' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="log-food-search" className="block text-xs font-semibold text-ink-secondary">
                    Besin Ara
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                      aria-hidden="true"
                    />
                    <input
                      id="log-food-search"
                      type="text"
                      placeholder="Örn. tavuk, yumurta, yulaf veya barkod..."
                      value={foodSearch}
                      onChange={(e) => setFoodSearch(e.target.value)}
                      className="ft-input py-2 pl-9"
                    />
                  </div>
                </div>

                {/* Canlı aramalı besin listesi (Combobox) */}
                <div
                  role="listbox"
                  aria-label="Besin seçimi"
                  className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-subtle p-2"
                >
                  {filteredFoods.length === 0 ? (
                    <p className="py-4 text-center text-xs text-ink-muted">
                      Aramana uygun besin bulunamadı.
                    </p>
                  ) : (
                    filteredFoods.slice(0, 30).map((food) => {
                      const isSelected = food.id === selectedFoodId;
                      return (
                        <button
                          key={food.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => setSelectedFoodId(food.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                            isSelected
                              ? 'border-emerald-500/60 bg-emerald-500/12 text-ink'
                              : 'border-transparent bg-surface text-ink-secondary hover:border-line-strong'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">{food.name}</p>
                            <p className="truncate text-[11px] text-ink-muted">
                              {food.brand ? `${food.brand} · ` : ''}P:{food.proteinPer100g}g · K:
                              {food.carbsPer100g}g · Y:{food.fatPer100g}g
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {food.caloriesPer100g} kcal
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="log-food-amount" className="block text-xs font-semibold text-ink-secondary">
                    Miktar ({foodMode === 'grams' ? 'Gram' : selectedFood?.servingLabel ?? 'Porsiyon'})
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="log-food-amount"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={foodAmount}
                      onChange={(e) => setFoodAmount(e.target.value)}
                      className="ft-input py-2"
                    />
                    <select
                      aria-label="Besin ölçü birimi"
                      value={foodMode}
                      onChange={(e) => {
                        const nextMode = e.target.value as 'grams' | 'servings';
                        setFoodMode(nextMode);
                        setFoodAmount(nextMode === 'servings' ? '1' : '100');
                      }}
                      className="ft-input w-32 py-2 text-xs"
                    >
                      <option value="grams">Gram</option>
                      <option value="servings">Porsiyon</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : recipes.length === 0 ? (
              <p className="ft-card-subtle p-4 text-xs text-ink-muted">
                Henüz kayıtlı tarifin yok. Üstteki <strong>Tarifler</strong> sekmesinden ilk
                tarifini oluşturabilirsin.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="log-recipe-select" className="block text-xs font-semibold text-ink-secondary">
                    Tarif Seç
                  </label>
                  <select
                    id="log-recipe-select"
                    value={selectedRecipeId}
                    onChange={(e) => setSelectedRecipeId(e.target.value)}
                    className="ft-input py-2"
                  >
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name} ({recipe.perServing.calories} kcal/porsiyon)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="log-recipe-mode" className="block text-xs font-semibold text-ink-secondary">
                    Ekleme Yöntemi
                  </label>
                  <select
                    id="log-recipe-mode"
                    value={recipeMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'servings' | 'grams' | 'decompose';
                      setRecipeMode(nextMode);
                      setRecipeAmount(
                        nextMode === 'grams' ? String(selectedRecipe?.totalWeightG ?? 200) : '1',
                      );
                    }}
                    className="ft-input py-2"
                  >
                    <option value="servings">Porsiyonla Ekle</option>
                    <option value="grams">Gramla Ekle</option>
                    <option value="decompose">Malzemelerine Ayrıştırarak Ekle</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="log-recipe-amount" className="block text-xs font-semibold text-ink-secondary">
                    {recipeMode === 'grams' ? 'Miktar (Gram)' : 'Miktar (Porsiyon)'}
                  </label>
                  <input
                    id="log-recipe-amount"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={recipeAmount}
                    onChange={(e) => setRecipeAmount(e.target.value)}
                    className="ft-input py-2"
                  />
                </div>
              </div>
            )}

            {preview && (
              <div className="ft-card-subtle space-y-3 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Önizleme ({preview.grams} g)</span>
                  <strong className="text-sm text-emerald-600 dark:text-emerald-400">
                    {preview.calories} kcal
                  </strong>
                </div>
                <p className="text-xs text-ink-muted">
                  P: <strong className="text-ink">{preview.proteinG}g</strong> · K:{' '}
                  <strong className="text-ink">{preview.carbsG}g</strong> · Y:{' '}
                  <strong className="text-ink">{preview.fatG}g</strong>
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || (kind === 'recipe' && recipes.length === 0)}
                  className="ft-btn-primary w-full"
                >
                  {isSubmitting ? 'Ekleniyor...' : 'Kayda Ekle'}
                </button>
              </div>
            )}
          </form>
        </div>
      </SlideOver>

      {/* Barkod / QR Çekmecesi */}
      <SlideOver
        open={showBarcodePanel}
        onClose={() => setShowBarcodePanel(false)}
        title="Barkod / QR ile Hızlı Ürün Bul"
        subtitle="Önce yerel kütüphanende aranır; standart barkod yoksa Open Food Facts’ten tek seferlik çekilir."
      >
        <BarcodeLookupPanel
          date={date}
          mealLabel={mealLabel}
          onLogged={() => loadDay(date)}
          onFoodCached={onCatalogChanged}
          onDefineCustomFood={(code) => {
            setShowBarcodePanel(false);
            onDefineCustomFood(code);
          }}
          onClose={() => setShowBarcodePanel(false)}
        />
      </SlideOver>
    </div>
  );
}
