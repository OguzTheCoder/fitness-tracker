import type { Food } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  parseMicronutrients,
  round1,
  serializeMicronutrients,
  type MicronutrientMap,
} from '../nutrition/nutrition.math.js';
import { getBarcodeProvider } from './barcode.provider.js';
import { isStandardBarcode, type FoodBodyInput, type FoodListQuery } from './foods.schema.js';
import { ensureCoreFoodsSeeded } from './foods.seed.js';

const MAX_SEARCH_SCAN = 500;

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export type BarcodeLookupSource = 'local' | 'core' | 'open_food_facts' | 'not_found';

export interface BarcodeLookupResult {
  found: boolean;
  source: BarcodeLookupSource;
  barcode: string;
  food: FoodDto | null;
  externalError?: string;
}

export interface FoodDto {
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
  createdAt: Date;
  updatedAt: Date;
}

export function toFoodDto(food: Food): FoodDto {
  return {
    id: food.id,
    isCore: food.isCore,
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    category: food.category,
    servingLabel: food.servingLabel,
    servingGrams: food.servingGrams,
    caloriesPer100g: round1(food.caloriesPer100g),
    proteinPer100g: round1(food.proteinPer100g),
    carbsPer100g: round1(food.carbsPer100g),
    fatPer100g: round1(food.fatPer100g),
    micronutrientsPer100g: parseMicronutrients(food.micronutrientsPer100g),
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
  };
}

function buildScopeWhere(userId: string, scope: FoodListQuery['scope']) {
  if (scope === 'core') return { isCore: true, deletedAt: null };
  if (scope === 'custom') return { userId, isCore: false, deletedAt: null };
  return { deletedAt: null, OR: [{ isCore: true }, { userId }] };
}

export async function listFoods(userId: string, query: FoodListQuery) {
  await ensureCoreFoodsSeeded();

  const where = {
    ...buildScopeWhere(userId, query.scope),
    ...(query.category ? { category: query.category } : {}),
  };

  if (query.q) {
    const needle = query.q.toLocaleLowerCase('tr-TR');
    const candidates = await prisma.food.findMany({
      where,
      orderBy: [{ isCore: 'asc' }, { name: 'asc' }],
      take: MAX_SEARCH_SCAN,
    });

    const filtered = candidates.filter((food) => {
      const nameMatch = food.name.toLocaleLowerCase('tr-TR').includes(needle);
      const brandMatch = food.brand
        ? food.brand.toLocaleLowerCase('tr-TR').includes(needle)
        : false;
      const categoryMatch = food.category
        ? food.category.toLocaleLowerCase('tr-TR').includes(needle)
        : false;
      const barcodeMatch = food.barcode
        ? food.barcode.toLocaleLowerCase('tr-TR').includes(needle)
        : false;
      return nameMatch || brandMatch || categoryMatch || barcodeMatch;
    });

    const paged = filtered.slice(query.offset, query.offset + query.limit);
    return {
      foods: paged.map(toFoodDto),
      total: filtered.length,
    };
  }

  const [foods, total] = await Promise.all([
    prisma.food.findMany({
      where,
      orderBy: [{ isCore: 'asc' }, { name: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.food.count({ where }),
  ]);

  return {
    foods: foods.map(toFoodDto),
    total,
  };
}

export async function getFoodById(userId: string, id: string) {
  await ensureCoreFoodsSeeded();

  const food = await prisma.food.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [{ isCore: true }, { userId }],
    },
  });

  if (!food) {
    throw new AppError(404, 'Besin bulunamadı.');
  }

  return { food: toFoodDto(food) };
}

function buildFoodPersistenceData(input: FoodBodyInput) {
  return {
    barcode: input.barcode ?? null,
    name: input.name,
    brand: input.brand ?? null,
    category: input.category ?? null,
    servingLabel: input.servingLabel ?? (input.servingGrams ? '1 porsiyon' : null),
    servingGrams: input.servingGrams ?? null,
    caloriesPer100g: round1(input.caloriesPer100g),
    proteinPer100g: round1(input.proteinPer100g),
    carbsPer100g: round1(input.carbsPer100g),
    fatPer100g: round1(input.fatPer100g),
    micronutrientsPer100g: serializeMicronutrients(input.micronutrientsPer100g),
  };
}

export async function lookupFoodByBarcode(
  userId: string,
  barcode: string,
): Promise<BarcodeLookupResult> {
  await ensureCoreFoodsSeeded();

  const localFood = await prisma.food.findFirst({
    where: { userId, barcode, deletedAt: null },
  });
  if (localFood) {
    return { found: true, source: 'local', barcode, food: toFoodDto(localFood) };
  }

  const coreFood = await prisma.food.findFirst({
    where: { isCore: true, barcode, deletedAt: null },
  });
  if (coreFood) {
    return { found: true, source: 'core', barcode, food: toFoodDto(coreFood) };
  }

  if (!isStandardBarcode(barcode)) {
    return { found: false, source: 'not_found', barcode, food: null };
  }

  let externalProduct;
  try {
    externalProduct = await getBarcodeProvider().lookup(barcode);
  } catch {
    return {
      found: false,
      source: 'not_found',
      barcode,
      food: null,
      externalError:
        'Open Food Facts servisine şu an ulaşılamadı. Bu kodu kendi besinin olarak tanımlayabilirsin.',
    };
  }

  if (!externalProduct) {
    return { found: false, source: 'not_found', barcode, food: null };
  }

  try {
    const cached = await prisma.food.create({
      data: {
        userId,
        isCore: false,
        ...buildFoodPersistenceData(externalProduct),
      },
    });
    return { found: true, source: 'open_food_facts', barcode, food: toFoodDto(cached) };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await prisma.food.findFirst({ where: { userId, barcode } });
      if (existing) {
        return { found: true, source: 'local', barcode, food: toFoodDto(existing) };
      }
    }
    throw err;
  }
}

