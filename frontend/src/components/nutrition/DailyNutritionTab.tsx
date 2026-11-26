import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../services/api';
import {
  nutritionService,
  type FoodItem,
  type NutritionLog,
  type NutritionLogsResponse,
  type Recipe,
} from '../../services/nutritionService';
import { formatTurkishDate, getTodayIsoDate } from '../../utils/date';
import { BarcodeLookupPanel } from './BarcodeLookupPanel';

const MEAL_PRESETS = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün'];

interface DailyNutritionTabProps {
  foods: FoodItem[];
  recipes: Recipe[];
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
  onCatalogChanged,
  onDefineCustomFood,
}: DailyNutritionTabProps) {
  const [date, setDate] = useState(getTodayIsoDate);
  const [data, setData] = useState<NutritionLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

    // kind === 'recipe'
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
    <div className="space-y-6">
      {/* Tarih seçici */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((prev) => shiftIsoDate(prev, -1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            ← Önceki
          </button>
          <input
            aria-label="Beslenme tarihi"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            onClick={() => setDate((prev) => shiftIsoDate(prev, 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Sonraki →
          </button>
          <button
            type="button"
            onClick={() => setDate(getTodayIsoDate())}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Bugün
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-300">{formatTurkishDate(date)}</span>
          <button
            type="button"
            aria-expanded={showBarcodePanel}
            onClick={() => setShowBarcodePanel((prev) => !prev)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              showBarcodePanel
                ? 'border border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {showBarcodePanel ? 'Tarayıcıyı Kapat' : 'Barkod / QR Tara'}
          </button>
        </div>
      </section>

      {showBarcodePanel && (
        <BarcodeLookupPanel
          date={date}
          mealLabel={mealLabel}
          onLogged={() => loadDay(date)}
          onFoodCached={onCatalogChanged}
          onDefineCustomFood={onDefineCustomFood}
          onClose={() => setShowBarcodePanel(false)}
        />
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {loadError}
        </div>
      )}

      {/* Günlük Kalori & Makro Hedef Özeti */}
      {totals && goals && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Kalori',
              value: totals.calories,
              goal: goals.dailyCalorieGoal,
              unit: 'kcal',
              barClass: 'bg-emerald-400',
            },
            {
              label: 'Protein',
              value: totals.proteinG,
              goal: goals.proteinGoalG,
              unit: 'g',
              barClass: 'bg-sky-400',
            },
            {
              label: 'Karbonhidrat',
              value: totals.carbsG,
              goal: goals.carbsGoalG,
              unit: 'g',
              barClass: 'bg-amber-400',
            },
            {
              label: 'Yağ',
              value: totals.fatG,
              goal: goals.fatGoalG,
              unit: 'g',
              barClass: 'bg-rose-400',
            },
          ].map((card) => {
            const pct = clampPercent(card.value, card.goal);
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-400">{card.label}</span>
                  <span className="text-xs text-slate-500">
                    Hedef: {card.goal} {card.unit}
                  </span>
                </div>
                <p className="mt-1.5 text-xl font-bold text-white">
                  {card.value}{' '}
                  <span className="text-xs font-normal text-slate-400">{card.unit}</span>
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full ${card.barClass}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Görünür Mikro Besinler */}
      {data && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Görünür Mikro Besinler</h2>
              <p className="text-xs text-slate-400">
                Profilinde seçili vitamin ve minerallerin günlük toplamı
              </p>
            </div>
            <Link
              to="/profile"
              className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              Görünürleri düzenle →
            </Link>
          </div>
          {data.visibleMicronutrients.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              Profil ayarlarında görünür mikro besin seçilmemiş.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {data.visibleMicronutrients.map((micro) => (
                <div
                  key={micro.key}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="text-[11px] text-slate-400">{micro.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-100">
                    {micro.amount}{' '}
                    <span className="text-xs font-normal text-slate-400">{micro.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Günlük Kayıt Ekleme Formu */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Günlük Kayda Ekle</h2>
          <div className="flex items-center gap-1.5" role="group" aria-label="Kayıt türü">
            <button
              type="button"
              onClick={() => setKind('food')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kind === 'food'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Besin Ekle
            </button>
            <button
              type="button"
              onClick={() => setKind('recipe')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kind === 'recipe'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Tarif Ekle
            </button>
          </div>
        </div>

        <form onSubmit={handleAddLog} noValidate className="mt-4 space-y-4">
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

          {/* Opsiyonel öğün etiketi */}
          <div className="space-y-1.5">
            <label htmlFor="log-meal-label" className="block text-xs font-medium text-slate-300">
              Öğün Etiketi (Opsiyonel)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="log-meal-label"
                type="text"
                maxLength={40}
                placeholder="Boş bırakılabilir (örn. Kahvaltı)"
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              />
              {MEAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMealLabel(mealLabel === preset ? '' : preset)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    mealLabel === preset
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                      : 'border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {kind === 'food' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="log-food-search" className="block text-xs font-medium text-slate-300">
                  Besin Filtrele
                </label>
                <input
                  id="log-food-search"
                  type="text"
                  placeholder="Örn. tavuk, yumurta, yulaf..."
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="log-food-select" className="block text-xs font-medium text-slate-300">
                  Besin Seç
                </label>
                <select
                  id="log-food-select"
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                >
                  {filteredFoods.length === 0 ? (
                    <option value="">Besin bulunamadı</option>
                  ) : (
                    filteredFoods.map((food) => (
                      <option key={food.id} value={food.id}>
                        {food.name} ({food.caloriesPer100g} kcal/100g)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="log-food-amount" className="block text-xs font-medium text-slate-300">
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  />
                  <select
                    aria-label="Besin ölçü birimi"
                    value={foodMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'grams' | 'servings';
                      setFoodMode(nextMode);
                      setFoodAmount(nextMode === 'servings' ? '1' : '100');
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                  >
                    <option value="grams">Gram</option>
                    <option value="servings">Porsiyon</option>
                  </select>
                </div>
              </div>
            </div>
          ) : recipes.length === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
              Henüz kayıtlı tarifin yok. Üstteki <strong>Tarifler</strong> sekmesinden ilk tarifini
              oluşturabilirsin.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="log-recipe-select" className="block text-xs font-medium text-slate-300">
                  Tarif Seç
                </label>
                <select
                  id="log-recipe-select"
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                >
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name} ({recipe.perServing.calories} kcal/porsiyon)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="log-recipe-mode" className="block text-xs font-medium text-slate-300">
                  Ekleme Yöntemi
                </label>
                <select
                  id="log-recipe-mode"
                  value={recipeMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as 'servings' | 'grams' | 'decompose';
                    setRecipeMode(nextMode);
                    setRecipeAmount(nextMode === 'grams' ? String(selectedRecipe?.totalWeightG ?? 200) : '1');
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="servings">Porsiyonla Ekle</option>
                  <option value="grams">Gramla Ekle</option>
                  <option value="decompose">Malzemelerine Ayrıştırarak Ekle</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="log-recipe-amount" className="block text-xs font-medium text-slate-300">
                  {recipeMode === 'grams' ? 'Miktar (Gram)' : 'Miktar (Porsiyon)'}
                </label>
                <input
                  id="log-recipe-amount"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={recipeAmount}
                  onChange={(e) => setRecipeAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          )}

          {preview && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs text-slate-300">
              <span>
                Önizleme ({preview.grams} g):{' '}
                <strong className="text-emerald-400">{preview.calories} kcal</strong> · P:{' '}
                {preview.proteinG}g · K: {preview.carbsG}g · Y: {preview.fatG}g
              </span>
              <button
                type="submit"
                disabled={isSubmitting || (kind === 'recipe' && recipes.length === 0)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Ekleniyor...' : 'Kayda Ekle'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Günlük Kayıtlar Listesi */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Günün Kayıtları</h2>
          <span className="text-xs text-slate-400">{data?.logs.length ?? 0} kayıt</span>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Kayıtlar yükleniyor...</p>
        ) : !data || data.logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Bu tarih için henüz beslenme kaydı yok. Yukarıdan besin veya tarif ekleyebilirsin.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {data.logs.map((log) => {
              const isEditing = editingLogId === log.id;
              return (
                <li key={log.id} className="py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{log.entryName}</span>
                        {log.mealLabel && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                            {log.mealLabel}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {log.grams} g{log.servings ? ` (${log.servings} pors.)` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-emerald-400">{log.calories} kcal</span>{' '}
                        · P: {log.proteinG}g · K: {log.carbsG}g · Y: {log.fatG}g
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditLog(log)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
                        >
                          Düzenle
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyLogId === log.id}
                        onClick={() => void handleDeleteLog(log.id)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-50"
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <div>
                        <label className="block text-[11px] text-slate-400">Gram</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={editGrams}
                          onChange={(e) => setEditGrams(e.target.value)}
                          className="mt-1 w-28 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400">Öğün Etiketi</label>
                        <input
                          type="text"
                          maxLength={40}
                          value={editMealLabel}
                          onChange={(e) => setEditMealLabel(e.target.value)}
                          className="mt-1 w-40 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busyLogId === log.id}
                        onClick={() => void saveEditLog(log.id)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLogId(null)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
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
    </div>
  );
}
