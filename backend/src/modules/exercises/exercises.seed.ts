import { prisma } from '../../config/prisma.js';
import { CORE_EXERCISES } from './coreExercises.data.js';

let seedPromise: Promise<number> | null = null;

export async function seedCoreExercises(): Promise<number> {
  await prisma.$transaction(
    CORE_EXERCISES.map((exercise) =>
      prisma.exercise.upsert({
        where: { coreKey: exercise.coreKey },
        update: {
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          isBodyweight: Boolean(exercise.isBodyweight),
          isCore: true,
          userId: null,
        },
        create: {
          coreKey: exercise.coreKey,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          isBodyweight: Boolean(exercise.isBodyweight),
          isCore: true,
          userId: null,
        },
      }),
    ),
  );

  return CORE_EXERCISES.length;
}

export async function ensureCoreExercisesSeeded(): Promise<void> {
  const existingCount = await prisma.exercise.count({ where: { isCore: true } });
  if (existingCount >= CORE_EXERCISES.length) return;

  if (!seedPromise) {
    seedPromise = seedCoreExercises().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}