export async function createFood(userId: string, input: FoodBodyInput) {
  try {
    const food = await prisma.food.create({
      data: {
        userId,
        isCore: false,
        ...buildFoodPersistenceData(input),
      },
    });

    return { food: toFoodDto(food) };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError(409, 'Bu barkod / QR kodu başka bir besininizde zaten kayıtlı.');
    }
    throw err;
  }
}

export async function updateFood(userId: string, id: string, input: FoodBodyInput) {
  const existing = await prisma.food.findUnique({
    where: { id },
    select: { id: true, userId: true, isCore: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt || (!existing.isCore && existing.userId !== userId)) {
    throw new AppError(404, 'Besin bulunamadı.');
  }

  if (existing.isCore) {
    throw new AppError(403, 'Çekirdek besinler düzenlenemez.');
  }

  try {
    const food = await prisma.food.update({
      where: { id },
      data: buildFoodPersistenceData(input),
    });

    return { food: toFoodDto(food) };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError(409, 'Bu barkod / QR kodu başka bir besininizde zaten kayıtlı.');
    }
    throw err;
  }
}

export async function deleteFood(userId: string, id: string) {
  const existing = await prisma.food.findUnique({
    where: { id },
    select: { id: true, userId: true, isCore: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt || (!existing.isCore && existing.userId !== userId)) {
    throw new AppError(404, 'Besin bulunamadı.');
  }

  if (existing.isCore) {
    throw new AppError(403, 'Çekirdek besinler silinemez.');
  }

  const usedInRecipeCount = await prisma.recipeItem.count({
    where: { foodId: id, recipe: { userId, deletedAt: null } },
  });
  if (usedInRecipeCount > 0) {
    throw new AppError(409, 'Bu besin bir tarifte kullanıldığı için silinemez.');
  }

  await prisma.food.update({
    where: { id },
    data: { deletedAt: new Date(), barcode: null },
  });

  return { message: 'Besin silindi.' };
}
