import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { formatIsoDateUtc } from '../../utils/dateRange.js';
import { ensureCoreExercisesSeeded } from '../exercises/exercises.seed.js';
import { ensureCoreFoodsSeeded } from '../foods/foods.seed.js';
import { parseMicronutrients, round1, serializeMicronutrients } from '../nutrition/nutrition.math.js';
import {
  DEFAULT_PROFILE_GOALS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
  parseVisibleMicronutrients,
} from '../profile/profile.constants.js';
import {
  BACKUP_APP_NAME,
  BACKUP_APP_VERSION,
  BACKUP_DATASET_KEYS,
  BACKUP_SCHEMA_VERSION,
  type BackupDatasetKey,
  type CsvDataset,
} from './backup.constants.js';
import { buildCsv, formatMicronutrientsForCsv, type CsvCell } from './backup.csv.js';
import type { BackupPayload, ImportBackupInput } from './backup.schema.js';

type DatasetCounts = Record<BackupDatasetKey, number>;

export interface BackupImportResult {
  mode: ImportBackupInput['mode'];
  conflictStrategy: ImportBackupInput['conflictStrategy'];
  profileUpdated: boolean;
  summary: {
    imported: DatasetCounts;
    updated: DatasetCounts;
    skipped: DatasetCounts;
  };
  totals: {
    imported: number;
    updated: number;
    skipped: number;
  };
}

function emptyCounts(): DatasetCounts {
  return Object.fromEntries(BACKUP_DATASET_KEYS.map((key) => [key, 0])) as DatasetCounts;
}

function sumCounts(counts: DatasetCounts): number {
  return Object.values(counts).reduce((acc, n) => acc + n, 0);
}

function normalizeKey(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? '').trim().toLocaleLowerCase('tr-TR')).join('\u001f');
}

function buildMultiset(keys: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const key of keys) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function consumeMultiset(map: Map<string, number>, key: string): boolean {
  const count = map.get(key) ?? 0;
  if (count <= 0) return false;
  map.set(key, count - 1);
  return true;
}

