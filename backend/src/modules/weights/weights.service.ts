import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  buildDateFilter,
  DEFAULT_LIST_LIMIT,
  type DateRangeQuery,
} from '../../utils/dateRange.js';
import type { WeightEntryInput } from './weights.schema.js';

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export async function listWeightEntries(userId: string, range: DateRangeQuery) {
  const dateFilter = buildDateFilter(range);
  const entries = await prisma.weightEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: { date: 'desc' },
    take: range.limit ?? DEFAULT_LIST_LIMIT,
    skip: range.offset ?? 0,
  });

  return { entries };
}

export async function upsertWeightEntry(userId: string, input: WeightEntryInput) {
  const existing = await prisma.weightEntry.findUnique({
    where: { userId_date: { userId, date: input.date } },
    select: { id: true, deletedAt: true },
  });

  const entry = await prisma.weightEntry.upsert({
    where: { userId_date: { userId, date: input.date } },
    create: {
      userId,
      date: input.date,
      weightKg: input.weightKg,
      note: input.note,
    },
    update: {
      weightKg: input.weightKg,
      note: input.note,
      deletedAt: null,
    },
  });

  return { entry, updated: Boolean(existing && !existing.deletedAt) };
}

export async function updateWeightEntry(userId: string, id: string, input: WeightEntryInput) {
  const existing = await prisma.weightEntry.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Kilo kaydı bulunamadı.');
  }

  try {
    const entry = await prisma.weightEntry.update({
      where: { id },
      data: {
        date: input.date,
        weightKg: input.weightKg,
        note: input.note,
      },
    });
    return { entry };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError(409, 'Bu tarih için zaten bir kilo kaydı mevcut.');
    }
    throw err;
  }
}

export async function deleteWeightEntry(userId: string, id: string) {
  const result = await prisma.weightEntry.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Kilo kaydı bulunamadı.');
  }

  return { message: 'Kilo kaydı silindi.' };
}
