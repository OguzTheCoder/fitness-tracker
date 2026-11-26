import { z } from 'zod';
import { isoDateSchema } from '../../utils/dateRange.js';
import { BARCODE_CODE_REGEX, micronutrientsRecordSchema } from '../foods/foods.schema.js';
import { VALID_MICRONUTRIENT_KEYS } from '../profile/profile.constants.js';
import {
  BACKUP_APP_NAME,
  BACKUP_IMPORT_ARRAY_LIMITS,
  BACKUP_SCHEMA_VERSION,
  CSV_DATASETS,
} from './backup.constants.js';

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .default(null);

const optionalRefId = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .nullable()
  .optional()
  .default(null);

const requiredRefId = z
  .string()
  .trim()
  .min(1, 'Kayıt referans kimliği boş olamaz.')
  .max(80, 'Kayıt referans kimliği çok uzun.');

const optionalBarcode = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || BARCODE_CODE_REGEX.test(v), {
    message: 'Geçersiz barkod biçimi.',
  })
  .nullable()
  .optional()
  .default(null);

export const exportQuerySchema = z
  .object({
    format: z.enum(['json', 'csv']).default('json'),
    dataset: z.enum(CSV_DATASETS).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.format === 'csv' && !data.dataset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataset'],
        message: 'CSV dışa aktarma için geçerli bir veri seti seçiniz.',
      });
    }
  });

const backupProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    dailyCalorieGoal: z.number().int().min(500).max(15000),
    proteinGoalG: z.number().int().min(0).max(1000),
    carbsGoalG: z.number().int().min(0).max(2000),
    fatGoalG: z.number().int().min(0).max(500),
    dailyStepGoal: z.number().int().min(0).max(100000),
    visibleMicronutrients: z
      .array(
        z.string().refine((key) => VALID_MICRONUTRIENT_KEYS.has(key), {
          message: 'Geçersiz mikro besin anahtarı.',
        }),
      )
      .max(VALID_MICRONUTRIENT_KEYS.size)
      .transform((keys) => Array.from(new Set(keys))),
  })
  .strict();

const backupWeightSchema = z
  .object({
    date: isoDateSchema,
    weightKg: z
      .number()
      .min(20)
      .max(350)
      .transform((v) => Math.round(v * 10) / 10),
    note: optionalTrimmed(300, 'Not'),
  })
  .strict();

const backupCalorieSchema = z
  .object({
    date: isoDateSchema,
    mealName: z.string().trim().min(1).max(120),
    calories: z.number().int().min(1).max(10000),
  })
  .strict();

const backupCustomFoodSchema = z
  .object({
    refId: requiredRefId,
    barcode: optionalBarcode,
    name: z.string().trim().min(1).max(120),
    brand: optionalTrimmed(80, 'Marka'),
    category: optionalTrimmed(40, 'Kategori'),
    servingLabel: optionalTrimmed(40, 'Porsiyon etiketi'),
    servingGrams: z.number().positive().max(5000).nullable().optional().default(null),
    caloriesPer100g: z.number().min(0).max(1000),
    proteinPer100g: z.number().min(0).max(100),
    carbsPer100g: z.number().min(0).max(100),
    fatPer100g: z.number().min(0).max(100),
    micronutrientsPer100g: micronutrientsRecordSchema,
  })
  .strict();

const backupRecipeItemSchema = z
  .object({
    foodRefId: optionalRefId,
    foodCoreKey: optionalRefId,
    grams: z.number().positive().max(20000),
    sortOrder: z.number().int().min(0).max(200).optional().default(0),
  })
  .strict()
  .refine((item) => Boolean(item.foodRefId || item.foodCoreKey), {
    message: 'Her tarif malzemesi bir besin referansı içermelidir.',
  });

const backupRecipeSchema = z
  .object({
    refId: requiredRefId,
    name: z.string().trim().min(1).max(120),
    description: optionalTrimmed(300, 'Açıklama'),
    servingsCount: z.number().positive().max(100).default(1),
    cookedWeightG: z.number().positive().max(50000).nullable().optional().default(null),
    items: z.array(backupRecipeItemSchema).min(1).max(50),
  })
  .strict();

