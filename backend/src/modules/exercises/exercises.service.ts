import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { MUSCLE_GROUPS } from './coreExercises.data.js';
import type { ExerciseBodyInput, ExerciseListQuery } from './exercises.schema.js';
import { ensureCoreExercisesSeeded } from './exercises.seed.js';

const MAX_SEARCH_SCAN = 500;

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('tr-TR');
}

function buildScopeWhere(userId: string, scope: ExerciseListQuery['scope']) {
  if (scope === 'core') return { isCore: true, deletedAt: null };
  if (scope === 'custom') return { userId, isCore: false, deletedAt: null };
  return { deletedAt: null, OR: [{ isCore: true }, { userId }] };
}

export async function listExercises(userId: string, query: ExerciseListQuery) {
  await ensureCoreExercisesSeeded();

  const where = {
    ...buildScopeWhere(userId, query.scope),
    ...(query.muscleGroup ? { muscleGroup: query.muscleGroup } : {}),
  };

  if (query.q) {
    const candidates = await prisma.exercise.findMany({
      where,
      orderBy: [{ isCore: 'asc' }, { muscleGroup: 'asc' }, { name: 'asc' }],
      take: MAX_SEARCH_SCAN,
    });

    const needle = normalizeText(query.q);
    const matched = candidates.filter((item) => {
      const haystack = normalizeText(
        `${item.name} ${item.muscleGroup} ${item.equipment ?? ''}`,
      );
      return haystack.includes(needle);
    });

    const sliced = matched.slice(query.offset, query.offset + query.limit);
    return {
      exercises: sliced,
      total: matched.length,
      muscleGroups: [...MUSCLE_GROUPS],
    };
  }

  const [exercises, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      orderBy: [{ isCore: 'asc' }, { muscleGroup: 'asc' }, { name: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.exercise.count({ where }),
  ]);

  return {
    exercises,
    total,
    muscleGroups: [...MUSCLE_GROUPS],
  };
}

export async function createCustomExercise(userId: string, input: ExerciseBodyInput) {
  const exercise = await prisma.exercise.create({
    data: {
      userId,
      isCore: false,
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      isBodyweight: input.isBodyweight,
      notes: input.notes,
    },
  });

  return { exercise };
}

export async function updateCustomExercise(userId: string, id: string, input: ExerciseBodyInput) {
  const existing = await prisma.exercise.findFirst({
    where: { id, userId, isCore: false, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Özel egzersiz bulunamadı.');
  }

  const exercise = await prisma.exercise.update({
    where: { id },
    data: {
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      isBodyweight: input.isBodyweight,
      notes: input.notes,
    },
  });

  return { exercise };
}

export async function deleteCustomExercise(userId: string, id: string) {
  const result = await prisma.exercise.updateMany({
    where: { id, userId, isCore: false, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Özel egzersiz bulunamadı.');
  }

  return { message: 'Özel egzersiz silindi.' };
}
