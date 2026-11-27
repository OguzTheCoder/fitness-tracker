import type { NutritionLog } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { buildDateFilter, formatIsoDateUtc } from '../../utils/dateRange.js';
import { ensureCoreFoodsSeeded } from '../foods/foods.seed.js';
import {
  DEFAULT_PROFILE_GOALS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
  MICRONUTRIENT_CATALOG,
  parseVisibleMicronutrients,
  type MicronutrientMeta,
} from '../profile/profile.constants.js';
import { toRecipeDto } from '../recipes/recipes.service.js';
import {
  parseMicronutrients,
  round1,
  round2,
  scaleNutrientsFrom100g,
  scaleNutrientTotals,
  serializeMicronutrients,
  sumNutrientTotals,
  type MicronutrientMap,
} from './nutrition.math.js';
import type {
  CreateNutritionLogInput,
  NutritionLogListQuery,
  UpdateNutritionLogInput,
} from './nutrition.schema.js';

const MICRONUTRIENT_META_BY_KEY = new Map<string, MicronutrientMeta>(
  MICRONUTRIENT_CATALOG.map((item) => [item.key, item]),
);

export interface NutritionLogDto {
  id: string;
  date: string;
  mealLabel: string | null;
  sourceType: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface VisibleMicronutrientSummary extends MicronutrientMeta {
  amount: number;
}

export interface DailyNutritionTotal {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  count: number;
}

function toLogDto(log: NutritionLog): NutritionLogDto {
  return {
    id: log.id,
    date: log.date,
    mealLabel: log.mealLabel,
    sourceType: log.sourceType,
    foodId: log.foodId,
    recipeId: log.recipeId,
    entryName: log.entryName,
    quantityMode: log.quantityMode,
    servings: log.servings,
    grams: round1(log.grams),
    calories: round1(log.calories),
    proteinG: round1(log.proteinG),
    carbsG: round1(log.carbsG),
    fatG: round1(log.fatG),
    micronutrients: parseMicronutrients(log.micronutrients),
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

function getTodayIso(): string {
  const now = new Date();
  return formatIsoDateUtc(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export async function listNutritionLogs(userId: string, query: NutritionLogListQuery) {
  const activeDate = !query.date && !query.from && !query.to ? getTodayIso() : query.date;
  const dateFilter = activeDate
    ? activeDate
    : buildDateFilter({ from: query.from, to: query.to, limit: query.limit, offset: query.offset });

  const [logs, profile] = await Promise.all([
    prisma.nutritionLog.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        dailyCalorieGoal: true,
        proteinGoalG: true,
        carbsGoalG: true,
        fatGoalG: true,
        visibleMicronutrients: true,
      },
    }),
  ]);

  const dtos = logs.map(toLogDto);
  const totals = sumNutrientTotals(dtos);

  const visibleKeys = profile
    ? parseVisibleMicronutrients(profile.visibleMicronutrients)
    : [...DEFAULT_VISIBLE_MICRONUTRIENTS];

  const visibleMicronutrients: VisibleMicronutrientSummary[] = visibleKeys
    .map((key) => {
      const meta = MICRONUTRIENT_META_BY_KEY.get(key);
      if (!meta) return null;
      return {
        ...meta,
        amount: round2(totals.micronutrients[key] ?? 0),
      };
    })
    .filter((item): item is VisibleMicronutrientSummary => item !== null);

  const dailyMap = new Map<string, DailyNutritionTotal>();
  for (const log of dtos) {
    const existing = dailyMap.get(log.date);
    if (existing) {
      existing.calories = round1(existing.calories + log.calories);
      existing.proteinG = round1(existing.proteinG + log.proteinG);
      existing.carbsG = round1(existing.carbsG + log.carbsG);
      existing.fatG = round1(existing.fatG + log.fatG);
      existing.count += 1;
    } else {
      dailyMap.set(log.date, {
        date: log.date,
        calories: log.calories,
        proteinG: log.proteinG,
        carbsG: log.carbsG,
        fatG: log.fatG,
        count: 1,
      });
    }
  }

  return {
    date: activeDate ?? null,
    logs: dtos,
    totals,
    goals: {
      dailyCalorieGoal: profile?.dailyCalorieGoal ?? DEFAULT_PROFILE_GOALS.dailyCalorieGoal,
      proteinGoalG: profile?.proteinGoalG ?? DEFAULT_PROFILE_GOALS.proteinGoalG,
      carbsGoalG: profile?.carbsGoalG ?? DEFAULT_PROFILE_GOALS.carbsGoalG,
      fatGoalG: profile?.fatGoalG ?? DEFAULT_PROFILE_GOALS.fatGoalG,
    },
    visibleMicronutrients,
    dailyTotals: Array.from(dailyMap.values()),
  };
}

export async function createNutritionLog(userId: string, input: CreateNutritionLogInput) {
  await ensureCoreFoodsSeeded();

  if (input.kind === 'food') {
    const food = await prisma.food.findFirst({
      where: {
        id: input.foodId,
        deletedAt: null,
        OR: [{ isCore: true }, { userId }],
      },
    });

    if (!food) {
      throw new AppError(404, 'Besin bulunamadı.');
    }

    const baseServingGrams = food.servingGrams ?? 100;
    const grams =
      input.quantityMode === 'servings'
        ? round1(input.servings! * baseServingGrams)
        : round1(input.grams!);
    const servings =
      input.quantityMode === 'servings' ? round2(input.servings!) : null;

    const computed = scaleNutrientsFrom100g(
      {
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        micronutrientsPer100g: parseMicronutrients(food.micronutrientsPer100g),
      },
      grams,
    );

    const created = await prisma.nutritionLog.create({
      data: {
        userId,
        date: input.date,
        mealLabel: input.mealLabel ?? null,
        sourceType: 'food',
        foodId: food.id,
        entryName: food.name,
        quantityMode: input.quantityMode,
        servings,
        grams,
        calories: computed.calories,
        proteinG: computed.proteinG,
        carbsG: computed.carbsG,
        fatG: computed.fatG,
        micronutrients: serializeMicronutrients(computed.micronutrients),
      },
    });

    const dto = toLogDto(created);
    return { log: dto, logs: [dto] };
  }

  // kind === 'recipe'
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, userId, deletedAt: null },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: { food: true },
      },
    },
  });

  if (!recipe || recipe.items.length === 0) {
    throw new AppError(404, 'Tarif bulunamadı.');
  }

  const recipeDto = toRecipeDto(recipe);
  const totalWeightG = recipeDto.totalWeightG > 0 ? recipeDto.totalWeightG : 100;

  if (input.mode === 'decompose') {
    const factor =
      input.grams !== undefined
        ? input.grams / totalWeightG
        : (input.servings ?? 1) / recipeDto.servingsCount;

    const createdLogs = await prisma.$transaction(
      recipe.items.map((item) => {
        const scaledGrams = round1(item.grams * factor);
        const computed = scaleNutrientsFrom100g(
          {
            caloriesPer100g: item.food.caloriesPer100g,
            proteinPer100g: item.food.proteinPer100g,
            carbsPer100g: item.food.carbsPer100g,
            fatPer100g: item.food.fatPer100g,
            micronutrientsPer100g: parseMicronutrients(item.food.micronutrientsPer100g),
          },
          scaledGrams,
        );

        return prisma.nutritionLog.create({
          data: {
            userId,
            date: input.date,
            mealLabel: input.mealLabel ?? null,
            sourceType: 'recipe_item',
            foodId: item.foodId,
            recipeId: recipe.id,
            entryName: `${item.food.name} (${recipe.name})`,
            quantityMode: 'grams',
            servings: null,
            grams: scaledGrams,
            calories: computed.calories,
            proteinG: computed.proteinG,
            carbsG: computed.carbsG,
            fatG: computed.fatG,
            micronutrients: serializeMicronutrients(computed.micronutrients),
          },
        });
      }),
    );

    return { logs: createdLogs.map(toLogDto) };
  }

  const factor =
    input.mode === 'servings'
      ? input.servings! / recipeDto.servingsCount
      : input.grams! / totalWeightG;
  const grams = input.mode === 'grams' ? round1(input.grams!) : round1(totalWeightG * factor);
  const servings =
    input.mode === 'servings'
      ? round2(input.servings!)
      : round2(recipeDto.servingsCount * factor);

  const computed = scaleNutrientTotals(recipeDto.totals, factor);

  const created = await prisma.nutritionLog.create({
    data: {
      userId,
      date: input.date,
      mealLabel: input.mealLabel ?? null,
      sourceType: 'recipe',
      recipeId: recipe.id,
      entryName: recipe.name,
      quantityMode: input.mode,
      servings,
      grams,
      calories: computed.calories,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      micronutrients: serializeMicronutrients(computed.micronutrients),
    },
  });

  const dto = toLogDto(created);
  return { log: dto, logs: [dto] };
}