const backupNutritionLogSchema = z
  .object({
    date: isoDateSchema,
    mealLabel: optionalTrimmed(40, 'Öğün etiketi'),
    sourceType: z.enum(['food', 'recipe', 'recipe_item']),
    foodRefId: optionalRefId,
    foodCoreKey: optionalRefId,
    recipeRefId: optionalRefId,
    entryName: z.string().trim().min(1).max(260),
    quantityMode: z.enum(['grams', 'servings']),
    servings: z.number().positive().max(1000).nullable().optional().default(null),
    grams: z.number().positive().max(50000),
    calories: z.number().min(0).max(50000),
    proteinG: z.number().min(0).max(5000),
    carbsG: z.number().min(0).max(5000),
    fatG: z.number().min(0).max(5000),
    micronutrients: micronutrientsRecordSchema,
  })
  .strict();

const backupCustomExerciseSchema = z
  .object({
    refId: requiredRefId,
    name: z.string().trim().min(1).max(100),
    muscleGroup: z.string().trim().min(1).max(50),
    equipment: optionalTrimmed(50, 'Ekipman'),
    isBodyweight: z.boolean().optional().default(false),
    notes: optionalTrimmed(300, 'Not'),
  })
  .strict();

const backupTemplateExerciseSchema = z
  .object({
    exerciseRefId: optionalRefId,
    exerciseCoreKey: optionalRefId,
    exerciseName: z.string().trim().min(1).max(100),
    muscleGroup: optionalTrimmed(50, 'Kas bölgesi'),
    defaultSets: z.number().int().min(1).max(20).default(3),
    defaultReps: z.number().int().min(1).max(1000).default(10),
    defaultWeightKg: z.number().min(0).max(1000).nullable().optional().default(null),
    sortOrder: z.number().int().min(0).max(200).optional().default(0),
  })
  .strict();

const backupWorkoutTemplateSchema = z
  .object({
    refId: requiredRefId,
    name: z.string().trim().min(1).max(120),
    description: optionalTrimmed(300, 'Açıklama'),
    exercises: z.array(backupTemplateExerciseSchema).min(1).max(40),
  })
  .strict();

const backupWorkoutSetSchema = z
  .object({
    setNumber: z.number().int().min(1).max(50),
    reps: z.number().int().min(1).max(1000),
    weightKg: z.number().min(0).max(1000).nullable().optional().default(null),
  })
  .strict();

const backupWorkoutExerciseSchema = z
  .object({
    exerciseRefId: optionalRefId,
    exerciseCoreKey: optionalRefId,
    exerciseName: z.string().trim().min(1).max(100),
    muscleGroup: optionalTrimmed(50, 'Kas bölgesi'),
    sortOrder: z.number().int().min(0).max(200).optional().default(0),
    note: optionalTrimmed(200, 'Hareket notu'),
    sets: z.array(backupWorkoutSetSchema).min(1).max(20),
  })
  .strict();

const backupWorkoutSchema = z
  .object({
    date: isoDateSchema,
    name: z.string().trim().min(1).max(120),
    durationMinutes: z.number().int().min(1).max(1440),
    note: optionalTrimmed(300, 'Not'),
    templateRefId: optionalRefId,
    exercises: z.array(backupWorkoutExerciseSchema).max(40).optional().default([]),
  })
  .strict();

const backupCardioSchema = z
  .object({
    date: isoDateSchema,
    cardioType: z.string().trim().min(1).max(60),
    durationMinutes: z.number().int().min(1).max(1440),
    distanceKm: z.number().min(0).max(500).nullable().optional().default(null),
    caloriesBurned: z.number().int().min(0).max(10000).nullable().optional().default(null),
    note: optionalTrimmed(300, 'Not'),
  })
  .strict();

const backupStepSchema = z
  .object({
    date: isoDateSchema,
    steps: z.number().int().min(0).max(200000),
    note: optionalTrimmed(200, 'Not'),
  })
  .strict();