function getTodayIso(): string {
  const now = new Date();
  return formatIsoDateUtc(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function resolveFoodLink(
  foodRefId: string | null,
  foodCoreKey: string | null,
  customFoodMap: Map<string, string>,
  coreFoodMap: Map<string, string>,
  required: boolean,
): string | null {
  if (foodCoreKey) {
    const id = coreFoodMap.get(foodCoreKey);
    if (!id) {
      throw new AppError(400, `Yedekteki temel besin anahtarı bulunamadı: ${foodCoreKey}`);
    }
    return id;
  }
  if (foodRefId) {
    const id = customFoodMap.get(foodRefId);
    if (!id) {
      throw new AppError(400, `Yedekteki özel besin referansı bulunamadı: ${foodRefId}`);
    }
    return id;
  }
  if (required) {
    throw new AppError(400, 'Tarif malzemesi geçerli bir besin referansı içermelidir.');
  }
  return null;
}

function resolveExerciseLink(
  exerciseRefId: string | null,
  exerciseCoreKey: string | null,
  customExerciseMap: Map<string, string>,
  coreExerciseMap: Map<string, string>,
): string | null {
  if (exerciseCoreKey) {
    const id = coreExerciseMap.get(exerciseCoreKey);
    if (!id) {
      throw new AppError(400, `Yedekteki hazır egzersiz anahtarı bulunamadı: ${exerciseCoreKey}`);
    }
    return id;
  }
  if (exerciseRefId) {
    const id = customExerciseMap.get(exerciseRefId);
    if (!id) {
      throw new AppError(400, `Yedekteki özel egzersiz referansı bulunamadı: ${exerciseRefId}`);
    }
    return id;
  }
  return null;
}

function nutritionLogSignature(item: {
  date: string;
  mealLabel: string | null;
  sourceType: string;
  entryName: string;
  quantityMode: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}): string {
  return normalizeKey(
    item.date,
    item.mealLabel,
    item.sourceType,
    item.entryName,
    item.quantityMode,
    String(round1(item.grams)),
    String(round1(item.calories)),
    String(round1(item.proteinG)),
    String(round1(item.carbsG)),
    String(round1(item.fatG)),
  );
}

function workoutSignature(item: {
  date: string;
  name: string;
  durationMinutes: number;
  note: string | null;
  exercises: {
    exerciseName: string;
    sets: { setNumber: number; reps: number; weightKg: number | null }[];
  }[];
}): string {
  const exerciseSig = item.exercises
    .map(
      (ex) =>
        `${ex.exerciseName.trim().toLocaleLowerCase('tr-TR')}:${ex.sets
          .map((s) => `${s.setNumber}x${s.reps}@${s.weightKg ?? ''}`)
          .join(',')}`,
    )
    .join('|');
  return normalizeKey(item.date, item.name, String(item.durationMinutes), item.note, exerciseSig);
}

export async function exportJsonBackup(userId: string): Promise<{
  filename: string;
  payload: BackupPayload;
}> {
  const [
    user,
    weights,
    calories,
    customFoods,
    recipes,
    nutritionLogs,
    customExercises,
    workoutTemplates,
    workouts,
    cardio,
    steps,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: true },
    }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: [{ date: 'asc' }] }),
    prisma.calorieEntry.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.food.findMany({
      where: { userId, isCore: false },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.recipe.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { food: { select: { id: true, isCore: true, coreKey: true } } },
        },
      },
    }),
    prisma.nutritionLog.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: { food: { select: { id: true, isCore: true, coreKey: true } } },
    }),
    prisma.exercise.findMany({
      where: { userId, isCore: false },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.workoutTemplate.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        exercises: {
          orderBy: { sortOrder: 'asc' },
          include: { exercise: { select: { id: true, isCore: true, coreKey: true } } },
        },
      },
    }),
    prisma.workoutEntry.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        exercises: {
          orderBy: { sortOrder: 'asc' },
          include: {
            exercise: { select: { id: true, isCore: true, coreKey: true } },
            sets: { orderBy: { setNumber: 'asc' } },
          },
        },
      },
    }),
    prisma.cardioEntry.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.stepEntry.findMany({ where: { userId }, orderBy: [{ date: 'asc' }] }),
  ]);

  if (!user) {
    throw new AppError(404, 'Kullanıcı bulunamadı.');
  }

  const profile = user.profile;
  const payload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_NAME,
    appVersion: BACKUP_APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      profile: {
        name: user.name,
        dailyCalorieGoal: profile?.dailyCalorieGoal ?? DEFAULT_PROFILE_GOALS.dailyCalorieGoal,
        proteinGoalG: profile?.proteinGoalG ?? DEFAULT_PROFILE_GOALS.proteinGoalG,
        carbsGoalG: profile?.carbsGoalG ?? DEFAULT_PROFILE_GOALS.carbsGoalG,
        fatGoalG: profile?.fatGoalG ?? DEFAULT_PROFILE_GOALS.fatGoalG,
        dailyStepGoal: profile?.dailyStepGoal ?? DEFAULT_PROFILE_GOALS.dailyStepGoal,
        visibleMicronutrients: profile
          ? parseVisibleMicronutrients(profile.visibleMicronutrients)
          : [...DEFAULT_VISIBLE_MICRONUTRIENTS],
      },
      weights: weights.map((w) => ({
        date: w.date,
        weightKg: w.weightKg,
        note: w.note,
      })),
      calories: calories.map((c) => ({
        date: c.date,
        mealName: c.mealName,
        calories: c.calories,
      })),
      customFoods: customFoods.map((f) => ({
        refId: f.id,
        barcode: f.barcode,
        name: f.name,
        brand: f.brand,
        category: f.category,
        servingLabel: f.servingLabel,
        servingGrams: f.servingGrams,
        caloriesPer100g: f.caloriesPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
        micronutrientsPer100g: parseMicronutrients(f.micronutrientsPer100g),
      })),
      recipes: recipes.map((r) => ({
        refId: r.id,
        name: r.name,
        description: r.description,
        servingsCount: r.servingsCount,
        cookedWeightG: r.cookedWeightG,
        items: r.items.map((item) => ({
          foodRefId: item.food.isCore ? null : item.food.id,
          foodCoreKey: item.food.isCore ? item.food.coreKey : null,
          grams: item.grams,
          sortOrder: item.sortOrder,
        })),
      })),
      nutritionLogs: nutritionLogs.map((log) => ({
        date: log.date,
        mealLabel: log.mealLabel,
        sourceType: log.sourceType as 'food' | 'recipe' | 'recipe_item',
        foodRefId: log.food && !log.food.isCore ? log.food.id : null,
        foodCoreKey: log.food?.isCore ? log.food.coreKey : null,
        recipeRefId: log.recipeId,
        entryName: log.entryName,
        quantityMode: log.quantityMode as 'grams' | 'servings',
        servings: log.servings,
        grams: round1(log.grams),
        calories: round1(log.calories),
        proteinG: round1(log.proteinG),
        carbsG: round1(log.carbsG),
        fatG: round1(log.fatG),
        micronutrients: parseMicronutrients(log.micronutrients),
      })),
      customExercises: customExercises.map((ex) => ({
        refId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        isBodyweight: ex.isBodyweight,
        notes: ex.notes,
      })),
      workoutTemplates: workoutTemplates.map((tpl) => ({
        refId: tpl.id,
        name: tpl.name,
        description: tpl.description,
        exercises: tpl.exercises.map((item) => ({
          exerciseRefId: item.exercise && !item.exercise.isCore ? item.exercise.id : null,
          exerciseCoreKey: item.exercise?.isCore ? item.exercise.coreKey : null,
          exerciseName: item.exerciseName,
          muscleGroup: item.muscleGroup,
          defaultSets: item.defaultSets,
          defaultReps: item.defaultReps,
          defaultWeightKg: item.defaultWeightKg,
          sortOrder: item.sortOrder,
        })),
      })),
      workouts: workouts.map((w) => ({
        date: w.date,
        name: w.name,
        durationMinutes: w.durationMinutes,
        note: w.note,
        templateRefId: w.templateId,
        exercises: w.exercises.map((ex) => ({
          exerciseRefId: ex.exercise && !ex.exercise.isCore ? ex.exercise.id : null,
          exerciseCoreKey: ex.exercise?.isCore ? ex.exercise.coreKey : null,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          sortOrder: ex.sortOrder,
          note: ex.note,
          sets: ex.sets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weightKg: s.weightKg,
          })),
        })),
      })),
      cardio: cardio.map((c) => ({
        date: c.date,
        cardioType: c.cardioType,
        durationMinutes: c.durationMinutes,
        distanceKm: c.distanceKm,
        caloriesBurned: c.caloriesBurned,
        note: c.note,
      })),
      steps: steps.map((s) => ({
        date: s.date,
        steps: s.steps,
        note: s.note,
      })),
    },
  };

  return {
    filename: `fitness-tracker-backup-${getTodayIso()}.json`,
    payload,
  };
}