export async function updateNutritionLog(
  userId: string,
  id: string,
  input: UpdateNutritionLogInput,
) {
  const existing = await prisma.nutritionLog.findFirst({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, 'Beslenme kaydı bulunamadı.');
  }

  let nutrientPatch: {
    grams?: number;
    servings?: number | null;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    micronutrients?: string;
  } = {};

  if (input.grams !== undefined && existing.grams > 0) {
    // Rescale strictly from the locked snapshot values — never re-reading live Food/Recipe
    const ratio = input.grams / existing.grams;
    const rescaled = scaleNutrientTotals(
      {
        calories: existing.calories,
        proteinG: existing.proteinG,
        carbsG: existing.carbsG,
        fatG: existing.fatG,
        micronutrients: parseMicronutrients(existing.micronutrients),
      },
      ratio,
    );

    nutrientPatch = {
      grams: round1(input.grams),
      servings: existing.servings !== null ? round2(existing.servings * ratio) : null,
      calories: rescaled.calories,
      proteinG: rescaled.proteinG,
      carbsG: rescaled.carbsG,
      fatG: rescaled.fatG,
      micronutrients: serializeMicronutrients(rescaled.micronutrients),
    };
  }

  const updated = await prisma.nutritionLog.update({
    where: { id },
    data: {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.mealLabel !== undefined ? { mealLabel: input.mealLabel } : {}),
      ...nutrientPatch,
    },
  });

  return { log: toLogDto(updated) };
}

export async function deleteNutritionLog(userId: string, id: string) {
  const result = await prisma.nutritionLog.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Beslenme kaydı bulunamadı.');
  }

  return { message: 'Beslenme kaydı silindi.' };
}