function assertUniqueKeys(
  items: readonly string[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
) {
  const seen = new Set<string>();
  for (const key of items) {
    if (seen.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      return;
    }
    seen.add(key);
  }
}

export const backupPayloadSchema = z
  .object({
    schemaVersion: z.literal(BACKUP_SCHEMA_VERSION, {
      errorMap: () => ({
        message: `Desteklenmeyen yedek şema sürümü. Beklenen sürüm: ${BACKUP_SCHEMA_VERSION}.`,
      }),
    }),
    app: z.literal(BACKUP_APP_NAME).optional(),
    appVersion: z.string().trim().max(32).optional(),
    exportedAt: z.string().trim().max(64).optional(),
    data: z
      .object({
        profile: backupProfileSchema.optional(),
        weights: z.array(backupWeightSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.weights).default([]),
        calories: z.array(backupCalorieSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.calories).default([]),
        customFoods: z
          .array(backupCustomFoodSchema)
          .max(BACKUP_IMPORT_ARRAY_LIMITS.customFoods)
          .default([]),
        recipes: z.array(backupRecipeSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.recipes).default([]),
        nutritionLogs: z
          .array(backupNutritionLogSchema)
          .max(BACKUP_IMPORT_ARRAY_LIMITS.nutritionLogs)
          .default([]),
        customExercises: z
          .array(backupCustomExerciseSchema)
          .max(BACKUP_IMPORT_ARRAY_LIMITS.customExercises)
          .default([]),
        workoutTemplates: z
          .array(backupWorkoutTemplateSchema)
          .max(BACKUP_IMPORT_ARRAY_LIMITS.workoutTemplates)
          .default([]),
        workouts: z.array(backupWorkoutSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.workouts).default([]),
        cardio: z.array(backupCardioSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.cardio).default([]),
        steps: z.array(backupStepSchema).max(BACKUP_IMPORT_ARRAY_LIMITS.steps).default([]),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const { data } = payload;
    assertUniqueKeys(
      data.weights.map((w) => w.date),
      ctx,
      ['data', 'weights'],
      'Yedek dosyasında aynı tarihe ait birden fazla kilo kaydı bulunuyor.',
    );
    assertUniqueKeys(
      data.steps.map((s) => s.date),
      ctx,
      ['data', 'steps'],
      'Yedek dosyasında aynı tarihe ait birden fazla adım kaydı bulunuyor.',
    );
    assertUniqueKeys(
      data.customFoods.map((f) => f.refId),
      ctx,
      ['data', 'customFoods'],
      'Yedek dosyasında yinelenen özel besin referansı bulunuyor.',
    );
    assertUniqueKeys(
      data.customFoods.flatMap((f) => (f.barcode ? [f.barcode] : [])),
      ctx,
      ['data', 'customFoods'],
      'Yedek dosyasında aynı barkoda sahip birden fazla özel besin bulunuyor.',
    );
    assertUniqueKeys(
      data.recipes.map((r) => r.refId),
      ctx,
      ['data', 'recipes'],
      'Yedek dosyasında yinelenen tarif referansı bulunuyor.',
    );
    assertUniqueKeys(
      data.customExercises.map((e) => e.refId),
      ctx,
      ['data', 'customExercises'],
      'Yedek dosyasında yinelenen özel egzersiz referansı bulunuyor.',
    );
    assertUniqueKeys(
      data.workoutTemplates.map((t) => t.refId),
      ctx,
      ['data', 'workoutTemplates'],
      'Yedek dosyasında yinelenen şablon referansı bulunuyor.',
    );
  });

export const importBackupRequestSchema = z
  .object({
    mode: z.enum(['merge', 'overwrite']),
    conflictStrategy: z.enum(['keep_existing', 'prefer_backup']).default('keep_existing'),
    backup: backupPayloadSchema,
  })
  .strict();

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type BackupPayload = z.infer<typeof backupPayloadSchema>;
export type ImportBackupInput = z.infer<typeof importBackupRequestSchema>;
