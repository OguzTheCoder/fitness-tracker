import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarDays, Apple } from 'lucide-react';
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

const TABS: { key: ActiveTab; label: string; icon: typeof CalendarDays }[] = [
  { key: 'daily', label: 'Günlük Kayıt', icon: CalendarDays },
  { key: 'foods', label: 'Besinler', icon: Apple },
  { key: 'recipes', label: 'Tarifler', icon: BookOpen },
];

export function NutritionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [pendingAction, setPendingAction] = useState<'add' | 'barcode' | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [availableMicronutrients, setAvailableMicronutrients] = useState<MicronutrientMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add' || action === 'barcode') {
      setActiveTab('daily');
      setPendingAction(action);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleConsumePendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const handleDefineCustomFoodFromBarcode = useCallback((code: string) => {
    setPendingBarcode(code);
    setActiveTab('foods');
  }, []);

  const handleConsumePendingBarcode = useCallback(() => {
    setPendingBarcode(null);
  }, []);

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
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Beslenme & Tarifler
          </h1>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            Günlük kalori, makro ve görünür mikro besinlerini takip et; kendi besinlerini ve
            tariflerini yönet.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Beslenme sekmeleri"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  selected
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-ink-secondary hover:bg-elevated hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {loadError && (
        <div role="alert" className="ft-alert-error">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <section className="ft-card p-6 text-sm text-ink-muted">
          Beslenme verileri yükleniyor...
        </section>
      ) : activeTab === 'daily' ? (
        <DailyNutritionTab
          foods={foods}
          recipes={recipes}
          initialAction={pendingAction}
          onConsumeInitialAction={handleConsumePendingAction}
          onCatalogChanged={loadCatalog}
          onDefineCustomFood={handleDefineCustomFoodFromBarcode}
        />
      ) : activeTab === 'foods' ? (
        <FoodsTab
          foods={foods}
          availableMicronutrients={availableMicronutrients}
          prefillBarcode={pendingBarcode}
          onPrefillConsumed={handleConsumePendingBarcode}
          onChanged={loadCatalog}
        />
      ) : (
        <RecipesTab foods={foods} recipes={recipes} onChanged={loadCatalog} />
      )}
    </div>
  );
}
