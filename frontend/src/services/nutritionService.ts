import {
  localStore,
  offlineFirstRead,
  offlineFirstWrite,
  removeById,
  upsertById,
} from '../offline/localStore';
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
    offlineFirstRead(
      () =>
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
      (res, data) => {
        for (const f of res.foods) {
          if (f.isCore) data.coreFoods = upsertById(data.coreFoods, f);
          else data.foods = upsertById(data.foods, f);
        }
      },
      (data) => localStore.foods.list(data, params),
    ),

  lookupBarcode: (code: string) =>
    offlineFirstRead(
      () =>
        apiRequest<BarcodeLookupResponse>(`/foods/barcode/${encodeURIComponent(code.trim())}`, {
          method: 'GET',
        }),
      (res, data) => {
        if (res.food) {
          if (res.food.isCore) data.coreFoods = upsertById(data.coreFoods, res.food);
          else data.foods = upsertById(data.foods, res.food);
        }
      },
      (data) => localStore.foods.lookupBarcode(data, code),
    ),

  create: (payload: FoodPayload) =>
    offlineFirstWrite(
      () => apiRequest<{ food: FoodItem }>('/foods', { method: 'POST', body: payload }),
      (res, data) => {
        data.foods = upsertById(data.foods, res.food);
      },
      (userId, data) => localStore.foods.create(userId, data, payload),
    ),

  update: (id: string, payload: FoodPayload) =>
    offlineFirstWrite(
      () => apiRequest<{ food: FoodItem }>(`/foods/${id}`, { method: 'PUT', body: payload }),
      (res, data) => {
        data.foods = upsertById(data.foods, res.food);
      },
      (userId, data) => localStore.foods.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () => apiRequest<{ message: string }>(`/foods/${id}`, { method: 'DELETE' }),
      (_res, data) => {
        data.foods = removeById(data.foods, id);
      },
      (userId, data) => localStore.foods.remove(userId, data, id),
    ),
};

export const recipeService = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    offlineFirstRead(
      () =>
        apiRequest<{ recipes: Recipe[]; total: number }>(
          `/recipes${buildQuery({
            q: params?.q,
            limit: params?.limit ?? 100,
            offset: params?.offset,
          })}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (!params?.q && !params?.offset) {
          data.recipes = res.recipes;
        } else {
          for (const r of res.recipes) data.recipes = upsertById(data.recipes, r);
        }
      },
      (data) => localStore.recipes.list(data, params),
    ),

  create: (payload: RecipePayload) =>
    offlineFirstWrite(
      () => apiRequest<{ recipe: Recipe }>('/recipes', { method: 'POST', body: payload }),
      (res, data) => {
        data.recipes = upsertById(data.recipes, res.recipe);
      },
      (userId, data) => localStore.recipes.create(userId, data, payload),
    ),

  update: (id: string, payload: RecipePayload) =>
    offlineFirstWrite(
      () => apiRequest<{ recipe: Recipe }>(`/recipes/${id}`, { method: 'PUT', body: payload }),
      (res, data) => {
        data.recipes = upsertById(data.recipes, res.recipe);
      },
      (userId, data) => localStore.recipes.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () => apiRequest<{ message: string }>(`/recipes/${id}`, { method: 'DELETE' }),
      (_res, data) => {
        data.recipes = removeById(data.recipes, id);
      },
      (userId, data) => localStore.recipes.remove(userId, data, id),
    ),
};

export const nutritionService = {
  listLogs: (params?: { date?: string; from?: string; to?: string; limit?: number }) =>
    offlineFirstRead(
      () =>
        apiRequest<NutritionLogsResponse>(
          `/nutrition/logs${buildQuery({
            date: params?.date,
            from: params?.from,
            to: params?.to,
            limit: params?.limit,
          })}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (res.date) {
          data.nutritionLogs = [
            ...res.logs,
            ...data.nutritionLogs.filter((l) => l.date !== res.date),
          ];
        } else {
          for (const l of res.logs) data.nutritionLogs = upsertById(data.nutritionLogs, l);
        }
      },
      (data) => localStore.nutrition.listLogs(data, params),
    ),

  createLog: (payload: CreateNutritionLogPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ log?: NutritionLog; logs: NutritionLog[] }>('/nutrition/logs', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        const list = res.logs ?? (res.log ? [res.log] : []);
        for (const l of list) data.nutritionLogs = upsertById(data.nutritionLogs, l);
      },
      (userId, data) => localStore.nutrition.createLog(userId, data, payload),
    ),

  updateLog: (id: string, payload: { date?: string; mealLabel?: string | null; grams?: number }) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ log: NutritionLog }>(`/nutrition/logs/${id}`, {
          method: 'PATCH',
          body: payload,
        }),
      (res, data) => {
        data.nutritionLogs = upsertById(data.nutritionLogs, res.log);
      },
      (userId, data) => localStore.nutrition.updateLog(userId, data, id, payload),
    ),

  removeLog: (id: string) =>
    offlineFirstWrite(
      () => apiRequest<{ message: string }>(`/nutrition/logs/${id}`, { method: 'DELETE' }),
      (_res, data) => {
        data.nutritionLogs = removeById(data.nutritionLogs, id);
      },
      (userId, data) => localStore.nutrition.removeLog(userId, data, id),
    ),
};
