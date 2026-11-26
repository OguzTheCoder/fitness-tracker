import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/api';
import {
  foodService,
  type FoodItem,
  type FoodPayload,
  type MicronutrientMap,
} from '../../services/nutritionService';
import type { MicronutrientMeta } from '../../services/profileService';
import { FormField } from '../FormField';

interface FoodsTabProps {
  foods: FoodItem[];
  availableMicronutrients: MicronutrientMeta[];
  onChanged: () => Promise<void>;
}

const DEFAULT_MINERAL_META: MicronutrientMeta[] = [
  { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral' },
  { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral' },
  { key: 'Mg', label: 'Magnezyum (Mg)', unit: 'mg', category: 'mineral' },
  { key: 'Ca', label: 'Kalsiyum (Ca)', unit: 'mg', category: 'mineral' },
  { key: 'Fe', label: 'Demir (Fe)', unit: 'mg', category: 'mineral' },
  { key: 'Zn', label: 'Çinko (Zn)', unit: 'mg', category: 'mineral' },
];

export function FoodsTab({ foods, availableMicronutrients, onChanged }: FoodsTabProps) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'core' | 'custom'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [showMicros, setShowMicros] = useState(false);
  const [microInputs, setMicroInputs] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const microCatalog =
    availableMicronutrients.length > 0 ? availableMicronutrients : DEFAULT_MINERAL_META;

  const filteredFoods = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return foods.filter((food) => {
      if (scope === 'core' && !food.isCore) return false;
      if (scope === 'custom' && food.isCore) return false;
      if (!needle) return true;
      return (
        food.name.toLocaleLowerCase('tr-TR').includes(needle) ||
        (food.brand?.toLocaleLowerCase('tr-TR').includes(needle) ?? false) ||
        (food.category?.toLocaleLowerCase('tr-TR').includes(needle) ?? false)
      );
    });
  }, [foods, search, scope]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setBrand('');
    setCategory('');
    setServingLabel('');
    setServingGrams('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMicroInputs({});
    setFormError(null);
  }

  function startEdit(food: FoodItem) {
    setEditingId(food.id);
    setName(food.name);
    setBrand(food.brand ?? '');
    setCategory(food.category ?? '');
    setServingLabel(food.servingLabel ?? '');
    setServingGrams(food.servingGrams ? String(food.servingGrams) : '');
    setCalories(String(food.caloriesPer100g));
    setProtein(String(food.proteinPer100g));
    setCarbs(String(food.carbsPer100g));
    setFat(String(food.fatPer100g));
    const mapped: Record<string, string> = {};
    for (const [key, val] of Object.entries(food.micronutrientsPer100g)) {
      mapped[key] = String(val);
    }
    setMicroInputs(mapped);
    setShowMicros(Object.keys(mapped).length > 0);
    setFormError(null);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!name.trim()) {
      setFormError('Besin adı giriniz.');
      return;
    }

    const kcal = Number(calories);
    const p = Number(protein);
    const c = Number(carbs);
    const f = Number(fat);
    if (
      !calories.trim() ||
      !protein.trim() ||
      !carbs.trim() ||
      !fat.trim() ||
      [kcal, p, c, f].some((n) => !Number.isFinite(n) || n < 0)
    ) {
      setFormError('100 g kalori ve makro değerleri geçerli sayılar olmalıdır.');
      return;
    }

    const micronutrientsPer100g: MicronutrientMap = {};
    for (const [key, raw] of Object.entries(microInputs)) {
      if (!raw.trim()) continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        setFormError(`${key} mikro besin değeri negatif veya geçersiz.`);
        return;
      }
      if (num > 0) micronutrientsPer100g[key] = num;
    }

    const payload: FoodPayload = {
      name: name.trim(),
      brand: brand.trim() || null,
      category: category.trim() || null,
      servingLabel: servingLabel.trim() || null,
      servingGrams: servingGrams.trim() ? Number(servingGrams) : null,
      caloriesPer100g: kcal,
      proteinPer100g: p,
      carbsPer100g: c,
      fatPer100g: f,
      micronutrientsPer100g,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await foodService.update(editingId, payload);
        setFeedback('Özel besin güncellendi.');
      } else {
        await foodService.create(payload);
        setFeedback('Özel besin eklendi.');
      }
      resetForm();
      await onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Besin kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await foodService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Besin silindi.');
      await onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Besin silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? 'Özel Besini Düzenle' : 'Kendi Besinini Ekle (100 g Bazlı)'}
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
              id="food-name"
              label="Besin Adı"
              type="text"
              placeholder="Örn. Protein Bar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormField
              id="food-brand"
              label="Marka (Opsiyonel)"
              type="text"
              placeholder="Örn. Ev Yapımı"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <FormField
              id="food-category"
              label="Kategori (Opsiyonel)"
              type="text"
              placeholder="Örn. Protein, Atıştırmalık"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <FormField
              id="food-calories"
              label="Kalori / 100g (kcal)"
              type="number"
              step="0.1"
              min="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <FormField
              id="food-protein"
              label="Protein / 100g (g)"
              type="number"
              step="0.1"
              min="0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
            <FormField
              id="food-carbs"
              label="Karb / 100g (g)"
              type="number"
              step="0.1"
              min="0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <FormField
              id="food-fat"
              label="Yağ / 100g (g)"
              type="number"
              step="0.1"
              min="0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="food-serving-label"
              label="Varsayılan Porsiyon Etiketi (Opsiyonel)"
              type="text"
              placeholder="Örn. 1 adet, 1 ölçek"
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
            />
            <FormField
              id="food-serving-grams"
              label="Porsiyon Ağırlığı (g, Opsiyonel)"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Örn. 50"
              value={servingGrams}
              onChange={(e) => setServingGrams(e.target.value)}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMicros((prev) => !prev)}
              className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              {showMicros
                ? '▲ Mikro besin alanlarını gizle'
                : '▼ 100 g mikro besin değerleri ekle (opsiyonel)'}
            </button>
            {showMicros && (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {microCatalog.map((item) => (
                  <label
                    key={item.key}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-300"
                  >
                    <span className="block text-[11px] text-slate-400">
                      {item.label} ({item.unit})
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={microInputs[item.key] ?? ''}
                      onChange={(e) =>
                        setMicroInputs((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-emerald-400"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Besin Ekle'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:text-white"
              >
                İptal
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Besin ara"
              type="text"
              placeholder="Besin, marka veya kategori ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400"
            />
            <div className="flex items-center gap-1" role="group" aria-label="Besin kapsamı">
              {[
                { key: 'all', label: 'Tümü' },
                { key: 'core', label: 'Temel Besinler' },
                { key: 'custom', label: 'Benim Besinlerim' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setScope(item.key as 'all' | 'core' | 'custom')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    scope === item.key
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400">{filteredFoods.length} besin</span>
        </div>

        {filteredFoods.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Aramana uygun besin bulunamadı.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {filteredFoods.map((food) => (
              <li key={food.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{food.name}</span>
                    {food.brand && <span className="text-xs text-slate-400">· {food.brand}</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        food.isCore
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {food.isCore ? 'Temel' : 'Özel'}
                    </span>
                    {food.category && (
                      <span className="text-[11px] text-slate-500">{food.category}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    100 g: <strong className="text-emerald-400">{food.caloriesPer100g} kcal</strong>{' '}
                    · P: {food.proteinPer100g}g · K: {food.carbsPer100g}g · Y: {food.fatPer100g}g
                    {food.servingGrams
                      ? ` · ${food.servingLabel ?? '1 porsiyon'} (${food.servingGrams} g)`
                      : ''}
                  </p>
                </div>

                {!food.isCore && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(food)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === food.id}
                      onClick={() => void handleDelete(food.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