export async function exportCsvDataset(
  userId: string,
  dataset: CsvDataset,
): Promise<{ filename: string; csv: string }> {
  const filename = `fitness-tracker-${dataset}-${getTodayIso()}.csv`;

  switch (dataset) {
    case 'weights': {
      const entries = await prisma.weightEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }],
      });
      const csv = buildCsv(
        ['Tarih', 'Kilo (kg)', 'Not'],
        entries.map((e) => [e.date, e.weightKg, e.note]),
      );
      return { filename, csv };
    }

    case 'nutrition': {
      const logs = await prisma.nutritionLog.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
      const csv = buildCsv(
        [
          'Tarih',
          'Öğün',
          'Kaynak',
          'Besin / Tarif',
          'Miktar Modu',
          'Porsiyon',
          'Gram',
          'Kalori (kcal)',
          'Protein (g)',
          'Karbonhidrat (g)',
          'Yağ (g)',
          'Mikro Besinler',
        ],
        logs.map((l) => [
          l.date,
          l.mealLabel,
          l.sourceType,
          l.entryName,
          l.quantityMode,
          l.servings,
          round1(l.grams),
          round1(l.calories),
          round1(l.proteinG),
          round1(l.carbsG),
          round1(l.fatG),
          formatMicronutrientsForCsv(parseMicronutrients(l.micronutrients)),
        ]),
      );
      return { filename, csv };
    }

    case 'workouts': {
      const workouts = await prisma.workoutEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          exercises: {
            orderBy: { sortOrder: 'asc' },
            include: { sets: { orderBy: { setNumber: 'asc' } } },
          },
        },
      });
      const rows: CsvCell[][] = [];
      for (const w of workouts) {
        if (w.exercises.length === 0) {
          rows.push([w.date, w.name, w.durationMinutes, w.note, '', '', '', '', '', '']);
          continue;
        }
        for (const ex of w.exercises) {
          if (ex.sets.length === 0) {
            rows.push([
              w.date,
              w.name,
              w.durationMinutes,
              w.note,
              ex.exerciseName,
              ex.muscleGroup,
              '',
              '',
              '',
              ex.note,
            ]);
            continue;
          }
          for (const set of ex.sets) {
            rows.push([
              w.date,
              w.name,
              w.durationMinutes,
              w.note,
              ex.exerciseName,
              ex.muscleGroup,
              set.setNumber,
              set.reps,
              set.weightKg,
              ex.note,
            ]);
          }
        }
      }
      const csv = buildCsv(
        [
          'Tarih',
          'Antrenman',
          'Süre (dk)',
          'Antrenman Notu',
          'Hareket',
          'Kas Bölgesi',
          'Set No',
          'Tekrar',
          'Ağırlık (kg)',
          'Hareket Notu',
        ],
        rows,
      );
      return { filename, csv };
    }

    case 'cardio': {
      const entries = await prisma.cardioEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
      const csv = buildCsv(
        ['Tarih', 'Kardiyo Türü', 'Süre (dk)', 'Mesafe (km)', 'Yakılan Kalori (kcal)', 'Not'],
        entries.map((e) => [
          e.date,
          e.cardioType,
          e.durationMinutes,
          e.distanceKm,
          e.caloriesBurned,
          e.note,
        ]),
      );
      return { filename, csv };
    }

    case 'steps': {
      const entries = await prisma.stepEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }],
      });
      const csv = buildCsv(
        ['Tarih', 'Adım', 'Not'],
        entries.map((e) => [e.date, e.steps, e.note]),
      );
      return { filename, csv };
    }

    case 'calories': {
      const entries = await prisma.calorieEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
      const csv = buildCsv(
        ['Tarih', 'Öğün', 'Kalori (kcal)'],
        entries.map((e) => [e.date, e.mealName, e.calories]),
      );
      return { filename, csv };
    }
  }
}

