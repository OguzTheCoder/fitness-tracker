import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { buildDateFilter, type DateRangeQuery } from '../../utils/dateRange.js';
import type { CalorieEntryInput } from './calories.schema.js';

export interface DailyCalorieTotal {
  date: string;
  totalCalories: number;
  count: number;
}

export async function listCalorieEntries(userId: string, range: DateRangeQuery) {
  const dateFilter = buildDateFilter(range);
  const entries = await prisma.calorieEntry.findMany({
    where: {
      userId,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  const totalsMap = new Map<string, DailyCalorieTotal>();
  for (const entry of entries) {
    const existing = totalsMap.get(entry.date);
    if (existing) {
      existing.totalCalories += entry.calories;
      existing.count += 1;
    } else {
      totalsMap.set(entry.date, {
        date: entry.date,
        totalCalories: entry.calories,
        count: 1,
      });
    }
  }

  return {
    entries,
    dailyTotals: Array.from(totalsMap.values()),
  };
}

export async function createCalorieEntry(userId: string, input: CalorieEntryInput) {
  const entry = await prisma.calorieEntry.create({
    data: {
      userId,
      date: input.date,
      mealName: input.mealName,
      calories: input.calories,
    },
  });

  return { entry };
}

export async function updateCalorieEntry(userId: string, id: string, input: CalorieEntryInput) {
  const existing = await prisma.calorieEntry.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Kalori kaydı bulunamadı.');
  }

  const entry = await prisma.calorieEntry.update({
    where: { id },
    data: {
      date: input.date,
      mealName: input.mealName,
      calories: input.calories,
    },
  });

  return { entry };
}

export async function deleteCalorieEntry(userId: string, id: string) {
  const result = await prisma.calorieEntry.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Kalori kaydı bulunamadı.');
  }

  return { message: 'Kalori kaydı silindi.' };
}
