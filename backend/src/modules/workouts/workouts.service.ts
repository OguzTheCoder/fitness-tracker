import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  buildDateFilter,
  DEFAULT_LIST_LIMIT,
  type DateRangeQuery,
} from '../../utils/dateRange.js';
import type { WorkoutEntryInput } from './workouts.schema.js';

export async function listWorkoutEntries(userId: string, range: DateRangeQuery) {
  const dateFilter = buildDateFilter(range);
  const entries = await prisma.workoutEntry.findMany({
    where: {
      userId,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: range.limit ?? DEFAULT_LIST_LIMIT,
    skip: range.offset ?? 0,
  });

  const totalDurationMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);

  return {
    entries,
    summary: {
      totalCount: entries.length,
      totalDurationMinutes,
    },
  };
}

export async function createWorkoutEntry(userId: string, input: WorkoutEntryInput) {
  const entry = await prisma.workoutEntry.create({
    data: {
      userId,
      date: input.date,
      name: input.name,
      durationMinutes: input.durationMinutes,
      note: input.note,
    },
  });

  return { entry };
}

export async function updateWorkoutEntry(userId: string, id: string, input: WorkoutEntryInput) {
  const existing = await prisma.workoutEntry.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Antrenman kaydı bulunamadı.');
  }

  const entry = await prisma.workoutEntry.update({
    where: { id },
    data: {
      date: input.date,
      name: input.name,
      durationMinutes: input.durationMinutes,
      note: input.note,
    },
  });

  return { entry };
}

export async function deleteWorkoutEntry(userId: string, id: string) {
  const result = await prisma.workoutEntry.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Antrenman kaydı bulunamadı.');
  }

  return { message: 'Antrenman kaydı silindi.' };
}
