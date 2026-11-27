import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  buildDateFilter,
  DEFAULT_LIST_LIMIT,
  getRollingDateRange,
  type DateRangeQuery,
} from '../../utils/dateRange.js';
import type { StepEntryInput } from './steps.schema.js';

export const DEFAULT_DAILY_STEP_GOAL = 8000;

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export async function listStepEntries(userId: string, range: DateRangeQuery) {
  const dateFilter = buildDateFilter(range);
  const todayDate = getRollingDateRange(1).to;

  const [entries, profile, todayEntry] = await Promise.all([
    prisma.stepEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: 'desc' },
      take: range.limit ?? DEFAULT_LIST_LIMIT,
      skip: range.offset ?? 0,
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { dailyStepGoal: true },
    }),
    prisma.stepEntry.findFirst({
      where: { userId, date: todayDate, deletedAt: null },
      select: { steps: true },
    }),
  ]);

  const dailyStepGoal = profile?.dailyStepGoal ?? DEFAULT_DAILY_STEP_GOAL;
  const todaySteps = todayEntry?.steps ?? 0;
  const todayProgressPercent =
    dailyStepGoal > 0 ? Math.min(999, Math.round((todaySteps / dailyStepGoal) * 100)) : 0;

  const totalSteps = entries.reduce((sum, entry) => sum + entry.steps, 0);
  const averageDailySteps = entries.length > 0 ? Math.round(totalSteps / entries.length) : 0;
  const goalMetDays = entries.filter((entry) => entry.steps >= dailyStepGoal).length;

  return {
    entries,
    summary: {
      dailyStepGoal,
      todayDate,
      todaySteps,
      todayProgressPercent,
      totalSteps,
      averageDailySteps,
      daysLogged: entries.length,
      goalMetDays,
    },
  };
}

export async function upsertStepEntry(userId: string, input: StepEntryInput) {
  const existing = await prisma.stepEntry.findUnique({
    where: { userId_date: { userId, date: input.date } },
    select: { id: true, deletedAt: true },
  });

  const entry = await prisma.stepEntry.upsert({
    where: { userId_date: { userId, date: input.date } },
    create: {
      userId,
      date: input.date,
      steps: input.steps,
      note: input.note,
    },
    update: {
      steps: input.steps,
      note: input.note,
      deletedAt: null,
    },
  });

  return { entry, updated: Boolean(existing && !existing.deletedAt) };
}

export async function updateStepEntry(userId: string, id: string, input: StepEntryInput) {
  const existing = await prisma.stepEntry.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Adım kaydı bulunamadı.');
  }

  try {
    const entry = await prisma.stepEntry.update({
      where: { id },
      data: {
        date: input.date,
        steps: input.steps,
        note: input.note,
      },
    });
    return { entry };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError(409, 'Bu tarih için zaten bir adım kaydı mevcut.');
    }
    throw err;
  }
}

export async function deleteStepEntry(userId: string, id: string) {
  const result = await prisma.stepEntry.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Adım kaydı bulunamadı.');
  }

  return { message: 'Adım kaydı silindi.' };
}
