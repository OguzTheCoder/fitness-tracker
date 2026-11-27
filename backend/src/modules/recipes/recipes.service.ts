import type { Food, Recipe, RecipeItem } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { ensureCoreFoodsSeeded } from '../foods/foods.seed.js';
import {
  parseMicronutrients,
  round1,
  scaleNutrientsFrom100g,
  scaleNutrientTotals,
  sumNutrientTotals,
  type NutrientTotals,
} from '../nutrition/nutrition.math.js';
import type { RecipeBodyInput, RecipeListQuery } from './recipes.schema.js';

const MAX_RECIPE_SEARCH_SCAN = 300;

export type RecipeWithItems = Recipe & {
  items: (RecipeItem & { food: Food })[];
};

export interface RecipeItemDto extends NutrientTotals {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  sortOrder: number;
}

export interface RecipeDto {
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
  createdAt: Date;
  updatedAt: Date;
}

export function toRecipeDto(recipe: RecipeWithItems): RecipeDto {
  const sortedItems = [...recipe.items].sort((a, b) => a.sortOrder - b.sortOrder);
  let rawWeightG = 0;

  const items: RecipeItemDto[] = sortedItems.map((item) => {
    rawWeightG += item.grams;
    const scaled = scaleNutrientsFrom100g(
      {
        caloriesPer100g: item.food.caloriesPer100g,
        proteinPer100g: item.food.proteinPer100g,
        carbsPer100g: item.food.carbsPer100g,
        fatPer100g: item.food.fatPer100g,
        micronutrientsPer100g: parseMicronutrients(item.food.micronutrientsPer100g),
      },
      item.grams,
    );

    return {
      id: item.id,
      foodId: item.foodId,
      foodName: item.food.name,
      grams: round1(item.grams),
      sortOrder: item.sortOrder,
      ...scaled,
    };
  });

  const totals = sumNutrientTotals(items);
  const servingsCount = recipe.servingsCount > 0 ? recipe.servingsCount : 1;
  const perServing = scaleNutrientTotals(totals, 1 / servingsCount);
  const roundedRaw = round1(rawWeightG);
  const totalWeightG = recipe.cookedWeightG ? round1(recipe.cookedWeightG) : roundedRaw;

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    servingsCount,
    cookedWeightG: recipe.cookedWeightG ? round1(recipe.cookedWeightG) : null,
    rawWeightG: roundedRaw,
    totalWeightG,
    items,
    totals,
    perServing,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

async function assertAccessibleFoods(userId: string, foodIds: string[]) {
  await ensureCoreFoodsSeeded();
  const uniqueIds = Array.from(new Set(foodIds));
  const found = await prisma.food.findMany({
    where: {
      id: { in: uniqueIds },
      deletedAt: null,
      OR: [{ isCore: true }, { userId }],
    },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    throw new AppError(400, 'Tarifteki malzemelerden biri bulunamadı veya erişim izniniz yok.');
  }
}

const recipeInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: { food: true },
  },
};

export async function listRecipes(userId: string, query: RecipeListQuery) {
  if (query.q) {
    const needle = query.q.toLocaleLowerCase('tr-TR');
    const candidates = await prisma.recipe.findMany({
      where: { userId, deletedAt: null },
      include: recipeInclude,
      orderBy: { updatedAt: 'desc' },
      take: MAX_RECIPE_SEARCH_SCAN,
    });

    const filtered = candidates.filter((recipe) => {
      const nameMatch = recipe.name.toLocaleLowerCase('tr-TR').includes(needle);
      const descMatch = recipe.description
        ? recipe.description.toLocaleLowerCase('tr-TR').includes(needle)
        : false;
      return nameMatch || descMatch;
    });

    const paged = filtered.slice(query.offset, query.offset + query.limit);
    return {
      recipes: paged.map(toRecipeDto),
      total: filtered.length,
    };
  }

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId, deletedAt: null },
      include: recipeInclude,
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.recipe.count({ where: { userId, deletedAt: null } }),
  ]);

  return {
    recipes: recipes.map(toRecipeDto),
    total,
  };
}

export async function getRecipeById(userId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId, deletedAt: null },
    include: recipeInclude,
  });

  if (!recipe) {
    throw new AppError(404, 'Tarif bulunamadı.');
  }

  return { recipe: toRecipeDto(recipe) };
}

export async function createRecipe(userId: string, input: RecipeBodyInput) {
  await assertAccessibleFoods(
    userId,
    input.items.map((item) => item.foodId),
  );

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      servingsCount: input.servingsCount,
      cookedWeightG: input.cookedWeightG ?? null,
      items: {
        create: input.items.map((item, index) => ({
          foodId: item.foodId,
          grams: round1(item.grams),
          sortOrder: index,
        })),
      },
    },
    include: recipeInclude,
  });

  return { recipe: toRecipeDto(recipe) };
}

export async function updateRecipe(userId: string, id: string, input: RecipeBodyInput) {
  const existing = await prisma.recipe.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Tarif bulunamadı.');
  }

  await assertAccessibleFoods(
    userId,
    input.items.map((item) => item.foodId),
  );

  const recipe = await prisma.$transaction(async (tx) => {
    await tx.recipeItem.deleteMany({ where: { recipeId: id } });
    return tx.recipe.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        servingsCount: input.servingsCount,
        cookedWeightG: input.cookedWeightG ?? null,
        items: {
          create: input.items.map((item, index) => ({
            foodId: item.foodId,
            grams: round1(item.grams),
            sortOrder: index,
          })),
        },
      },
      include: recipeInclude,
    });
  });

  return { recipe: toRecipeDto(recipe) };
}

export async function deleteRecipe(userId: string, id: string) {
  const result = await prisma.recipe.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Tarif bulunamadı.');
  }

  return { message: 'Tarif silindi.' };
}
