import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/api';
import {
  recipeService,
  type FoodItem,
  type Recipe,
  type RecipePayload,
} from '../../services/nutritionService';
import { FormField } from '../FormField';

interface RecipesTabProps {
  foods: FoodItem[];
  recipes: Recipe[];
  onChanged: () => Promise<void>;
}

interface IngredientRow {
  foodId: string;
  grams: string;
}

export function RecipesTab({ foods, recipes, onChanged }: RecipesTabProps) {
  const defaultFoodId = foods[0]?.id ?? '';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servingsCount, setServingsCount] = useState('1');
  const [cookedWeightG, setCookedWeightG] = useState('');
  const [rows, setRows] = useState<IngredientRow[]>([
    { foodId: defaultFoodId, grams: '100' },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const liveTotals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    let rawWeightG = 0;

    for (const row of rows) {
      const food = foodById.get(row.foodId || defaultFoodId);
      const grams = Number(row.grams);
      if (!food || !Number.isFinite(grams) || grams <= 0) continue;
      rawWeightG += grams;
      const factor = grams / 100;
      calories += food.caloriesPer100g * factor;
      proteinG += food.proteinPer100g * factor;
      carbsG += food.carbsPer100g * factor;
      fatG += food.fatPer100g * factor;
    }

    const servings = Math.max(Number(servingsCount) || 1, 0.1);
    return {
      rawWeightG: Math.round(rawWeightG * 10) / 10,
      calories: Math.round(calories * 10) / 10,
      proteinG: Math.round(proteinG * 10) / 10,
      carbsG: Math.round(carbsG * 10) / 10,
      fatG: Math.round(fatG * 10) / 10,
      perServingCalories: Math.round((calories / servings) * 10) / 10,
    };
  }, [rows, foodById, defaultFoodId, servingsCount]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setServingsCount('1');
    setCookedWeightG('');
    setRows([{ foodId: foods[0]?.id ?? '', grams: '100' }]);
    setFormError(null);
  }

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setName(recipe.name);
    setDescription(recipe.description ?? '');
    setServingsCount(String(recipe.servingsCount));
    setCookedWeightG(recipe.cookedWeightG ? String(recipe.cookedWeightG) : '');
    setRows(recipe.items.map((item) => ({ foodId: item.foodId, grams: String(item.grams) })));
    setFormError(null);
    setFeedback(null);
  }

  function updateRow(index: number, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { foodId: foods[0]?.id ?? '', grams: '100' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!name.trim()) {
      setFormError('Tarif adı giriniz.');
      return;
    }

    const servings = Number(servingsCount);
    if (!Number.isFinite(servings) || servings <= 0) {
      setFormError('Porsiyon sayısı 0’dan büyük olmalıdır.');
      return;
    }

    const parsedItems = rows.map((row) => ({
      foodId: row.foodId || defaultFoodId,
      grams: Number(row.grams),
    }));

    if (
      parsedItems.length === 0 ||
      parsedItems.some((item) => !item.foodId || !Number.isFinite(item.grams) || item.grams <= 0)
    ) {
      setFormError('Tüm malzemeler için geçerli besin ve gram giriniz.');
      return;
    }

    const payload: RecipePayload = {
      name: name.trim(),
      description: description.trim() || null,
      servingsCount: servings,
      cookedWeightG: cookedWeightG.trim() ? Number(cookedWeightG) : null,
      items: parsedItems,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await recipeService.update(editingId, payload);
        setFeedback('Tarif güncellendi.');
      } else {
        await recipeService.create(payload);
        setFeedback('Tarif oluşturuldu.');
      }
      resetForm();
      await onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Tarif kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await recipeService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Tarif silindi. Geçmiş günlük kayıtlar etkilenmedi.');
      await onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Tarif silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="ft-card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">
          {editingId ? 'Tarifi Düzenle' : 'Yeni Tarif Oluştur'}
        </h2>

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

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="recipe-name"
              label="Tarif Adı"
              type="text"
              placeholder="Örn. Proteinli Yulaf Kasesi"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormField
              id="recipe-servings"
              label="Toplam Porsiyon Sayısı"
              type="number"
              step="0.5"
              min="0.5"
              value={servingsCount}
              onChange={(e) => setServingsCount(e.target.value)}
            />
            <FormField
              id="recipe-cooked-weight"
              label="Pişmiş Toplam Ağırlık (g, Opsiyonel)"
              type="number"
              step="1"
              min="1"
              placeholder="Boşsa malzeme toplamı"
              value={cookedWeightG}
              onChange={(e) => setCookedWeightG(e.target.value)}
            />
          </div>

          <FormField
            id="recipe-desc"
            label="Not / Açıklama (Opsiyonel)"
            type="text"
            placeholder="Örn. 2 günlük öğün hazırlığı"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Malzemeler
              </span>
              <button
                type="button"
                onClick={addRow}
                className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                + Malzeme Ekle
              </button>
            </div>

            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                <select
                  aria-label={`Malzeme ${index + 1}`}
                  value={row.foodId || defaultFoodId}
                  onChange={(e) => updateRow(index, { foodId: e.target.value })}
                  className="ft-input py-2"
                >
                  {foods.map((food) => (
                    <option key={food.id} value={food.id}>
                      {food.name} ({food.caloriesPer100g} kcal/100g)
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Malzeme ${index + 1} gram`}
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Gram"
                  value={row.grams}
                  onChange={(e) => updateRow(index, { grams: e.target.value })}
                  className="ft-input py-2"
                />
                <button
                  type="button"
                  disabled={rows.length <= 1}
                  onClick={() => removeRow(index)}
                  className="ft-btn-danger py-2"
                >
                  Kaldır
                </button>
              </div>
            ))}
          </div>

          <div className="ft-card-subtle flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-ink-secondary">
            <span>
              Toplam ({liveTotals.rawWeightG} g):{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {liveTotals.calories} kcal
              </strong>{' '}
              · P: {liveTotals.proteinG}g · K: {liveTotals.carbsG}g · Y: {liveTotals.fatG}g ·
              Porsiyon başı: <strong className="text-ink">{liveTotals.perServingCalories} kcal</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSaving || foods.length === 0}
                className="ft-btn-primary py-2 text-xs"
              >
                {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Tarifi Kaydet'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="ft-btn-ghost py-2">
                  İptal
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <section className="ft-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Kayıtlı Tariflerim</h2>
          <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            {recipes.length} tarif
          </span>
        </div>

        {recipes.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Henüz tarif oluşturmadın. Yukarıdan birden çok malzemeyle ilk tarifini ekleyebilirsin.
          </p>
        ) : (
          <div className="space-y-4">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="ft-card-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{recipe.name}</h3>
                    {recipe.description && (
                      <p className="mt-0.5 text-xs text-ink-muted">{recipe.description}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-secondary">
                      1 Porsiyon:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {recipe.perServing.calories} kcal
                      </strong>{' '}
                      (P: {recipe.perServing.proteinG}g · K: {recipe.perServing.carbsG}g · Y:{' '}
                      {recipe.perServing.fatG}g) · Toplam: {recipe.servingsCount} pors. /{' '}
                      {recipe.totalWeightG} g
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(recipe)}
                      className="ft-btn-secondary py-1.5"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === recipe.id}
                      onClick={() => void handleDelete(recipe.id)}
                      className="ft-btn-danger py-1.5"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-2">
                  {recipe.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-secondary"
                    >
                      {item.foodName} · {item.grams} g ({item.calories} kcal)
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
