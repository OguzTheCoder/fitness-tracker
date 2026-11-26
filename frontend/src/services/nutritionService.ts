import { apiRequest } from './api';
import type { MicronutrientMeta } from './profileService';

export type MicronutrientMap = Record<string, number>;

export interface NutrientTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micronutrients: MicronutrientMap;
}

export interface FoodItem {
  id: string;
  isCore: boolean;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  servingLabel: string | null;
  servingGrams: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  micronutrientsPer100g: MicronutrientMap;
  createdAt: string;
  updatedAt: string;
}

export interface FoodPayload {
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  servingLabel?: string | null;
  servingGrams?: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  micronutrientsPer100g?: MicronutrientMap;
}

export type BarcodeLookupSource = 'local' | 'core' | 'open_food_facts' | 'not_found';

export interface BarcodeLookupResponse {
  found: boolean;
  source: BarcodeLookupSource;
  barcode: string;
  food: FoodItem | null;
  externalError?: string;
}

export interface RecipeItemDto extends NutrientTotals {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  servingsCount: number;
  cookedWeightG: number | null;
  rawWeightG: number;
  totalWeightG: number;
  items: RecipeItemDto[];
  totals: NutrientTotals;
  perServing: NutrientTotals;
  createdAt: string;
  updatedAt: string;
}

export interface RecipePayload {
  name: string;
  description?: string | null;
  servingsCount: number;
  cookedWeightG?: number | null;
  items: Array<{ foodId: string; grams: number }>;
}

export interface NutritionLog {
  id: string;
  date: string;
  mealLabel: string | null;
  sourceType: 'food' | 'recipe' | 'recipe_item' | string;
  foodId: string | null;
  recipeId: string | null;
  entryName: string;
  quantityMode: string;
  servings: number | null;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micronutrients: MicronutrientMap;
  createdAt: string;
  updatedAt: string;
}

export interface VisibleMicronutrientSummary extends MicronutrientMeta {
  amount: number;
}

export interface NutritionLogsResponse {
  date: string | null;
  logs: NutritionLog[];
  totals: NutrientTotals;
  goals: {
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
  };
  visibleMicronutrients: VisibleMicronutrientSummary[];
  dailyTotals: Array<{
    date: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    count: number;
  }>;
}

export type CreateNutritionLogPayload =
  | {
      kind: 'food';
      date: string;
      mealLabel?: string | null;
      foodId: string;
      quantityMode: 'grams' | 'servings';
      grams?: number;
      servings?: number;
    }
  | {
      kind: 'recipe';
      date: string;
      mealLabel?: string | null;
      recipeId: string;
      mode: 'servings' | 'grams' | 'decompose';
      servings?: number;
      grams?: number;
    };

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      sp.set(key, String(value));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export const foodService = {
  list: (params?: {
    q?: string;
    scope?: 'all' | 'core' | 'custom';
    category?: string;
    limit?: number;
    offset?: number;
  }) =>
    apiRequest<{ foods: FoodItem[]; total: number }>(
      `/foods${buildQuery({
        q: params?.q,
        scope: params?.scope,
        category: params?.category,
        limit: params?.limit ?? 100,
        offset: params?.offset,
      })}`,
      { method: 'GET' },
    ),

  lookupBarcode: (code: string) =>
    apiRequest<BarcodeLookupResponse>(`/foods/barcode/${encodeURIComponent(code.trim())}`, {
      method: 'GET',
    }),

  create: (payload: FoodPayload) =>
    apiRequest<{ food: FoodItem }>('/foods', { method: 'POST', body: payload }),

  update: (id: string, payload: FoodPayload) =>
    apiRequest<{ food: FoodItem }>(`/foods/${id}`, { method: 'PUT', body: payload }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/foods/${id}`, { method: 'DELETE' }),
};

export const recipeService = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    apiRequest<{ recipes: Recipe[]; total: number }>(
      `/recipes${buildQuery({
        q: params?.q,
        limit: params?.limit ?? 100,
        offset: params?.offset,
      })}`,
      { method: 'GET' },
    ),

  create: (payload: RecipePayload) =>
    apiRequest<{ recipe: Recipe }>('/recipes', { method: 'POST', body: payload }),

  update: (id: string, payload: RecipePayload) =>
    apiRequest<{ recipe: Recipe }>(`/recipes/${id}`, { method: 'PUT', body: payload }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/recipes/${id}`, { method: 'DELETE' }),
};

export const nutritionService = {
  listLogs: (params?: { date?: string; from?: string; to?: string; limit?: number }) =>
    apiRequest<NutritionLogsResponse>(
      `/nutrition/logs${buildQuery({
        date: params?.date,
        from: params?.from,
        to: params?.to,
        limit: params?.limit,
      })}`,
      { method: 'GET' },
    ),

  createLog: (payload: CreateNutritionLogPayload) =>
    apiRequest<{ log?: NutritionLog; logs: NutritionLog[] }>('/nutrition/logs', {
      method: 'POST',
      body: payload,
    }),

  updateLog: (id: string, payload: { date?: string; mealLabel?: string | null; grams?: number }) =>
    apiRequest<{ log: NutritionLog }>(`/nutrition/logs/${id}`, {
      method: 'PATCH',
      body: payload,
    }),

  removeLog: (id: string) =>
    apiRequest<{ message: string }>(`/nutrition/logs/${id}`, { method: 'DELETE' }),
};
