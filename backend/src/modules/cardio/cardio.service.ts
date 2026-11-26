import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { buildDateFilter, DEFAULT_LIST_LIMIT } from '../../utils/dateRange.js';
import { CARDIO_TYPES, type CardioEntryInput, type CardioListQuery } from './cardio.schema.js';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function listCardioEntries(userId: string, query: CardioListQuery) {
  const dateFilter = buildDateFilter(query);
  const entries = await prisma.cardioEntry.findMany({
    where: {
      userId,
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(query.cardioType ? { cardioType: query.cardioType } : {}),
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: query.limit ?? DEFAULT_LIST_LIMIT,
    skip: query.offset ?? 0,
  });

  const totalDurationMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalDistanceKm = round1(
    entries.reduce((sum, e) => sum + (e.distanceKm ?? 0), 0),
  );
  const totalCaloriesBurned = entries.reduce((sum, e) => sum + (e.caloriesBurned ?? 0), 0);

  return {
    entries,
    cardioTypes: [...CARDIO_TYPES],
    summary: {
      totalCount: entries.length,
      totalDurationMinutes,
      totalDistanceKm,
      totalCaloriesBurned,
    },
  };
}

export async function createCardioEntry(userId: string, input: CardioEntryInput) {
  const entry = await prisma.cardioEntry.create({
    data: {
      userId,
      date: input.date,
      cardioType: input.cardioType,
      durationMinutes: input.durationMinutes,
      distanceKm: input.distanceKm !== null ? round1(input.distanceKm) : null,
      caloriesBurned: input.caloriesBurned,
      note: input.note,
    },
  });

  return { entry };
}

export async function updateCardioEntry(userId: string, id: string, input: CardioEntryInput) {
  const existing = await prisma.cardioEntry.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Kardiyo kaydı bulunamadı.');
  }

  const entry = await prisma.cardioEntry.update({
    where: { id },
    data: {
      date: input.date,
      cardioType: input.cardioType,
      durationMinutes: input.durationMinutes,
      distanceKm: input.distanceKm !== null ? round1(input.distanceKm) : null,
      caloriesBurned: input.caloriesBurned,
      note: input.note,
    },
  });

  return { entry };
}

export async function deleteCardioEntry(userId: string, id: string) {
  const result = await prisma.cardioEntry.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Kardiyo kaydı bulunamadı.');
  }

  return { message: 'Kardiyo kaydı silindi.' };
}
