import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  buildDateFilter,
  DEFAULT_LIST_LIMIT,
  type DateRangeQuery,
} from '../../utils/dateRange.js';
import { resolveExerciseReferences } from '../exercises/exerciseResolution.js';
import type { PreviousPerformanceQuery, WorkoutEntryInput } from './workouts.schema.js';

const PREVIOUS_LOOKUP_TAKE = 250;

const workoutInclude = {
  exercises: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      sets: {
        orderBy: { setNumber: 'asc' as const },
      },
    },
  },
};

export interface PreviousExercisePerformance {
  workoutId: string;
  date: string;
  workoutName: string;
  exerciseId: string | null;
  exerciseName: string;
  sets: { setNumber: number; reps: number; weightKg: number | null }[];
}

async function assertTemplateOwnership(userId: string, templateId: string | null | undefined) {
  if (!templateId) return;
  const tpl = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!tpl) {
    throw new AppError(404, 'Seçilen antrenman şablonu bulunamadı.');
  }
}

export async function listWorkoutEntries(userId: string, range: DateRangeQuery) {
  const dateFilter = buildDateFilter(range);
  const entries = await prisma.workoutEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: workoutInclude,
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

export async function getPreviousExercisePerformances(
  userId: string,
  query: PreviousPerformanceQuery,
) {
  const byExerciseId: Record<string, PreviousExercisePerformance> = {};
  const byExerciseName: Record<string, PreviousExercisePerformance> = {};

  if (query.exerciseIds.length === 0 && query.exerciseNames.length === 0) {
    return { byExerciseId, byExerciseName };
  }

  const normalizedNameSet = new Set(
    query.exerciseNames.map((n) => n.toLocaleLowerCase('tr-TR')),
  );
  const idSet = new Set(query.exerciseIds);

  const workoutWhere = {
    userId,
    deletedAt: null,
    ...(query.beforeDate ? { date: { lt: query.beforeDate } } : {}),
    ...(query.excludeWorkoutId ? { id: { not: query.excludeWorkoutId } } : {}),
  };

  // Narrow by exerciseId in DB when only IDs are requested; otherwise fetch bounded recent items for case-insensitive Turkish name matching.
  const whereClause =
    query.exerciseNames.length === 0
      ? { workout: workoutWhere, exerciseId: { in: query.exerciseIds } }
      : { workout: workoutWhere };

  const records = await prisma.workoutExercise.findMany({
    where: whereClause,
    include: {
      workout: { select: { id: true, date: true, name: true, createdAt: true } },
      sets: { orderBy: { setNumber: 'asc' } },
    },
    orderBy: [{ workout: { date: 'desc' } }, { workout: { createdAt: 'desc' } }],
    take: PREVIOUS_LOOKUP_TAKE,
  });

  for (const rec of records) {
    const perf: PreviousExercisePerformance = {
      workoutId: rec.workout.id,
      date: rec.workout.date,
      workoutName: rec.workout.name,
      exerciseId: rec.exerciseId,
      exerciseName: rec.exerciseName,
      sets: rec.sets.map((s) => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: s.weightKg,
      })),
    };

    if (rec.exerciseId && idSet.has(rec.exerciseId) && !byExerciseId[rec.exerciseId]) {
      byExerciseId[rec.exerciseId] = perf;
    }

    const normalizedRecName = rec.exerciseName.toLocaleLowerCase('tr-TR');
    if (normalizedNameSet.has(normalizedRecName) && !byExerciseName[normalizedRecName]) {
      byExerciseName[normalizedRecName] = perf;
    }
  }

  return { byExerciseId, byExerciseName };
}

export async function createWorkoutEntry(userId: string, input: WorkoutEntryInput) {
  await assertTemplateOwnership(userId, input.templateId);

  const resolvedExercises =
    input.exercises && input.exercises.length > 0
      ? await resolveExerciseReferences(userId, input.exercises)
      : [];

  const entry = await prisma.workoutEntry.create({
    data: {
      userId,
      templateId: input.templateId ?? null,
      date: input.date,
      name: input.name,
      durationMinutes: input.durationMinutes,
      note: input.note,
      exercises:
        resolvedExercises.length > 0
          ? {
              create: resolvedExercises.map((ex, exIndex) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                muscleGroup: ex.muscleGroup,
                note: ex.note ?? null,
                sortOrder: exIndex,
                sets: {
                  create: ex.sets.map((s, setIndex) => ({
                    setNumber: setIndex + 1,
                    reps: s.reps,
                    weightKg: s.weightKg,
                  })),
                },
              })),
            }
          : undefined,
    },
    include: workoutInclude,
  });

  return { entry };
}

export async function updateWorkoutEntry(userId: string, id: string, input: WorkoutEntryInput) {
  const existing = await prisma.workoutEntry.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Antrenman kaydı bulunamadı.');
  }

  await assertTemplateOwnership(userId, input.templateId);

  const shouldReplaceExercises = input.exercises !== undefined;
  const resolvedExercises =
    shouldReplaceExercises && input.exercises && input.exercises.length > 0
      ? await resolveExerciseReferences(userId, input.exercises)
      : [];

  const entry = await prisma.$transaction(async (tx) => {
    if (shouldReplaceExercises) {
      await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
    }

    return tx.workoutEntry.update({
      where: { id },
      data: {
        date: input.date,
        name: input.name,
        durationMinutes: input.durationMinutes,
        note: input.note,
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(shouldReplaceExercises
          ? {
              exercises: {
                create: resolvedExercises.map((ex, exIndex) => ({
                  exerciseId: ex.exerciseId,
                  exerciseName: ex.exerciseName,
                  muscleGroup: ex.muscleGroup,
                  note: ex.note ?? null,
                  sortOrder: exIndex,
                  sets: {
                    create: ex.sets.map((s, setIndex) => ({
                      setNumber: setIndex + 1,
                      reps: s.reps,
                      weightKg: s.weightKg,
                    })),
                  },
                })),
              },
            }
          : {}),
      },
      include: workoutInclude,
    });
  });

  return { entry };
}

export async function deleteWorkoutEntry(userId: string, id: string) {
  const result = await prisma.workoutEntry.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Antrenman kaydı bulunamadı.');
  }

  return { message: 'Antrenman kaydı silindi.' };
}
