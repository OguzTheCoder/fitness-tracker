import { useCallback, useEffect, useState } from 'react';
import { DailyNutritionTab } from '../components/nutrition/DailyNutritionTab';
import { FoodsTab } from '../components/nutrition/FoodsTab';
import { RecipesTab } from '../components/nutrition/RecipesTab';
import { ApiError } from '../services/api';
import {
  foodService,
  recipeService,
  type FoodItem,
  type Recipe,
} from '../services/nutritionService';
import { profileService, type MicronutrientMeta } from '../services/profileService';

type ActiveTab = 'daily' | 'foods' | 'recipes';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'daily', label: 'Günlük Kayıt' },
  { key: 'foods', label: 'Besinler' },
  { key: 'recipes', label: 'Tarifler' },
];

export function NutritionPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [availableMicronutrients, setAvailableMicronutrients] = useState<MicronutrientMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadError(null);
    try {
      const [foodsRes, recipesRes, profileRes] = await Promise.all([
        foodService.list({ limit: 100 }),
        recipeService.list({ limit: 100 }),
        profileService.get().catch(() => null),
      ]);
      setFoods(foodsRes.foods);
      setRecipes(recipesRes.recipes);
      if (profileRes) {
        setAvailableMicronutrients(profileRes.availableMicronutrients);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Beslenme verileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Beslenme & Tarifler</h1>
          <p className="mt-1 text-sm text-slate-400">
            Günlük kalori, makro ve görünür mikro besinlerini takip et; kendi besinlerini ve
            tariflerini yönet.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Beslenme sekmeleri"
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {loadError}
        </div>
      )}

      {isLoading ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
          Beslenme verileri yükleniyor...
        </section>
      ) : activeTab === 'daily' ? (
        <DailyNutritionTab foods={foods} recipes={recipes} />
      ) : activeTab === 'foods' ? (
        <FoodsTab
          foods={foods}
          availableMicronutrients={availableMicronutrients}
          onChanged={loadCatalog}
        />
      ) : (
        <RecipesTab foods={foods} recipes={recipes} onChanged={loadCatalog} />
      )}
    </div>
  );
}
