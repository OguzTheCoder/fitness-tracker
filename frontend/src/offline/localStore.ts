import { ApiError } from '../services/api';
import type {
  CalorieEntry,
  CalorieEntryPayload,
  DailyCalorieTotal,
} from '../services/calorieService';
import type {
  BarcodeLookupResponse,
  CreateNutritionLogPayload,
  FoodItem,
  FoodPayload,
  NutritionLog,
  NutritionLogsResponse,
  Recipe,
  RecipeItemDto,
  RecipePayload,
  VisibleMicronutrientSummary,
} from '../services/nutritionService';
import type {
  ProfileResponse,
  UpdateProfilePayload,
  UserProfile,
} from '../services/profileService';
import type { StatsDays, StatsSummaryResponse, TrendPoint } from '../services/statsService';
import type { WeightEntry, WeightEntryPayload } from '../services/weightService';
import type {
  CardioEntry,
  CardioEntryPayload,
  CardioSummary,
  ExerciseItem,
  ExercisePayload,
  PreviousExercisePerformance,
  PreviousPerformanceResponse,
  StepEntry,
  StepEntryPayload,
  StepSummary,
  WorkoutEntry,
  WorkoutEntryPayload,
  WorkoutSummary,
  WorkoutTemplate,
  WorkoutTemplatePayload,
} from '../services/workoutService';
import { getTodayIsoDate, type DateRange } from '../utils/date';
import {
  enqueueMutation,
  getQueuedMutations,
  getUserLocalData,
  saveUserLocalData,
} from './offlineDb';
import {
  emitOfflineEvent,
  generateOfflineId,
  getActiveOfflineUserId,
  isBrowserOnline,
  isNetworkOfflineError,
} from './offlineHelpers';
import {
  DEFAULT_CARDIO_TYPES,
  DEFAULT_GOALS,
  DEFAULT_MICRONUTRIENT_CATALOG,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
  getRollingRange,
  round1,
  round2,
  scaleNutrientsFrom100g,
  scaleNutrientTotals,
  sumNutrientTotals,
} from './offlineMath';
import type {
  QueuedMutation,
  SyncDeletedItem,
  SyncEntity,
  SyncPullResponse,
  UserLocalData,
} from './offlineTypes';

function stripDeletedAt<T extends { deletedAt?: string | null }>(item: T): Omit<T, 'deletedAt'> {
  const { deletedAt: _ignored, ...rest } = item;
  return rest;
}

