import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { resolveExerciseReferences } from '../exercises/exerciseResolution.js';
import type {
  WorkoutTemplateBodyInput,
  WorkoutTemplateListQuery,
} from './workoutTemplates.schema.js';

const MAX_SEARCH_SCAN = 200;

const templateInclude = {
  exercises: {
    orderBy: { sortOrder: 'asc' as const },
  },
};

export async function listWorkoutTemplates(userId: string, query: WorkoutTemplateListQuery) {
  if (query.q) {
    const candidates = await prisma.workoutTemplate.findMany({
      where: { userId },
      include: templateInclude,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      take: MAX_SEARCH_SCAN,
    });

    const needle = query.q.toLocaleLowerCase('tr-TR');
    const matched = candidates.filter((tpl) => {
      const names = tpl.exercises.map((ex) => ex.exerciseName).join(' ');
      return `${tpl.name} ${tpl.description ?? ''} ${names}`
        .toLocaleLowerCase('tr-TR')
        .includes(needle);
    });

    return {
      templates: matched.slice(query.offset, query.offset + query.limit),
      total: matched.length,
    };
  }

  const [templates, total] = await Promise.all([
    prisma.workoutTemplate.findMany({
      where: { userId },
      include: templateInclude,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.workoutTemplate.count({ where: { userId } }),
  ]);

  return { templates, total };
}

export async function getWorkoutTemplate(userId: string, id: string) {
  const template = await prisma.workoutTemplate.findFirst({
    where: { id, userId },
    include: templateInclude,
  });

  if (!template) {
    throw new AppError(404, 'Antrenman şablonu bulunamadı.');
  }

  return { template };
}

export async function createWorkoutTemplate(userId: string, input: WorkoutTemplateBodyInput) {
  const resolved = await resolveExerciseReferences(userId, input.exercises);

  const template = await prisma.workoutTemplate.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      exercises: {
        create: resolved.map((ex, index) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          defaultSets: ex.defaultSets,
          defaultReps: ex.defaultReps,
          defaultWeightKg: ex.defaultWeightKg,
          sortOrder: index,
        })),
      },
    },
    include: templateInclude,
  });

  return { template };
}

export async function updateWorkoutTemplate(
  userId: string,
  id: string,
  input: WorkoutTemplateBodyInput,
) {
  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Antrenman şablonu bulunamadı.');
  }

  const resolved = await resolveExerciseReferences(userId, input.exercises);

  const template = await prisma.$transaction(async (tx) => {
    await tx.workoutTemplateExercise.deleteMany({ where: { templateId: id } });
    return tx.workoutTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        exercises: {
          create: resolved.map((ex, index) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            defaultSets: ex.defaultSets,
            defaultReps: ex.defaultReps,
            defaultWeightKg: ex.defaultWeightKg,
            sortOrder: index,
          })),
        },
      },
      include: templateInclude,
    });
  });

  return { template };
}

export async function deleteWorkoutTemplate(userId: string, id: string) {
  const result = await prisma.workoutTemplate.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Antrenman şablonu bulunamadı.');
  }

  return { message: 'Antrenman şablonu silindi.' };
}
