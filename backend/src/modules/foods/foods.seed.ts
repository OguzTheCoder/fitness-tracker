import { prisma } from '../../config/prisma.js';
import { serializeMicronutrients } from '../nutrition/nutrition.math.js';
import { CORE_FOODS } from './coreFoods.data.js';

let seedPromise: Promise<number> | null = null;

export async function seedCoreFoods(): Promise<number> {
  await prisma.$transaction(
    CORE_FOODS.map((food) =>
      prisma.food.upsert({
        where: { coreKey: food.coreKey },
        update: {
          name: food.name,
          category: food.category,
          servingLabel: food.servingLabel,
          servingGrams: food.servingGrams,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          micronutrientsPer100g: serializeMicronutrients(food.micronutrientsPer100g),
          isCore: true,
          userId: null,
        },
        create: {
          coreKey: food.coreKey,
          name: food.name,
          category: food.category,
          servingLabel: food.servingLabel,
          servingGrams: food.servingGrams,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          micronutrientsPer100g: serializeMicronutrients(food.micronutrientsPer100g),
          isCore: true,
          userId: null,
        },
      }),
    ),
  );

  return CORE_FOODS.length;
}

export async function ensureCoreFoodsSeeded(): Promise<void> {
  const existingCount = await prisma.food.count({ where: { isCore: true } });
  if (existingCount >= CORE_FOODS.length) return;

  if (!seedPromise) {
    seedPromise = seedCoreFoods().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}
