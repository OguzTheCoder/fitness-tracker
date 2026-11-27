import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';

export interface ExerciseReferenceInput {
  exerciseId?: string | null;
  exerciseName?: string | null;
  muscleGroup?: string | null;
}

export interface ResolvedExerciseRef {
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
}

/**
 * Validates all referenced exerciseIds belong to the core catalog or the authenticated user,
 * and resolves snapshot name + muscleGroup for both catalog and free-text movements.
 */
export async function resolveExerciseReferences<T extends ExerciseReferenceInput>(
  userId: string,
  items: T[],
): Promise<(T & ResolvedExerciseRef)[]> {
  const uniqueIds = Array.from(
    new Set(items.map((item) => item.exerciseId).filter((id): id is string => Boolean(id))),
  );

  const foundMap = new Map<string, { id: string; name: string; muscleGroup: string }>();

  if (uniqueIds.length > 0) {
    const records = await prisma.exercise.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
        OR: [{ isCore: true }, { userId }],
      },
      select: { id: true, name: true, muscleGroup: true },
    });

    for (const record of records) {
      foundMap.set(record.id, record);
    }

    if (foundMap.size !== uniqueIds.length) {
      throw new AppError(404, 'Seçilen egzersizlerden biri bulunamadı veya erişim izni yok.');
    }
  }

  return items.map((item) => {
    const catalog = item.exerciseId ? foundMap.get(item.exerciseId) : undefined;
    const exerciseName = (item.exerciseName?.trim() || catalog?.name || '').trim();
    if (!exerciseName) {
      throw new AppError(400, 'Her hareket için egzersiz seçilmeli veya ad girilmelidir.');
    }
    return {
      ...item,
      exerciseId: catalog?.id ?? null,
      exerciseName,
      muscleGroup: item.muscleGroup?.trim() || catalog?.muscleGroup || null,
    };
  });
}