function mergeDeltaList<T extends { id: string }>(
  current: T[],
  incoming: SyncDeletedItem<T>[],
  isFullSync: boolean,
  pendingIds: Set<string>,
): T[] {
  const map = new Map<string, T>();
  if (isFullSync) {
    for (const item of current) {
      if (pendingIds.has(item.id)) {
        map.set(item.id, item);
      }
    }
  } else {
    for (const item of current) {
      map.set(item.id, item);
    }
  }

  for (const raw of incoming) {
    if (pendingIds.has(raw.id)) continue;
    if (raw.deletedAt) {
      map.delete(raw.id);
    } else {
      map.set(raw.id, stripDeletedAt(raw) as unknown as T);
    }
  }

  return Array.from(map.values());
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

function inDateRange(date: string, range?: DateRange): boolean {
  if (!range) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function requireActiveUserId(): string {
  const uid = getActiveOfflineUserId();
  if (!uid) {
    throw new ApiError(401, 'Çevrimdışı işlem için aktif kullanıcı bulunamadı.');
  }
  return uid;
}

async function queueOfflineMutation(
  userId: string,
  entity: SyncEntity,
  operation: 'upsert' | 'delete',
  recordId: string,
  clientUpdatedAt: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const mutation: QueuedMutation = {
    clientMutationId: generateOfflineId('mut'),
    userId,
    entity,
    operation,
    recordId,
    clientUpdatedAt,
    ...(data ? { data } : {}),
    createdAt: clientUpdatedAt,
  };
  await enqueueMutation(mutation);
  emitOfflineEvent('queue-changed');
}

export async function applySyncPullToLocal(
  userId: string,
  pull: SyncPullResponse,
): Promise<UserLocalData> {
  const [current, queued] = await Promise.all([
    getUserLocalData(userId),
    getQueuedMutations(userId),
  ]);

  const pendingByEntity = (entity: SyncEntity) =>
    new Set(queued.filter((m) => m.entity === entity).map((m) => m.recordId));

  const next: UserLocalData = {
    ...current,
    lastSyncedAt: pull.serverTime,
    coreFoods: pull.core.foods
      ? pull.core.foods.filter((f) => !f.deletedAt).map((f) => stripDeletedAt(f) as FoodItem)
      : current.coreFoods,
    coreExercises: pull.core.exercises
      ? pull.core.exercises
          .filter((e) => !e.deletedAt)
          .map((e) => stripDeletedAt(e) as ExerciseItem)
      : current.coreExercises,
    weights: mergeDeltaList(
      current.weights,
      pull.changes.weights,
      pull.isFullSync,
      pendingByEntity('weight'),
    ),
    calories: mergeDeltaList(
      current.calories,
      pull.changes.calories,
      pull.isFullSync,
      pendingByEntity('calorie'),
    ),
    foods: mergeDeltaList(
      current.foods,
      pull.changes.foods,
      pull.isFullSync,
      pendingByEntity('food'),
    ),
    recipes: mergeDeltaList(
      current.recipes,
      pull.changes.recipes,
      pull.isFullSync,
      pendingByEntity('recipe'),
    ),
    nutritionLogs: mergeDeltaList(
      current.nutritionLogs,
      pull.changes.nutritionLogs,
      pull.isFullSync,
      pendingByEntity('nutritionLog'),
    ),
    exercises: mergeDeltaList(
      current.exercises,
      pull.changes.exercises,
      pull.isFullSync,
      pendingByEntity('exercise'),
    ),
    workoutTemplates: mergeDeltaList(
      current.workoutTemplates,
      pull.changes.workoutTemplates,
      pull.isFullSync,
      pendingByEntity('workoutTemplate'),
    ),
    workouts: mergeDeltaList(
      current.workouts,
      pull.changes.workouts,
      pull.isFullSync,
      pendingByEntity('workout'),
    ),
    cardio: mergeDeltaList(
      current.cardio,
      pull.changes.cardio,
      pull.isFullSync,
      pendingByEntity('cardio'),
    ),
    steps: mergeDeltaList(
      current.steps,
      pull.changes.steps,
      pull.isFullSync,
      pendingByEntity('step'),
    ),
  };

  if (pull.profile && pendingByEntity('profile').size === 0) {
    next.profile = {
      id: current.profile?.id ?? 'profile',
      userId,
      name: pull.profile.name,
      email: current.profile?.email ?? '',
      dailyCalorieGoal: pull.profile.dailyCalorieGoal,
      proteinGoalG: pull.profile.proteinGoalG,
      carbsGoalG: pull.profile.carbsGoalG,
      fatGoalG: pull.profile.fatGoalG,
      dailyStepGoal: pull.profile.dailyStepGoal,
      visibleMicronutrients: pull.profile.visibleMicronutrients,
      updatedAt: pull.profile.updatedAt,
    };
  }

  await saveUserLocalData(next);
  return next;
}

export async function updateLocalStore(
  mutator: (data: UserLocalData) => void,
): Promise<void> {
  const userId = getActiveOfflineUserId();
  if (!userId) return;
  const data = await getUserLocalData(userId);
  mutator(data);
  await saveUserLocalData(data);
}

/**
 * Online-first read with automatic IndexedDB fallback when offline or network fails.
 */
export async function offlineFirstRead<T>(
  onlineCall: () => Promise<T>,
  mirrorSuccess: (result: T, data: UserLocalData) => void,
  offlineFallback: (data: UserLocalData) => T,
): Promise<T> {
  const userId = getActiveOfflineUserId();
  if (!isBrowserOnline() && userId) {
    const local = await getUserLocalData(userId);
    return offlineFallback(local);
  }

  try {
    const result = await onlineCall();
    if (userId) {
      const local = await getUserLocalData(userId);
      mirrorSuccess(result, local);
      await saveUserLocalData(local);
    }
    return result;
  } catch (err) {
    if (userId && isNetworkOfflineError(err)) {
      const local = await getUserLocalData(userId);
      return offlineFallback(local);
    }
    throw err;
  }
}

/**
 * Online-first write with optimistic IndexedDB update + sync queue fallback when offline.
 */
export async function offlineFirstWrite<T>(
  onlineCall: () => Promise<T>,
  mirrorSuccess: (result: T, data: UserLocalData) => void,
  offlineFallback: (userId: string, data: UserLocalData) => Promise<T>,
): Promise<T> {
  const userId = getActiveOfflineUserId();
  if (!isBrowserOnline() && userId) {
    const local = await getUserLocalData(userId);
    const result = await offlineFallback(userId, local);
    await saveUserLocalData(local);
    return result;
  }

  try {
    const result = await onlineCall();
    if (userId) {
      const local = await getUserLocalData(userId);
      mirrorSuccess(result, local);
      await saveUserLocalData(local);
    }
    return result;
  } catch (err) {
    if (userId && isNetworkOfflineError(err)) {
      const local = await getUserLocalData(userId);
      const result = await offlineFallback(userId, local);
      await saveUserLocalData(local);
      return result;
    }
    throw err;
  }
}

function getAllLocalFoods(data: UserLocalData): FoodItem[] {
  return [...data.foods, ...data.coreFoods];
}

function getAllLocalExercises(data: UserLocalData): ExerciseItem[] {
  return [...data.exercises, ...data.coreExercises];
}

function buildLocalRecipeDto(
  id: string,
  payload: RecipePayload,
  allFoods: FoodItem[],
  nowIso: string,
  createdAt?: string,
): Recipe {
  const foodMap = new Map(allFoods.map((f) => [f.id, f]));
  let rawWeightG = 0;
  const items: RecipeItemDto[] = payload.items.map((item, idx) => {
    const food = foodMap.get(item.foodId);
    if (!food) {
      throw new ApiError(400, 'Tarifteki malzemelerden biri yerel depoda bulunamadı.');
    }
    const grams = round1(item.grams);
    rawWeightG += grams;
    const scaled = scaleNutrientsFrom100g(food, grams);
    return {
      id: generateOfflineId('ri'),
      foodId: food.id,
      foodName: food.name,
      grams,
      sortOrder: idx,
      ...scaled,
    };
  });

  const totals = sumNutrientTotals(items);
  const servingsCount = payload.servingsCount > 0 ? payload.servingsCount : 1;
  const perServing = scaleNutrientTotals(totals, 1 / servingsCount);
  const roundedRaw = round1(rawWeightG);
  const cookedWeightG = payload.cookedWeightG ? round1(payload.cookedWeightG) : null;
  const totalWeightG = cookedWeightG ?? roundedRaw;

  return {
    id,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    servingsCount,
    cookedWeightG,
    rawWeightG: roundedRaw,
    totalWeightG,
    items,
    totals,
    perServing,
    createdAt: createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

// ============================================================================
// Entity Local Handlers
// ============================================================================

export const localStore = {
  // --- Weights ---
  weights: {
    list(data: UserLocalData, range?: DateRange): { entries: WeightEntry[] } {
      const entries = data.weights
        .filter((e) => inDateRange(e.date, range))
        .sort((a, b) => b.date.localeCompare(a.date));
      return { entries };
    },
    async upsert(
      userId: string,
      data: UserLocalData,
      payload: WeightEntryPayload,
    ): Promise<{ entry: WeightEntry; updated: boolean }> {
      const now = new Date().toISOString();
      const existing = data.weights.find((w) => w.date === payload.date);
      const entry: WeightEntry = {
        id: existing?.id ?? generateOfflineId('wgt'),
        userId,
        date: payload.date,
        weightKg: payload.weightKg,
        note: payload.note?.trim() || null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      data.weights = upsertById(data.weights, entry);
      await queueOfflineMutation(userId, 'weight', 'upsert', entry.id, now, {
        date: entry.date,
        weightKg: entry.weightKg,
        note: entry.note,
      });
      return { entry, updated: Boolean(existing) };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: WeightEntryPayload,
    ): Promise<{ entry: WeightEntry }> {
      const existing = data.weights.find((w) => w.id === id);
      if (!existing) throw new ApiError(404, 'Kilo kaydı bulunamadı.');
      const now = new Date().toISOString();
      const entry: WeightEntry = {
        ...existing,
        date: payload.date,
        weightKg: payload.weightKg,
        note: payload.note?.trim() || null,
        updatedAt: now,
      };
      data.weights = upsertById(data.weights, entry);
      await queueOfflineMutation(userId, 'weight', 'upsert', entry.id, now, {
        date: entry.date,
        weightKg: entry.weightKg,
        note: entry.note,
      });
      return { entry };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.weights = removeById(data.weights, id);
      await queueOfflineMutation(userId, 'weight', 'delete', id, now);
      return { message: 'Kilo kaydı silindi.' };
    },
  },

  // --- Calories ---
  calories: {
    list(
      data: UserLocalData,
      range?: DateRange,
    ): { entries: CalorieEntry[]; dailyTotals: DailyCalorieTotal[] } {
      const entries = data.calories
        .filter((e) => inDateRange(e.date, range))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

      const map = new Map<string, DailyCalorieTotal>();
      for (const e of entries) {
        const cur = map.get(e.date);
        if (cur) {
          cur.totalCalories += e.calories;
          cur.count += 1;
        } else {
          map.set(e.date, { date: e.date, totalCalories: e.calories, count: 1 });
        }
      }
      return { entries, dailyTotals: Array.from(map.values()) };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: CalorieEntryPayload,
    ): Promise<{ entry: CalorieEntry }> {
      const now = new Date().toISOString();
      const entry: CalorieEntry = {
        id: generateOfflineId('cal'),
        userId,
        date: payload.date,
        mealName: payload.mealName.trim(),
        calories: payload.calories,
        createdAt: now,
        updatedAt: now,
      };
      data.calories = upsertById(data.calories, entry);
      await queueOfflineMutation(userId, 'calorie', 'upsert', entry.id, now, {
        date: entry.date,
        mealName: entry.mealName,
        calories: entry.calories,
      });
      return { entry };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: CalorieEntryPayload,
    ): Promise<{ entry: CalorieEntry }> {
      const existing = data.calories.find((c) => c.id === id);
      if (!existing) throw new ApiError(404, 'Kalori kaydı bulunamadı.');
      const now = new Date().toISOString();
      const entry: CalorieEntry = {
        ...existing,
        date: payload.date,
        mealName: payload.mealName.trim(),
        calories: payload.calories,
        updatedAt: now,
      };
      data.calories = upsertById(data.calories, entry);
      await queueOfflineMutation(userId, 'calorie', 'upsert', entry.id, now, {
        date: entry.date,
        mealName: entry.mealName,
        calories: entry.calories,
      });
      return { entry };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.calories = removeById(data.calories, id);
      await queueOfflineMutation(userId, 'calorie', 'delete', id, now);
      return { message: 'Kalori kaydı silindi.' };
    },
  },

  // --- Foods ---
  foods: {
    list(
      data: UserLocalData,
      params?: { q?: string; scope?: 'all' | 'core' | 'custom'; category?: string },
    ): { foods: FoodItem[]; total: number } {
      let pool: FoodItem[];
      if (params?.scope === 'core') pool = [...data.coreFoods];
      else if (params?.scope === 'custom') pool = [...data.foods];
      else pool = [...data.foods, ...data.coreFoods];

      if (params?.category) {
        pool = pool.filter((f) => f.category === params.category);
      }
      if (params?.q) {
        const needle = params.q.toLocaleLowerCase('tr-TR');
        pool = pool.filter((f) =>
          `${f.name} ${f.brand ?? ''} ${f.category ?? ''} ${f.barcode ?? ''}`
            .toLocaleLowerCase('tr-TR')
            .includes(needle),
        );
      }
      pool.sort((a, b) => Number(a.isCore) - Number(b.isCore) || a.name.localeCompare(b.name, 'tr'));
      return { foods: pool, total: pool.length };
    },
    lookupBarcode(data: UserLocalData, code: string): BarcodeLookupResponse {
      const cleaned = code.trim();
      const custom = data.foods.find((f) => f.barcode === cleaned);
      if (custom) return { found: true, source: 'local', barcode: cleaned, food: custom };
      const core = data.coreFoods.find((f) => f.barcode === cleaned);
      if (core) return { found: true, source: 'core', barcode: cleaned, food: core };
      return {
        found: false,
        source: 'not_found',
        barcode: cleaned,
        food: null,
        externalError:
          'Çevrimdışı modda dış ürün veritabanına ulaşılamaz. Bu kodu kendi besinin olarak tanımlayabilirsin.',
      };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: FoodPayload,
    ): Promise<{ food: FoodItem }> {
      const now = new Date().toISOString();
      const food: FoodItem = {
        id: generateOfflineId('food'),
        isCore: false,
        barcode: payload.barcode?.trim() || null,
        name: payload.name.trim(),
        brand: payload.brand?.trim() || null,
        category: payload.category?.trim() || null,
        servingLabel: payload.servingLabel?.trim() || (payload.servingGrams ? '1 porsiyon' : null),
        servingGrams: payload.servingGrams ?? null,
        caloriesPer100g: round1(payload.caloriesPer100g),
        proteinPer100g: round1(payload.proteinPer100g),
        carbsPer100g: round1(payload.carbsPer100g),
        fatPer100g: round1(payload.fatPer100g),
        micronutrientsPer100g: payload.micronutrientsPer100g ?? {},
        createdAt: now,
        updatedAt: now,
      };
      data.foods = upsertById(data.foods, food);
      await queueOfflineMutation(userId, 'food', 'upsert', food.id, now, {
        barcode: food.barcode,
        name: food.name,
        brand: food.brand,
        category: food.category,
        servingLabel: food.servingLabel,
        servingGrams: food.servingGrams,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        micronutrientsPer100g: food.micronutrientsPer100g,
      });
      return { food };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: FoodPayload,
    ): Promise<{ food: FoodItem }> {
      const existing = data.foods.find((f) => f.id === id);
      if (!existing) throw new ApiError(404, 'Besin bulunamadı.');
      const now = new Date().toISOString();
      const food: FoodItem = {
        ...existing,
        barcode: payload.barcode?.trim() || null,
        name: payload.name.trim(),
        brand: payload.brand?.trim() || null,
        category: payload.category?.trim() || null,
        servingLabel: payload.servingLabel?.trim() || (payload.servingGrams ? '1 porsiyon' : null),
        servingGrams: payload.servingGrams ?? null,
        caloriesPer100g: round1(payload.caloriesPer100g),
        proteinPer100g: round1(payload.proteinPer100g),
        carbsPer100g: round1(payload.carbsPer100g),
        fatPer100g: round1(payload.fatPer100g),
        micronutrientsPer100g: payload.micronutrientsPer100g ?? {},
        updatedAt: now,
      };
      data.foods = upsertById(data.foods, food);
      await queueOfflineMutation(userId, 'food', 'upsert', food.id, now, {
        barcode: food.barcode,
        name: food.name,
        brand: food.brand,
        category: food.category,
        servingLabel: food.servingLabel,
        servingGrams: food.servingGrams,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        micronutrientsPer100g: food.micronutrientsPer100g,
      });
      return { food };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const usedInRecipe = data.recipes.some((r) => r.items.some((i) => i.foodId === id));
      if (usedInRecipe) {
        throw new ApiError(409, 'Bu besin bir tarifte kullanıldığı için silinemez.');
      }
      const now = new Date().toISOString();
      data.foods = removeById(data.foods, id);
      await queueOfflineMutation(userId, 'food', 'delete', id, now);
      return { message: 'Besin silindi.' };
    },
  },

  // --- Recipes ---
  recipes: {
    list(data: UserLocalData, params?: { q?: string }): { recipes: Recipe[]; total: number } {
      let list = [...data.recipes];
      if (params?.q) {
        const needle = params.q.toLocaleLowerCase('tr-TR');
        list = list.filter((r) =>
          `${r.name} ${r.description ?? ''}`.toLocaleLowerCase('tr-TR').includes(needle),
        );
      }
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { recipes: list, total: list.length };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: RecipePayload,
    ): Promise<{ recipe: Recipe }> {
      const now = new Date().toISOString();
      const recipe = buildLocalRecipeDto(
        generateOfflineId('rcp'),
        payload,
        getAllLocalFoods(data),
        now,
      );
      data.recipes = upsertById(data.recipes, recipe);
      await queueOfflineMutation(userId, 'recipe', 'upsert', recipe.id, now, {
        name: recipe.name,
        description: recipe.description,
        servingsCount: recipe.servingsCount,
        cookedWeightG: recipe.cookedWeightG,
        items: recipe.items.map((i, idx) => ({
          foodId: i.foodId,
          grams: i.grams,
          sortOrder: idx,
        })),
      });
      return { recipe };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: RecipePayload,
    ): Promise<{ recipe: Recipe }> {
      const existing = data.recipes.find((r) => r.id === id);
      if (!existing) throw new ApiError(404, 'Tarif bulunamadı.');
      const now = new Date().toISOString();
      const recipe = buildLocalRecipeDto(
        id,
        payload,
        getAllLocalFoods(data),
        now,
        existing.createdAt,
      );
      data.recipes = upsertById(data.recipes, recipe);
      await queueOfflineMutation(userId, 'recipe', 'upsert', recipe.id, now, {
        name: recipe.name,
        description: recipe.description,
        servingsCount: recipe.servingsCount,
        cookedWeightG: recipe.cookedWeightG,
        items: recipe.items.map((i, idx) => ({
          foodId: i.foodId,
          grams: i.grams,
          sortOrder: idx,
        })),
      });
      return { recipe };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.recipes = removeById(data.recipes, id);
      await queueOfflineMutation(userId, 'recipe', 'delete', id, now);
      return { message: 'Tarif silindi.' };
    },
  },

  // --- Nutrition Logs ---
  nutrition: {
    listLogs(
      data: UserLocalData,
      params?: { date?: string; from?: string; to?: string },
    ): NutritionLogsResponse {
      const activeDate = !params?.date && !params?.from && !params?.to ? getTodayIsoDate() : params?.date;
      const logs = data.nutritionLogs
        .filter((l) => {
          if (activeDate) return l.date === activeDate;
          return inDateRange(l.date, { from: params?.from, to: params?.to });
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

      const totals = sumNutrientTotals(logs);
      const visibleKeys = data.profile?.visibleMicronutrients ?? DEFAULT_VISIBLE_MICRONUTRIENTS;
      const metaMap = new Map(
        (data.availableMicronutrients.length > 0
          ? data.availableMicronutrients
          : DEFAULT_MICRONUTRIENT_CATALOG
        ).map((m) => [m.key, m]),
      );
      const visibleMicronutrients: VisibleMicronutrientSummary[] = visibleKeys
        .map((k) => {
          const meta = metaMap.get(k);
          if (!meta) return null;
          return { ...meta, amount: round2(totals.micronutrients[k] ?? 0) };
        })
        .filter((x): x is VisibleMicronutrientSummary => x !== null);

      const dailyMap = new Map<
        string,
        { date: string; calories: number; proteinG: number; carbsG: number; fatG: number; count: number }
      >();
      for (const l of logs) {
        const cur = dailyMap.get(l.date);
        if (cur) {
          cur.calories = round1(cur.calories + l.calories);
          cur.proteinG = round1(cur.proteinG + l.proteinG);
          cur.carbsG = round1(cur.carbsG + l.carbsG);
          cur.fatG = round1(cur.fatG + l.fatG);
          cur.count += 1;
        } else {
          dailyMap.set(l.date, {
            date: l.date,
            calories: l.calories,
            proteinG: l.proteinG,
            carbsG: l.carbsG,
            fatG: l.fatG,
            count: 1,
          });
        }
      }

      return {
        date: activeDate ?? null,
        logs,
        totals,
        goals: {
          dailyCalorieGoal: data.profile?.dailyCalorieGoal ?? DEFAULT_GOALS.dailyCalorieGoal,
          proteinGoalG: data.profile?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
          carbsGoalG: data.profile?.carbsGoalG ?? DEFAULT_GOALS.carbsGoalG,
          fatGoalG: data.profile?.fatGoalG ?? DEFAULT_GOALS.fatGoalG,
        },
        visibleMicronutrients,
        dailyTotals: Array.from(dailyMap.values()),
      };
    },
    async createLog(
      userId: string,
      data: UserLocalData,
      payload: CreateNutritionLogPayload,
    ): Promise<{ log?: NutritionLog; logs: NutritionLog[] }> {
      const now = new Date().toISOString();

      if (payload.kind === 'food') {
        const food = getAllLocalFoods(data).find((f) => f.id === payload.foodId);
        if (!food) throw new ApiError(404, 'Besin yerel depoda bulunamadı.');
        const baseServing = food.servingGrams ?? 100;
        const grams =
          payload.quantityMode === 'servings'
            ? round1((payload.servings ?? 1) * baseServing)
            : round1(payload.grams ?? 100);
        const servings = payload.quantityMode === 'servings' ? round2(payload.servings ?? 1) : null;
        const computed = scaleNutrientsFrom100g(food, grams);

        const log: NutritionLog = {
          id: generateOfflineId('nlog'),
          date: payload.date,
          mealLabel: payload.mealLabel?.trim() || null,
          sourceType: 'food',
          foodId: food.id,
          recipeId: null,
          entryName: food.name,
          quantityMode: payload.quantityMode,
          servings,
          grams,
          ...computed,
          createdAt: now,
          updatedAt: now,
        };
        data.nutritionLogs = upsertById(data.nutritionLogs, log);
        await queueOfflineMutation(userId, 'nutritionLog', 'upsert', log.id, now, {
          date: log.date,
          mealLabel: log.mealLabel,
          sourceType: log.sourceType,
          foodId: log.foodId,
          recipeId: log.recipeId,
          entryName: log.entryName,
          quantityMode: log.quantityMode,
          servings: log.servings,
          grams: log.grams,
          calories: log.calories,
          proteinG: log.proteinG,
          carbsG: log.carbsG,
          fatG: log.fatG,
          micronutrients: log.micronutrients,
        });
        return { log, logs: [log] };
      }

      const recipe = data.recipes.find((r) => r.id === payload.recipeId);
      if (!recipe || recipe.items.length === 0) {
        throw new ApiError(404, 'Tarif yerel depoda bulunamadı.');
      }
      const totalWeightG = recipe.totalWeightG > 0 ? recipe.totalWeightG : 100;

      if (payload.mode === 'decompose') {
        const factor =
          payload.grams !== undefined
            ? payload.grams / totalWeightG
            : (payload.servings ?? 1) / recipe.servingsCount;
        const createdLogs: NutritionLog[] = [];
        for (const item of recipe.items) {
          const scaledGrams = round1(item.grams * factor);
          const computed = scaleNutrientTotals(item, factor);
          const log: NutritionLog = {
            id: generateOfflineId('nlog'),
            date: payload.date,
            mealLabel: payload.mealLabel?.trim() || null,
            sourceType: 'recipe_item',
            foodId: item.foodId,
            recipeId: recipe.id,
            entryName: `${item.foodName} (${recipe.name})`,
            quantityMode: 'grams',
            servings: null,
            grams: scaledGrams,
            ...computed,
            createdAt: now,
            updatedAt: now,
          };
          data.nutritionLogs = upsertById(data.nutritionLogs, log);
          await queueOfflineMutation(userId, 'nutritionLog', 'upsert', log.id, now, {
            date: log.date,
            mealLabel: log.mealLabel,
            sourceType: log.sourceType,
            foodId: log.foodId,
            recipeId: log.recipeId,
            entryName: log.entryName,
            quantityMode: log.quantityMode,
            servings: log.servings,
            grams: log.grams,
            calories: log.calories,
            proteinG: log.proteinG,
            carbsG: log.carbsG,
            fatG: log.fatG,
            micronutrients: log.micronutrients,
          });
          createdLogs.push(log);
        }
        return { logs: createdLogs };
      }

      const factor =
        payload.mode === 'servings'
          ? (payload.servings ?? 1) / recipe.servingsCount
          : (payload.grams ?? totalWeightG) / totalWeightG;
      const grams =
        payload.mode === 'grams' ? round1(payload.grams ?? totalWeightG) : round1(totalWeightG * factor);
      const servings =
        payload.mode === 'servings'
          ? round2(payload.servings ?? 1)
          : round2(recipe.servingsCount * factor);
      const computed = scaleNutrientTotals(recipe.totals, factor);

      const log: NutritionLog = {
        id: generateOfflineId('nlog'),
        date: payload.date,
        mealLabel: payload.mealLabel?.trim() || null,
        sourceType: 'recipe',
        foodId: null,
        recipeId: recipe.id,
        entryName: recipe.name,
        quantityMode: payload.mode,
        servings,
        grams,
        ...computed,
        createdAt: now,
        updatedAt: now,
      };
      data.nutritionLogs = upsertById(data.nutritionLogs, log);
      await queueOfflineMutation(userId, 'nutritionLog', 'upsert', log.id, now, {
        date: log.date,
        mealLabel: log.mealLabel,
        sourceType: log.sourceType,
        foodId: log.foodId,
        recipeId: log.recipeId,
        entryName: log.entryName,
        quantityMode: log.quantityMode,
        servings: log.servings,
        grams: log.grams,
        calories: log.calories,
        proteinG: log.proteinG,
        carbsG: log.carbsG,
        fatG: log.fatG,
        micronutrients: log.micronutrients,
      });
      return { log, logs: [log] };
    },
    async updateLog(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: { date?: string; mealLabel?: string | null; grams?: number },
    ): Promise<{ log: NutritionLog }> {
      const existing = data.nutritionLogs.find((l) => l.id === id);
      if (!existing) throw new ApiError(404, 'Beslenme kaydı bulunamadı.');
      const now = new Date().toISOString();

      let nextLog: NutritionLog = {
        ...existing,
        date: payload.date ?? existing.date,
        mealLabel: payload.mealLabel !== undefined ? payload.mealLabel : existing.mealLabel,
        updatedAt: now,
      };

      if (payload.grams !== undefined && existing.grams > 0) {
        const ratio = payload.grams / existing.grams;
        const rescaled = scaleNutrientTotals(existing, ratio);
        nextLog = {
          ...nextLog,
          grams: round1(payload.grams),
          servings: existing.servings !== null ? round2(existing.servings * ratio) : null,
          ...rescaled,
        };
      }

      data.nutritionLogs = upsertById(data.nutritionLogs, nextLog);
      await queueOfflineMutation(userId, 'nutritionLog', 'upsert', nextLog.id, now, {
        date: nextLog.date,
        mealLabel: nextLog.mealLabel,
        sourceType: nextLog.sourceType,
        foodId: nextLog.foodId,
        recipeId: nextLog.recipeId,
        entryName: nextLog.entryName,
        quantityMode: nextLog.quantityMode,
        servings: nextLog.servings,
        grams: nextLog.grams,
        calories: nextLog.calories,
        proteinG: nextLog.proteinG,
        carbsG: nextLog.carbsG,
        fatG: nextLog.fatG,
        micronutrients: nextLog.micronutrients,
      });
      return { log: nextLog };
    },
    async removeLog(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.nutritionLogs = removeById(data.nutritionLogs, id);
      await queueOfflineMutation(userId, 'nutritionLog', 'delete', id, now);
      return { message: 'Beslenme kaydı silindi.' };
    },
  },

  // --- Exercises ---
  exercises: {
    list(
      data: UserLocalData,
      params?: { q?: string; muscleGroup?: string; scope?: 'all' | 'core' | 'custom' },
    ): { exercises: ExerciseItem[]; total: number; muscleGroups: string[] } {
      let pool: ExerciseItem[];
      if (params?.scope === 'core') pool = [...data.coreExercises];
      else if (params?.scope === 'custom') pool = [...data.exercises];
      else pool = [...data.exercises, ...data.coreExercises];

      if (params?.muscleGroup) {
        pool = pool.filter((e) => e.muscleGroup === params.muscleGroup);
      }
      if (params?.q) {
        const needle = params.q.toLocaleLowerCase('tr-TR');
        pool = pool.filter((e) =>
          `${e.name} ${e.muscleGroup} ${e.equipment ?? ''}`.toLocaleLowerCase('tr-TR').includes(needle),
        );
      }
      pool.sort(
        (a, b) =>
          Number(a.isCore) - Number(b.isCore) ||
          a.muscleGroup.localeCompare(b.muscleGroup, 'tr') ||
          a.name.localeCompare(b.name, 'tr'),
      );
      return { exercises: pool, total: pool.length, muscleGroups: [...DEFAULT_MUSCLE_GROUPS] };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: ExercisePayload,
    ): Promise<{ exercise: ExerciseItem }> {
      const now = new Date().toISOString();
      const exercise: ExerciseItem = {
        id: generateOfflineId('ex'),
        userId,
        isCore: false,
        coreKey: null,
        name: payload.name.trim(),
        muscleGroup: payload.muscleGroup,
        equipment: payload.equipment?.trim() || null,
        isBodyweight: Boolean(payload.isBodyweight),
        notes: payload.notes?.trim() || null,
        createdAt: now,
        updatedAt: now,
      };
      data.exercises = upsertById(data.exercises, exercise);
      await queueOfflineMutation(userId, 'exercise', 'upsert', exercise.id, now, {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        isBodyweight: exercise.isBodyweight,
        notes: exercise.notes,
      });
      return { exercise };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: ExercisePayload,
    ): Promise<{ exercise: ExerciseItem }> {
      const existing = data.exercises.find((e) => e.id === id);
      if (!existing) throw new ApiError(404, 'Özel egzersiz bulunamadı.');
      const now = new Date().toISOString();
      const exercise: ExerciseItem = {
        ...existing,
        name: payload.name.trim(),
        muscleGroup: payload.muscleGroup,
        equipment: payload.equipment?.trim() || null,
        isBodyweight: Boolean(payload.isBodyweight),
        notes: payload.notes?.trim() || null,
        updatedAt: now,
      };
      data.exercises = upsertById(data.exercises, exercise);
      await queueOfflineMutation(userId, 'exercise', 'upsert', exercise.id, now, {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        isBodyweight: exercise.isBodyweight,
        notes: exercise.notes,
      });
      return { exercise };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.exercises = removeById(data.exercises, id);
      await queueOfflineMutation(userId, 'exercise', 'delete', id, now);
      return { message: 'Özel egzersiz silindi.' };
    },
  },

  // --- Workout Templates ---
  workoutTemplates: {
    list(data: UserLocalData, params?: { q?: string }): { templates: WorkoutTemplate[]; total: number } {
      let list = [...data.workoutTemplates];
      if (params?.q) {
        const needle = params.q.toLocaleLowerCase('tr-TR');
        list = list.filter((t) => {
          const names = t.exercises.map((e) => e.exerciseName).join(' ');
          return `${t.name} ${t.description ?? ''} ${names}`.toLocaleLowerCase('tr-TR').includes(needle);
        });
      }
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { templates: list, total: list.length };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: WorkoutTemplatePayload,
    ): Promise<{ template: WorkoutTemplate }> {
      const now = new Date().toISOString();
      const id = generateOfflineId('tpl');
      const allEx = new Map(getAllLocalExercises(data).map((e) => [e.id, e]));
      const exercises = payload.exercises.map((ex, idx) => {
        const catalog = ex.exerciseId ? allEx.get(ex.exerciseId) : undefined;
        return {
          id: generateOfflineId('tplex'),
          templateId: id,
          exerciseId: catalog?.id ?? ex.exerciseId ?? null,
          exerciseName: (ex.exerciseName?.trim() || catalog?.name || 'Hareket').trim(),
          muscleGroup: ex.muscleGroup?.trim() || catalog?.muscleGroup || null,
          defaultSets: ex.defaultSets,
          defaultReps: ex.defaultReps,
          defaultWeightKg: ex.defaultWeightKg ?? null,
          sortOrder: idx,
        };
      });
      const template: WorkoutTemplate = {
        id,
        userId,
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        createdAt: now,
        updatedAt: now,
        exercises,
      };
      data.workoutTemplates = upsertById(data.workoutTemplates, template);
      await queueOfflineMutation(userId, 'workoutTemplate', 'upsert', template.id, now, {
        name: template.name,
        description: template.description,
        exercises: template.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          muscleGroup: e.muscleGroup,
          defaultSets: e.defaultSets,
          defaultReps: e.defaultReps,
          defaultWeightKg: e.defaultWeightKg,
          sortOrder: e.sortOrder,
        })),
      });
      return { template };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: WorkoutTemplatePayload,
    ): Promise<{ template: WorkoutTemplate }> {
      const existing = data.workoutTemplates.find((t) => t.id === id);
      if (!existing) throw new ApiError(404, 'Antrenman şablonu bulunamadı.');
      const now = new Date().toISOString();
      const allEx = new Map(getAllLocalExercises(data).map((e) => [e.id, e]));
      const exercises = payload.exercises.map((ex, idx) => {
        const catalog = ex.exerciseId ? allEx.get(ex.exerciseId) : undefined;
        return {
          id: generateOfflineId('tplex'),
          templateId: id,
          exerciseId: catalog?.id ?? ex.exerciseId ?? null,
          exerciseName: (ex.exerciseName?.trim() || catalog?.name || 'Hareket').trim(),
          muscleGroup: ex.muscleGroup?.trim() || catalog?.muscleGroup || null,
          defaultSets: ex.defaultSets,
          defaultReps: ex.defaultReps,
          defaultWeightKg: ex.defaultWeightKg ?? null,
          sortOrder: idx,
        };
      });
      const template: WorkoutTemplate = {
        ...existing,
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        updatedAt: now,
        exercises,
      };
      data.workoutTemplates = upsertById(data.workoutTemplates, template);
      await queueOfflineMutation(userId, 'workoutTemplate', 'upsert', template.id, now, {
        name: template.name,
        description: template.description,
        exercises: template.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          muscleGroup: e.muscleGroup,
          defaultSets: e.defaultSets,
          defaultReps: e.defaultReps,
          defaultWeightKg: e.defaultWeightKg,
          sortOrder: e.sortOrder,
        })),
      });
      return { template };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.workoutTemplates = removeById(data.workoutTemplates, id);
      await queueOfflineMutation(userId, 'workoutTemplate', 'delete', id, now);
      return { message: 'Antrenman şablonu silindi.' };
    },
  },

  // --- Workouts ---
  workouts: {
    list(
      data: UserLocalData,
      range?: DateRange,
    ): { entries: WorkoutEntry[]; summary: WorkoutSummary } {
      const entries = data.workouts
        .filter((w) => inDateRange(w.date, range))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      return {
        entries,
        summary: {
          totalCount: entries.length,
          totalDurationMinutes: entries.reduce((sum, w) => sum + w.durationMinutes, 0),
        },
      };
    },
    getPrevious(
      data: UserLocalData,
      params: {
        exerciseIds?: string[];
        exerciseNames?: string[];
        beforeDate?: string;
        excludeWorkoutId?: string;
      },
    ): PreviousPerformanceResponse {
      const byExerciseId: Record<string, PreviousExercisePerformance> = {};
      const byExerciseName: Record<string, PreviousExercisePerformance> = {};
      const idSet = new Set(params.exerciseIds ?? []);
      const nameSet = new Set(
        (params.exerciseNames ?? []).map((n) => n.toLocaleLowerCase('tr-TR')),
      );

      const sorted = [...data.workouts]
        .filter((w) => {
          if (params.beforeDate && w.date >= params.beforeDate) return false;
          if (params.excludeWorkoutId && w.id === params.excludeWorkoutId) return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

      for (const w of sorted) {
        for (const ex of w.exercises ?? []) {
          const perf: PreviousExercisePerformance = {
            workoutId: w.id,
            date: w.date,
            workoutName: w.name,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weightKg: s.weightKg,
            })),
          };
          if (ex.exerciseId && idSet.has(ex.exerciseId) && !byExerciseId[ex.exerciseId]) {
            byExerciseId[ex.exerciseId] = perf;
          }
          const norm = ex.exerciseName.toLocaleLowerCase('tr-TR');
          if (nameSet.has(norm) && !byExerciseName[norm]) {
            byExerciseName[norm] = perf;
          }
        }
      }
      return { byExerciseId, byExerciseName };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: WorkoutEntryPayload,
    ): Promise<{ entry: WorkoutEntry }> {
      const now = new Date().toISOString();
      const allEx = new Map(getAllLocalExercises(data).map((e) => [e.id, e]));
      const exercises = (payload.exercises ?? []).map((ex, exIdx) => {
        const catalog = ex.exerciseId ? allEx.get(ex.exerciseId) : undefined;
        return {
          id: generateOfflineId('wex'),
          exerciseId: catalog?.id ?? ex.exerciseId ?? null,
          exerciseName: (ex.exerciseName?.trim() || catalog?.name || 'Hareket').trim(),
          muscleGroup: ex.muscleGroup?.trim() || catalog?.muscleGroup || null,
          sortOrder: exIdx,
          note: ex.note?.trim() || null,
          sets: ex.sets.map((s, sIdx) => ({
            id: generateOfflineId('wset'),
            setNumber: sIdx + 1,
            reps: s.reps,
            weightKg: s.weightKg ?? null,
          })),
        };
      });
      const entry: WorkoutEntry = {
        id: generateOfflineId('wrk'),
        userId,
        templateId: payload.templateId ?? null,
        date: payload.date,
        name: payload.name.trim(),
        durationMinutes: payload.durationMinutes,
        note: payload.note?.trim() || null,
        exercises,
        createdAt: now,
        updatedAt: now,
      };
      data.workouts = upsertById(data.workouts, entry);
      await queueOfflineMutation(userId, 'workout', 'upsert', entry.id, now, {
        templateId: entry.templateId,
        date: entry.date,
        name: entry.name,
        durationMinutes: entry.durationMinutes,
        note: entry.note,
        exercises: exercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          muscleGroup: e.muscleGroup,
          sortOrder: e.sortOrder,
          note: e.note,
          sets: e.sets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weightKg: s.weightKg,
          })),
        })),
      });
      return { entry };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: WorkoutEntryPayload,
    ): Promise<{ entry: WorkoutEntry }> {
      const existing = data.workouts.find((w) => w.id === id);
      if (!existing) throw new ApiError(404, 'Antrenman kaydı bulunamadı.');
      const now = new Date().toISOString();
      const allEx = new Map(getAllLocalExercises(data).map((e) => [e.id, e]));
      const exercises =
        payload.exercises !== undefined
          ? payload.exercises.map((ex, exIdx) => {
              const catalog = ex.exerciseId ? allEx.get(ex.exerciseId) : undefined;
              return {
                id: generateOfflineId('wex'),
                exerciseId: catalog?.id ?? ex.exerciseId ?? null,
                exerciseName: (ex.exerciseName?.trim() || catalog?.name || 'Hareket').trim(),
                muscleGroup: ex.muscleGroup?.trim() || catalog?.muscleGroup || null,
                sortOrder: exIdx,
                note: ex.note?.trim() || null,
                sets: ex.sets.map((s, sIdx) => ({
                  id: generateOfflineId('wset'),
                  setNumber: sIdx + 1,
                  reps: s.reps,
                  weightKg: s.weightKg ?? null,
                })),
              };
            })
          : existing.exercises ?? [];
      const entry: WorkoutEntry = {
        ...existing,
        templateId: payload.templateId !== undefined ? payload.templateId : existing.templateId,
        date: payload.date,
        name: payload.name.trim(),
        durationMinutes: payload.durationMinutes,
        note: payload.note?.trim() || null,
        exercises,
        updatedAt: now,
      };
      data.workouts = upsertById(data.workouts, entry);
      await queueOfflineMutation(userId, 'workout', 'upsert', entry.id, now, {
        templateId: entry.templateId ?? null,
        date: entry.date,
        name: entry.name,
        durationMinutes: entry.durationMinutes,
        note: entry.note,
        exercises: exercises.map((e, idx) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          muscleGroup: e.muscleGroup,
          sortOrder: e.sortOrder ?? idx,
          note: e.note ?? null,
          sets: e.sets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weightKg: s.weightKg,
          })),
        })),
      });
      return { entry };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.workouts = removeById(data.workouts, id);
      await queueOfflineMutation(userId, 'workout', 'delete', id, now);
      return { message: 'Antrenman kaydı silindi.' };
    },
  },

  // --- Cardio ---
  cardio: {
    list(
      data: UserLocalData,
      range?: DateRange & { cardioType?: string },
    ): { entries: CardioEntry[]; cardioTypes: string[]; summary: CardioSummary } {
      const entries = data.cardio
        .filter(
          (c) =>
            inDateRange(c.date, range) &&
            (!range?.cardioType || c.cardioType === range.cardioType),
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      return {
        entries,
        cardioTypes: [...DEFAULT_CARDIO_TYPES],
        summary: {
          totalCount: entries.length,
          totalDurationMinutes: entries.reduce((sum, c) => sum + c.durationMinutes, 0),
          totalDistanceKm: round1(entries.reduce((sum, c) => sum + (c.distanceKm ?? 0), 0)),
          totalCaloriesBurned: entries.reduce((sum, c) => sum + (c.caloriesBurned ?? 0), 0),
        },
      };
    },
    async create(
      userId: string,
      data: UserLocalData,
      payload: CardioEntryPayload,
    ): Promise<{ entry: CardioEntry }> {
      const now = new Date().toISOString();
      const entry: CardioEntry = {
        id: generateOfflineId('crd'),
        userId,
        date: payload.date,
        cardioType: payload.cardioType,
        durationMinutes: payload.durationMinutes,
        distanceKm:
          payload.distanceKm !== undefined && payload.distanceKm !== null
            ? round1(payload.distanceKm)
            : null,
        caloriesBurned: payload.caloriesBurned ?? null,
        note: payload.note?.trim() || null,
        createdAt: now,
        updatedAt: now,
      };
      data.cardio = upsertById(data.cardio, entry);
      await queueOfflineMutation(userId, 'cardio', 'upsert', entry.id, now, {
        date: entry.date,
        cardioType: entry.cardioType,
        durationMinutes: entry.durationMinutes,
        distanceKm: entry.distanceKm,
        caloriesBurned: entry.caloriesBurned,
        note: entry.note,
      });
      return { entry };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: CardioEntryPayload,
    ): Promise<{ entry: CardioEntry }> {
      const existing = data.cardio.find((c) => c.id === id);
      if (!existing) throw new ApiError(404, 'Kardiyo kaydı bulunamadı.');
      const now = new Date().toISOString();
      const entry: CardioEntry = {
        ...existing,
        date: payload.date,
        cardioType: payload.cardioType,
        durationMinutes: payload.durationMinutes,
        distanceKm:
          payload.distanceKm !== undefined && payload.distanceKm !== null
            ? round1(payload.distanceKm)
            : null,
        caloriesBurned: payload.caloriesBurned ?? null,
        note: payload.note?.trim() || null,
        updatedAt: now,
      };
      data.cardio = upsertById(data.cardio, entry);
      await queueOfflineMutation(userId, 'cardio', 'upsert', entry.id, now, {
        date: entry.date,
        cardioType: entry.cardioType,
        durationMinutes: entry.durationMinutes,
        distanceKm: entry.distanceKm,
        caloriesBurned: entry.caloriesBurned,
        note: entry.note,
      });
      return { entry };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.cardio = removeById(data.cardio, id);
      await queueOfflineMutation(userId, 'cardio', 'delete', id, now);
      return { message: 'Kardiyo kaydı silindi.' };
    },
  },

  // --- Steps ---
  steps: {
    list(data: UserLocalData, range?: DateRange): { entries: StepEntry[]; summary: StepSummary } {
      const todayDate = getTodayIsoDate();
      const entries = data.steps
        .filter((s) => inDateRange(s.date, range))
        .sort((a, b) => b.date.localeCompare(a.date));
      const dailyStepGoal = data.profile?.dailyStepGoal ?? DEFAULT_GOALS.dailyStepGoal;
      const todaySteps = data.steps.find((s) => s.date === todayDate)?.steps ?? 0;
      const totalSteps = entries.reduce((sum, s) => sum + s.steps, 0);
      return {
        entries,
        summary: {
          dailyStepGoal,
          todayDate,
          todaySteps,
          todayProgressPercent:
            dailyStepGoal > 0 ? Math.min(999, Math.round((todaySteps / dailyStepGoal) * 100)) : 0,
          totalSteps,
          averageDailySteps: entries.length > 0 ? Math.round(totalSteps / entries.length) : 0,
          daysLogged: entries.length,
          goalMetDays: entries.filter((s) => s.steps >= dailyStepGoal).length,
        },
      };
    },
    async upsert(
      userId: string,
      data: UserLocalData,
      payload: StepEntryPayload,
    ): Promise<{ entry: StepEntry; updated: boolean }> {
      const now = new Date().toISOString();
      const existing = data.steps.find((s) => s.date === payload.date);
      const entry: StepEntry = {
        id: existing?.id ?? generateOfflineId('stp'),
        userId,
        date: payload.date,
        steps: payload.steps,
        note: payload.note?.trim() || null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      data.steps = upsertById(data.steps, entry);
      await queueOfflineMutation(userId, 'step', 'upsert', entry.id, now, {
        date: entry.date,
        steps: entry.steps,
        note: entry.note,
      });
      return { entry, updated: Boolean(existing) };
    },
    async update(
      userId: string,
      data: UserLocalData,
      id: string,
      payload: StepEntryPayload,
    ): Promise<{ entry: StepEntry }> {
      const existing = data.steps.find((s) => s.id === id);
      if (!existing) throw new ApiError(404, 'Adım kaydı bulunamadı.');
      const now = new Date().toISOString();
      const entry: StepEntry = {
        ...existing,
        date: payload.date,
        steps: payload.steps,
        note: payload.note?.trim() || null,
        updatedAt: now,
      };
      data.steps = upsertById(data.steps, entry);
      await queueOfflineMutation(userId, 'step', 'upsert', entry.id, now, {
        date: entry.date,
        steps: entry.steps,
        note: entry.note,
      });
      return { entry };
    },
    async remove(userId: string, data: UserLocalData, id: string): Promise<{ message: string }> {
      const now = new Date().toISOString();
      data.steps = removeById(data.steps, id);
      await queueOfflineMutation(userId, 'step', 'delete', id, now);
      return { message: 'Adım kaydı silindi.' };
    },
  },

  // --- Profile ---
  profile: {
    get(data: UserLocalData): ProfileResponse {
      const profile: UserProfile = data.profile ?? {
        id: 'profile',
        userId: data.userId,
        name: 'Kullanıcı',
        email: '',
        ...DEFAULT_GOALS,
        visibleMicronutrients: [...DEFAULT_VISIBLE_MICRONUTRIENTS],
        updatedAt: new Date().toISOString(),
      };
      return {
        profile,
        availableMicronutrients:
          data.availableMicronutrients.length > 0
            ? data.availableMicronutrients
            : [...DEFAULT_MICRONUTRIENT_CATALOG],
      };
    },
    async update(
      userId: string,
      data: UserLocalData,
      payload: UpdateProfilePayload,
    ): Promise<ProfileResponse> {
      const now = new Date().toISOString();
      const current = localStore.profile.get(data).profile;
      const updated: UserProfile = {
        ...current,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.dailyCalorieGoal !== undefined
          ? { dailyCalorieGoal: payload.dailyCalorieGoal }
          : {}),
        ...(payload.proteinGoalG !== undefined ? { proteinGoalG: payload.proteinGoalG } : {}),
        ...(payload.carbsGoalG !== undefined ? { carbsGoalG: payload.carbsGoalG } : {}),
        ...(payload.fatGoalG !== undefined ? { fatGoalG: payload.fatGoalG } : {}),
        ...(payload.dailyStepGoal !== undefined ? { dailyStepGoal: payload.dailyStepGoal } : {}),
        ...(payload.visibleMicronutrients !== undefined
          ? { visibleMicronutrients: payload.visibleMicronutrients }
          : {}),
        updatedAt: now,
      };
      data.profile = updated;
      await queueOfflineMutation(userId, 'profile', 'upsert', 'profile', now, {
        name: updated.name,
        dailyCalorieGoal: updated.dailyCalorieGoal,
        proteinGoalG: updated.proteinGoalG,
        carbsGoalG: updated.carbsGoalG,
        fatGoalG: updated.fatGoalG,
        dailyStepGoal: updated.dailyStepGoal,
        visibleMicronutrients: updated.visibleMicronutrients,
      });
      return localStore.profile.get(data);
    },
  },

  // --- Stats ---
  stats: {
    getSummary(data: UserLocalData, days: StatsDays): StatsSummaryResponse {
      const { from, to } = getRollingRange(days);

      const allWeights = [...data.weights].sort((a, b) => b.date.localeCompare(a.date));
      const latestWeight = allWeights[0] ?? null;
      const periodWeights = data.weights
        .filter((w) => w.date >= from && w.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date));
      const weightChangeKg =
        periodWeights.length >= 2
          ? round1(periodWeights[periodWeights.length - 1].weightKg - periodWeights[0].weightKg)
          : null;

      const caloriesByDate = new Map<string, number>();
      for (const c of data.calories) {
        if (c.date >= from && c.date <= to) {
          caloriesByDate.set(c.date, (caloriesByDate.get(c.date) ?? 0) + c.calories);
        }
      }
      for (const l of data.nutritionLogs) {
        if (l.date >= from && l.date <= to) {
          caloriesByDate.set(l.date, (caloriesByDate.get(l.date) ?? 0) + l.calories);
        }
      }
      const calorieTrend: TrendPoint[] = Array.from(caloriesByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value: Math.round(value) }));

      const todayCalories = Math.round(caloriesByDate.get(to) ?? 0);
      const totalCalories = calorieTrend.reduce((sum, p) => sum + p.value, 0);
      const averageDailyCalories =
        calorieTrend.length > 0 ? Math.round(totalCalories / calorieTrend.length) : 0;

      const periodWorkouts = data.workouts.filter((w) => w.date >= from && w.date <= to);
      const periodCardio = data.cardio.filter((c) => c.date >= from && c.date <= to);
      const periodSteps = data.steps
        .filter((s) => s.date >= from && s.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date));

      const dailyStepGoal = data.profile?.dailyStepGoal ?? DEFAULT_GOALS.dailyStepGoal;
      const todaySteps = periodSteps.find((s) => s.date === to)?.steps ?? 0;
      const totalSteps = periodSteps.reduce((sum, s) => sum + s.steps, 0);

      return {
        period: { days, from, to },
        summary: {
          latestWeightKg: latestWeight?.weightKg ?? null,
          latestWeightDate: latestWeight?.date ?? null,
          weightChangeKg,
          todayCalories,
          averageDailyCalories,
          calorieDaysLogged: calorieTrend.length,
          workoutCount: periodWorkouts.length,
          workoutDurationMinutes: periodWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0),
          cardioCount: periodCardio.length,
          cardioDurationMinutes: periodCardio.reduce((sum, c) => sum + c.durationMinutes, 0),
          cardioDistanceKm: round1(periodCardio.reduce((sum, c) => sum + (c.distanceKm ?? 0), 0)),
          cardioCaloriesBurned: periodCardio.reduce((sum, c) => sum + (c.caloriesBurned ?? 0), 0),
          todaySteps,
          dailyStepGoal,
          averageDailySteps: periodSteps.length > 0 ? Math.round(totalSteps / periodSteps.length) : 0,
          stepDaysLogged: periodSteps.length,
        },
        trends: {
          weights: periodWeights.map((w) => ({ date: w.date, value: w.weightKg })),
          calories: calorieTrend,
          steps: periodSteps.map((s) => ({ date: s.date, value: s.steps })),
        },
      };
    },
  },
};

export { requireActiveUserId, upsertById, removeById };