export async function importJsonBackup(
  userId: string,
  input: ImportBackupInput,
): Promise<BackupImportResult> {
  await Promise.all([ensureCoreFoodsSeeded(), ensureCoreExercisesSeeded()]);

  const { mode, conflictStrategy, backup } = input;
  const { data } = backup;
  const preferBackup = mode === 'overwrite' || conflictStrategy === 'prefer_backup';

  return prisma.$transaction(
    async (tx) => {
      const imported = emptyCounts();
      const updated = emptyCounts();
      const skipped = emptyCounts();

      const [coreFoods, coreExercises] = await Promise.all([
        tx.food.findMany({
          where: { isCore: true, coreKey: { not: null } },
          select: { id: true, coreKey: true },
        }),
        tx.exercise.findMany({
          where: { isCore: true, coreKey: { not: null } },
          select: { id: true, coreKey: true },
        }),
      ]);

      const coreFoodMap = new Map(coreFoods.map((f) => [f.coreKey!, f.id]));
      const coreExerciseMap = new Map(coreExercises.map((e) => [e.coreKey!, e.id]));

      if (mode === 'overwrite') {
        await tx.nutritionLog.deleteMany({ where: { userId } });
        await tx.recipe.deleteMany({ where: { userId } });
        await tx.food.deleteMany({ where: { userId, isCore: false } });
        await tx.workoutEntry.deleteMany({ where: { userId } });
        await tx.workoutTemplate.deleteMany({ where: { userId } });
        await tx.exercise.deleteMany({ where: { userId, isCore: false } });
        await tx.weightEntry.deleteMany({ where: { userId } });
        await tx.calorieEntry.deleteMany({ where: { userId } });
        await tx.cardioEntry.deleteMany({ where: { userId } });
        await tx.stepEntry.deleteMany({ where: { userId } });
      }

      let profileUpdated = false;
      if (data.profile && preferBackup) {
        if (data.profile.name) {
          await tx.user.update({
            where: { id: userId },
            data: { name: data.profile.name },
          });
        }
        const profileData = {
          dailyCalorieGoal: data.profile.dailyCalorieGoal,
          proteinGoalG: data.profile.proteinGoalG,
          carbsGoalG: data.profile.carbsGoalG,
          fatGoalG: data.profile.fatGoalG,
          dailyStepGoal: data.profile.dailyStepGoal,
          visibleMicronutrients: JSON.stringify(data.profile.visibleMicronutrients),
        };
        await tx.userProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
        profileUpdated = true;
      }

      // 1. Custom Foods
      const customFoodMap = new Map<string, string>();
      const existingFoods =
        mode === 'merge'
          ? await tx.food.findMany({ where: { userId, isCore: false } })
          : [];
      const existingFoodByBarcode = new Map(
        existingFoods.filter((f) => f.barcode).map((f) => [f.barcode!, f]),
      );
      const existingFoodByName = new Map(
        existingFoods.map((f) => [normalizeKey(f.name, f.brand), f]),
      );

      for (const food of data.customFoods) {
        const matched =
          (food.barcode ? existingFoodByBarcode.get(food.barcode) : undefined) ??
          existingFoodByName.get(normalizeKey(food.name, food.brand));

        const fields = {
          barcode: food.barcode,
          name: food.name,
          brand: food.brand,
          category: food.category,
          servingLabel: food.servingLabel,
          servingGrams: food.servingGrams,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          micronutrientsPer100g: serializeMicronutrients(food.micronutrientsPer100g),
        };

        if (matched) {
          customFoodMap.set(food.refId, matched.id);
          if (preferBackup) {
            const safeBarcode =
              food.barcode &&
              existingFoodByBarcode.get(food.barcode) &&
              existingFoodByBarcode.get(food.barcode)!.id !== matched.id
                ? matched.barcode
                : food.barcode;
            await tx.food.update({
              where: { id: matched.id },
              data: { ...fields, barcode: safeBarcode },
            });
            updated.customFoods += 1;
          } else {
            skipped.customFoods += 1;
          }
          continue;
        }

        const created = await tx.food.create({
          data: { userId, isCore: false, coreKey: null, ...fields },
        });
        customFoodMap.set(food.refId, created.id);
        if (created.barcode) existingFoodByBarcode.set(created.barcode, created);
        existingFoodByName.set(normalizeKey(created.name, created.brand), created);
        imported.customFoods += 1;
      }

      // 2. Recipes
      const recipeMap = new Map<string, string>();
      const existingRecipes =
        mode === 'merge' ? await tx.recipe.findMany({ where: { userId } }) : [];
      const existingRecipeByName = new Map(
        existingRecipes.map((r) => [normalizeKey(r.name), r]),
      );

      for (const recipe of data.recipes) {
        const resolvedItems = recipe.items.map((item, idx) => ({
          foodId: resolveFoodLink(
            item.foodRefId,
            item.foodCoreKey,
            customFoodMap,
            coreFoodMap,
            true,
          )!,
          grams: item.grams,
          sortOrder: item.sortOrder ?? idx,
        }));

        const matched = existingRecipeByName.get(normalizeKey(recipe.name));
        if (matched) {
          recipeMap.set(recipe.refId, matched.id);
          if (preferBackup) {
            await tx.recipe.update({
              where: { id: matched.id },
              data: {
                name: recipe.name,
                description: recipe.description,
                servingsCount: recipe.servingsCount,
                cookedWeightG: recipe.cookedWeightG,
                items: {
                  deleteMany: {},
                  create: resolvedItems,
                },
              },
            });
            updated.recipes += 1;
          } else {
            skipped.recipes += 1;
          }
          continue;
        }

        const created = await tx.recipe.create({
          data: {
            userId,
            name: recipe.name,
            description: recipe.description,
            servingsCount: recipe.servingsCount,
            cookedWeightG: recipe.cookedWeightG,
            items: { create: resolvedItems },
          },
        });
        recipeMap.set(recipe.refId, created.id);
        existingRecipeByName.set(normalizeKey(created.name), created);
        imported.recipes += 1;
      }

      // 3. Custom Exercises
      const customExerciseMap = new Map<string, string>();
      const existingExercises =
        mode === 'merge'
          ? await tx.exercise.findMany({ where: { userId, isCore: false } })
          : [];
      const existingExerciseByKey = new Map(
        existingExercises.map((e) => [normalizeKey(e.name, e.muscleGroup), e]),
      );

      for (const ex of data.customExercises) {
        const key = normalizeKey(ex.name, ex.muscleGroup);
        const matched = existingExerciseByKey.get(key);
        const fields = {
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment,
          isBodyweight: ex.isBodyweight,
          notes: ex.notes,
        };

        if (matched) {
          customExerciseMap.set(ex.refId, matched.id);
          if (preferBackup) {
            await tx.exercise.update({ where: { id: matched.id }, data: fields });
            updated.customExercises += 1;
          } else {
            skipped.customExercises += 1;
          }
          continue;
        }

        const created = await tx.exercise.create({
          data: { userId, isCore: false, coreKey: null, ...fields },
        });
        customExerciseMap.set(ex.refId, created.id);
        existingExerciseByKey.set(key, created);
        imported.customExercises += 1;
      }

      // 4. Workout Templates
      const templateMap = new Map<string, string>();
      const existingTemplates =
        mode === 'merge' ? await tx.workoutTemplate.findMany({ where: { userId } }) : [];
      const existingTemplateByName = new Map(
        existingTemplates.map((t) => [normalizeKey(t.name), t]),
      );

      for (const tpl of data.workoutTemplates) {
        const resolvedExercises = tpl.exercises.map((item, idx) => ({
          exerciseId: resolveExerciseLink(
            item.exerciseRefId,
            item.exerciseCoreKey,
            customExerciseMap,
            coreExerciseMap,
          ),
          exerciseName: item.exerciseName,
          muscleGroup: item.muscleGroup,
          defaultSets: item.defaultSets,
          defaultReps: item.defaultReps,
          defaultWeightKg: item.defaultWeightKg,
          sortOrder: item.sortOrder ?? idx,
        }));

        const matched = existingTemplateByName.get(normalizeKey(tpl.name));
        if (matched) {
          templateMap.set(tpl.refId, matched.id);
          if (preferBackup) {
            await tx.workoutTemplate.update({
              where: { id: matched.id },
              data: {
                name: tpl.name,
                description: tpl.description,
                exercises: {
                  deleteMany: {},
                  create: resolvedExercises,
                },
              },
            });
            updated.workoutTemplates += 1;
          } else {
            skipped.workoutTemplates += 1;
          }
          continue;
        }

        const created = await tx.workoutTemplate.create({
          data: {
            userId,
            name: tpl.name,
            description: tpl.description,
            exercises: { create: resolvedExercises },
          },
        });
        templateMap.set(tpl.refId, created.id);
        existingTemplateByName.set(normalizeKey(created.name), created);
        imported.workoutTemplates += 1;
      }

      // 5. Weights (unique per userId + date)
      const existingWeightDates =
        mode === 'merge'
          ? new Set(
              (
                await tx.weightEntry.findMany({ where: { userId }, select: { date: true } })
              ).map((w) => w.date),
            )
          : new Set<string>();

      for (const weight of data.weights) {
        if (existingWeightDates.has(weight.date)) {
          if (preferBackup) {
            await tx.weightEntry.update({
              where: { userId_date: { userId, date: weight.date } },
              data: { weightKg: weight.weightKg, note: weight.note },
            });
            updated.weights += 1;
          } else {
            skipped.weights += 1;
          }
          continue;
        }
        await tx.weightEntry.create({
          data: { userId, date: weight.date, weightKg: weight.weightKg, note: weight.note },
        });
        imported.weights += 1;
      }

      // 6. Steps (unique per userId + date)
      const existingStepDates =
        mode === 'merge'
          ? new Set(
              (
                await tx.stepEntry.findMany({ where: { userId }, select: { date: true } })
              ).map((s) => s.date),
            )
          : new Set<string>();

      for (const step of data.steps) {
        if (existingStepDates.has(step.date)) {
          if (preferBackup) {
            await tx.stepEntry.update({
              where: { userId_date: { userId, date: step.date } },
              data: { steps: step.steps, note: step.note },
            });
            updated.steps += 1;
          } else {
            skipped.steps += 1;
          }
          continue;
        }
        await tx.stepEntry.create({
          data: { userId, date: step.date, steps: step.steps, note: step.note },
        });
        imported.steps += 1;
      }

      // 7. Legacy Calories
      const existingCalorieSigs =
        mode === 'merge'
          ? buildMultiset(
              (await tx.calorieEntry.findMany({ where: { userId } })).map((c) =>
                normalizeKey(c.date, c.mealName, String(c.calories)),
              ),
            )
          : new Map<string, number>();

      for (const cal of data.calories) {
        const sig = normalizeKey(cal.date, cal.mealName, String(cal.calories));
        if (consumeMultiset(existingCalorieSigs, sig)) {
          skipped.calories += 1;
          continue;
        }
        await tx.calorieEntry.create({
          data: { userId, date: cal.date, mealName: cal.mealName, calories: cal.calories },
        });
        imported.calories += 1;
      }

      // 8. Nutrition Logs
      const existingNutritionSigs =
        mode === 'merge'
          ? buildMultiset(
              (await tx.nutritionLog.findMany({ where: { userId } })).map(nutritionLogSignature),
            )
          : new Map<string, number>();

      for (const log of data.nutritionLogs) {
        const foodId = resolveFoodLink(
          log.foodRefId,
          log.foodCoreKey,
          customFoodMap,
          coreFoodMap,
          false,
        );
        let recipeId: string | null = null;
        if (log.recipeRefId) {
          recipeId = recipeMap.get(log.recipeRefId) ?? null;
          if (!recipeId) {
            throw new AppError(400, `Yedekteki tarif referansı bulunamadı: ${log.recipeRefId}`);
          }
        }

        const sig = nutritionLogSignature(log);
        if (consumeMultiset(existingNutritionSigs, sig)) {
          skipped.nutritionLogs += 1;
          continue;
        }

        await tx.nutritionLog.create({
          data: {
            userId,
            date: log.date,
            mealLabel: log.mealLabel,
            sourceType: log.sourceType,
            foodId,
            recipeId,
            entryName: log.entryName,
            quantityMode: log.quantityMode,
            servings: log.servings,
            grams: log.grams,
            calories: log.calories,
            proteinG: log.proteinG,
            carbsG: log.carbsG,
            fatG: log.fatG,
            micronutrients: serializeMicronutrients(log.micronutrients),
          },
        });
        imported.nutritionLogs += 1;
      }

      // 9. Workouts
      const existingWorkoutSigs =
        mode === 'merge'
          ? buildMultiset(
              (
                await tx.workoutEntry.findMany({
                  where: { userId },
                  include: {
                    exercises: {
                      orderBy: { sortOrder: 'asc' },
                      include: { sets: { orderBy: { setNumber: 'asc' } } },
                    },
                  },
                })
              ).map(workoutSignature),
            )
          : new Map<string, number>();

      for (const workout of data.workouts) {
        let templateId: string | null = null;
        if (workout.templateRefId) {
          templateId = templateMap.get(workout.templateRefId) ?? null;
          if (!templateId) {
            throw new AppError(
              400,
              `Yedekteki program şablonu referansı bulunamadı: ${workout.templateRefId}`,
            );
          }
        }

        const resolvedExercises = workout.exercises.map((ex, idx) => ({
          exerciseId: resolveExerciseLink(
            ex.exerciseRefId,
            ex.exerciseCoreKey,
            customExerciseMap,
            coreExerciseMap,
          ),
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          sortOrder: ex.sortOrder ?? idx,
          note: ex.note,
          sets: {
            create: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weightKg: s.weightKg,
            })),
          },
        }));

        const sig = workoutSignature(workout);
        if (consumeMultiset(existingWorkoutSigs, sig)) {
          skipped.workouts += 1;
          continue;
        }

        await tx.workoutEntry.create({
          data: {
            userId,
            templateId,
            date: workout.date,
            name: workout.name,
            durationMinutes: workout.durationMinutes,
            note: workout.note,
            exercises: { create: resolvedExercises },
          },
        });
        imported.workouts += 1;
      }

      // 10. Cardio
      const existingCardioSigs =
        mode === 'merge'
          ? buildMultiset(
              (await tx.cardioEntry.findMany({ where: { userId } })).map((c) =>
                normalizeKey(
                  c.date,
                  c.cardioType,
                  String(c.durationMinutes),
                  String(c.distanceKm ?? ''),
                  String(c.caloriesBurned ?? ''),
                  c.note,
                ),
              ),
            )
          : new Map<string, number>();

      for (const item of data.cardio) {
        const sig = normalizeKey(
          item.date,
          item.cardioType,
          String(item.durationMinutes),
          String(item.distanceKm ?? ''),
          String(item.caloriesBurned ?? ''),
          item.note,
        );
        if (consumeMultiset(existingCardioSigs, sig)) {
          skipped.cardio += 1;
          continue;
        }
        await tx.cardioEntry.create({
          data: {
            userId,
            date: item.date,
            cardioType: item.cardioType,
            durationMinutes: item.durationMinutes,
            distanceKm: item.distanceKm,
            caloriesBurned: item.caloriesBurned,
            note: item.note,
          },
        });
        imported.cardio += 1;
      }

      return {
        mode,
        conflictStrategy,
        profileUpdated,
        summary: { imported, updated, skipped },
        totals: {
          imported: sumCounts(imported),
          updated: sumCounts(updated),
          skipped: sumCounts(skipped),
        },
      };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
