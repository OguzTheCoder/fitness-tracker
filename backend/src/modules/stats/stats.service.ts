import { prisma } from '../../config/prisma.js';
import { getRollingDateRange } from '../../utils/dateRange.js';
import type { StatsDays } from './stats.schema.js';

export interface TrendPoint {
  date: string;
  value: number;
}

export async function getStatsSummary(userId: string, days: StatsDays) {
  const { from, to } = getRollingDateRange(days);

  const [latestWeight, periodWeights, periodCalories, periodNutritionLogs, periodWorkouts] =
    await Promise.all([
      prisma.weightEntry.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true, weightKg: true },
      }),
      prisma.weightEntry.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        select: { date: true, weightKg: true },
      }),
      prisma.calorieEntry.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        select: { date: true, calories: true },
      }),
      prisma.nutritionLog.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        select: { date: true, calories: true },
      }),
      prisma.workoutEntry.findMany({
        where: { userId, date: { gte: from, lte: to } },
        select: { durationMinutes: true },
      }),
    ]);

  const weightChangeKg =
    periodWeights.length >= 2
      ? Math.round(
          (periodWeights[periodWeights.length - 1].weightKg - periodWeights[0].weightKg) * 10,
        ) / 10
      : null;

  const caloriesByDate = new Map<string, number>();
  for (const entry of periodCalories) {
    caloriesByDate.set(entry.date, (caloriesByDate.get(entry.date) ?? 0) + entry.calories);
  }
  for (const log of periodNutritionLogs) {
    caloriesByDate.set(log.date, (caloriesByDate.get(log.date) ?? 0) + log.calories);
  }

  const calorieTrend: TrendPoint[] = Array.from(caloriesByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      value: Math.round(value),
    }));

  const todayCalories = Math.round(caloriesByDate.get(to) ?? 0);
  const totalPeriodCalories = calorieTrend.reduce((sum, p) => sum + p.value, 0);
  const averageDailyCalories =
    calorieTrend.length > 0 ? Math.round(totalPeriodCalories / calorieTrend.length) : 0;

  const workoutCount = periodWorkouts.length;
  const workoutDurationMinutes = periodWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);

  return {
    period: { days, from, to },
    summary: {
      latestWeightKg: latestWeight?.weightKg ?? null,
      latestWeightDate: latestWeight?.date ?? null,
      weightChangeKg,
      todayCalories,
      averageDailyCalories,
      calorieDaysLogged: calorieTrend.length,
      workoutCount,
      workoutDurationMinutes,
    },
    trends: {
      weights: periodWeights.map((w) => ({ date: w.date, value: w.weightKg })),
      calories: calorieTrend,
    },
  };
}
