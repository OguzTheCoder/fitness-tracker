import { prisma } from '../../config/prisma.js';
import { getRollingDateRange } from '../../utils/dateRange.js';
import { DEFAULT_DAILY_STEP_GOAL } from '../steps/steps.service.js';
import type { StatsDays } from './stats.schema.js';

export interface TrendPoint {
  date: string;
  value: number;
}

const STATS_PERIOD_TAKE = 1000;

export async function getStatsSummary(userId: string, days: StatsDays) {
  const { from, to } = getRollingDateRange(days);

  const [
    profile,
    latestWeight,
    periodWeights,
    periodCalories,
    periodNutritionLogs,
    periodWorkouts,
    periodCardio,
    periodSteps,
  ] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { dailyStepGoal: true },
    }),
    prisma.weightEntry.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { date: 'desc' },
      select: { date: true, weightKg: true },
    }),
    prisma.weightEntry.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
      take: STATS_PERIOD_TAKE,
    }),
    prisma.calorieEntry.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, calories: true },
      take: STATS_PERIOD_TAKE,
    }),
    prisma.nutritionLog.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, calories: true },
      take: STATS_PERIOD_TAKE,
    }),
    prisma.workoutEntry.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      select: { durationMinutes: true },
      take: STATS_PERIOD_TAKE,
    }),
    prisma.cardioEntry.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      select: { durationMinutes: true, distanceKm: true, caloriesBurned: true },
      take: STATS_PERIOD_TAKE,
    }),
    prisma.stepEntry.findMany({
      where: { userId, deletedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, steps: true },
      take: STATS_PERIOD_TAKE,
    }),
  ]);

  const weightChangeKg =
    periodWeights.length >= 2
      ? Math.round(
          (periodWeights[periodWeights.length - 1].weightKg - periodWeights[0].weightKg) * 10,
        ) / 10
      : null;

  // Nutrition/calorie intake is strictly independent of cardio calories burned.
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

  const cardioCount = periodCardio.length;
  const cardioDurationMinutes = periodCardio.reduce((sum, c) => sum + c.durationMinutes, 0);
  const cardioDistanceKm =
    Math.round(periodCardio.reduce((sum, c) => sum + (c.distanceKm ?? 0), 0) * 10) / 10;
  const cardioCaloriesBurned = periodCardio.reduce((sum, c) => sum + (c.caloriesBurned ?? 0), 0);

  const dailyStepGoal = profile?.dailyStepGoal ?? DEFAULT_DAILY_STEP_GOAL;
  const stepTrend: TrendPoint[] = periodSteps.map((s) => ({ date: s.date, value: s.steps }));
  const todaySteps = periodSteps.find((s) => s.date === to)?.steps ?? 0;
  const totalPeriodSteps = periodSteps.reduce((sum, s) => sum + s.steps, 0);
  const averageDailySteps =
    periodSteps.length > 0 ? Math.round(totalPeriodSteps / periodSteps.length) : 0;

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
      cardioCount,
      cardioDurationMinutes,
      cardioDistanceKm,
      cardioCaloriesBurned,
      todaySteps,
      dailyStepGoal,
      averageDailySteps,
      stepDaysLogged: periodSteps.length,
    },
    trends: {
      weights: periodWeights.map((w) => ({ date: w.date, value: w.weightKg })),
      calories: calorieTrend,
      steps: stepTrend,
    },
  };
}
