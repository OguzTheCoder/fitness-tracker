import { z } from 'zod';
import { isValidIsoDate } from '../../utils/dateRange.js';
import { CARDIO_TYPES } from '../cardio/cardio.schema.js';
import { MUSCLE_GROUPS } from '../exercises/coreExercises.data.js';
import { VALID_MICRONUTRIENT_KEYS } from '../profile/profile.constants.js';
import { SYNC_MAX_MUTATIONS } from './sync.constants.js';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD biçiminde olmalıdır')
  .refine(isValidIsoDate, 'Geçerli bir takvim tarihi giriniz');

const recordIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{4,64}$/, 'Geçersiz kayıt kimliği');

const clientTimestampSchema = z.string().datetime({ message: 'Geçerli ISO tarih/saat gerekir' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const micronutrientsSchema = z
  .record(z.string().max(40), z.coerce.number().min(0).max(100000))
  .optional()
  .default({})
  .transform((map) => {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      if (VALID_MICRONUTRIENT_KEYS.has(k) && Number.isFinite(v) && v >= 0) {
        clean[k] = Math.round(v * 100) / 100;
      }
    }
    return clean;
  });

const barcodeSchema = z
  .string()
  .trim()
  .max(64)
  .nullable()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const cleaned = v.replace(/\s+/g, '');
    return cleaned.length > 0 ? cleaned : null;
  })
  .refine((v) => v === null || (v.length >= 3 && /^[A-Za-z0-9._:/-]+$/.test(v)), {
    message: 'Geçersiz barkod / QR kodu',
  });

export const syncProfileDataSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  dailyCalorieGoal: z.coerce.number().int().min(500).max(15000),
  proteinGoalG: z.coerce.number().int().min(0).max(1000),
  carbsGoalG: z.coerce.number().int().min(0).max(2000),
  fatGoalG: z.coerce.number().int().min(0).max(500),
  dailyStepGoal: z.coerce.number().int().min(500).max(100000),
  visibleMicronutrients: z
    .array(z.string().refine((k) => VALID_MICRONUTRIENT_KEYS.has(k)))
    .max(VALID_MICRONUTRIENT_KEYS.size)
    .transform((arr) => Array.from(new Set(arr))),
});

export const syncWeightDataSchema = z.object({
  date: isoDateSchema,
  weightKg: z.coerce.number().min(20).max(400),
  note: optionalText(250),
});

export const syncCalorieDataSchema = z.object({
  date: isoDateSchema,
  mealName: z.string().trim().min(1).max(120),
  calories: z.coerce.number().int().min(1).max(20000),
});

export const syncFoodDataSchema = z.object({
  barcode: barcodeSchema,
  name: z.string().trim().min(1).max(120),
  brand: optionalText(80),
  category: optionalText(60),
  servingLabel: optionalText(40),
  servingGrams: z.coerce.number().positive().max(5000).nullable().optional().default(null),
  caloriesPer100g: z.coerce.number().min(0).max(1000),
  proteinPer100g: z.coerce.number().min(0).max(100),
  carbsPer100g: z.coerce.number().min(0).max(100),
  fatPer100g: z.coerce.number().min(0).max(100),
  micronutrientsPer100g: micronutrientsSchema,
});

export const syncRecipeDataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(300),
  servingsCount: z.coerce.number().positive().max(100),
  cookedWeightG: z.coerce.number().positive().max(50000).nullable().optional().default(null),
  items: z
    .array(
      z.object({
        foodId: recordIdSchema,
        grams: z.coerce.number().positive().max(20000),
        sortOrder: z.coerce.number().int().min(0).max(100).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const syncNutritionLogDataSchema = z.object({
  date: isoDateSchema,
  mealLabel: optionalText(40),
  sourceType: z.enum(['food', 'recipe', 'recipe_item']),
  foodId: recordIdSchema.nullable().optional().default(null),
  recipeId: recordIdSchema.nullable().optional().default(null),
  entryName: z.string().trim().min(1).max(160),
  quantityMode: z.enum(['grams', 'servings']),
  servings: z.coerce.number().positive().max(100).nullable().optional().default(null),
  grams: z.coerce.number().positive().max(20000),
  calories: z.coerce.number().min(0).max(50000),
  proteinG: z.coerce.number().min(0).max(5000),
  carbsG: z.coerce.number().min(0).max(5000),
  fatG: z.coerce.number().min(0).max(5000),
  micronutrients: micronutrientsSchema,
});

export const syncExerciseDataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: optionalText(60),
  isBodyweight: z.boolean().optional().default(false),
  notes: optionalText(300),
});

export const syncWorkoutTemplateDataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(300),
  exercises: z
    .array(
      z.object({
        exerciseId: recordIdSchema.nullable().optional().default(null),
        exerciseName: z.string().trim().min(1).max(120),
        muscleGroup: optionalText(40),
        defaultSets: z.coerce.number().int().min(1).max(20).default(3),
        defaultReps: z.coerce.number().int().min(1).max(200).default(10),
        defaultWeightKg: z.coerce.number().min(0).max(1000).nullable().optional().default(null),
        sortOrder: z.coerce.number().int().min(0).max(50).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const syncWorkoutDataSchema = z.object({
  templateId: recordIdSchema.nullable().optional().default(null),
  date: isoDateSchema,
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  note: optionalText(500),
  exercises: z
    .array(
      z.object({
        exerciseId: recordIdSchema.nullable().optional().default(null),
        exerciseName: z.string().trim().min(1).max(120),
        muscleGroup: optionalText(40),
        sortOrder: z.coerce.number().int().min(0).max(50).optional(),
        note: optionalText(250),
        sets: z
          .array(
            z.object({
              setNumber: z.coerce.number().int().min(1).max(50),
              reps: z.coerce.number().int().min(1).max(500),
              weightKg: z.coerce.number().min(0).max(1000).nullable().optional().default(null),
            }),
          )
          .min(1)
          .max(30),
      }),
    )
    .max(30)
    .default([]),
});

export const syncCardioDataSchema = z.object({
  date: isoDateSchema,
  cardioType: z.enum(CARDIO_TYPES),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  distanceKm: z.coerce.number().min(0).max(500).nullable().optional().default(null),
  caloriesBurned: z.coerce.number().int().min(0).max(20000).nullable().optional().default(null),
  note: optionalText(300),
});

export const syncStepDataSchema = z.object({
  date: isoDateSchema,
  steps: z.coerce.number().int().min(0).max(200000),
  note: optionalText(250),
});

const baseMutation = {
  clientMutationId: z.string().trim().min(1).max(120),
  clientUpdatedAt: clientTimestampSchema,
};

const upsertMutationSchemas = [
  z.object({
    ...baseMutation,
    entity: z.literal('profile'),
    operation: z.literal('upsert'),
    recordId: z.string().trim().min(1).max(64).default('profile'),
    data: syncProfileDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('weight'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncWeightDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('calorie'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncCalorieDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('food'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncFoodDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('recipe'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncRecipeDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('nutritionLog'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncNutritionLogDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('exercise'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncExerciseDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('workoutTemplate'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncWorkoutTemplateDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('workout'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncWorkoutDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('cardio'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncCardioDataSchema,
  }),
  z.object({
    ...baseMutation,
    entity: z.literal('step'),
    operation: z.literal('upsert'),
    recordId: recordIdSchema,
    data: syncStepDataSchema,
  }),
] as const;

const deleteMutationSchema = z.object({
  ...baseMutation,
  entity: z.enum([
    'weight',
    'calorie',
    'food',
    'recipe',
    'nutritionLog',
    'exercise',
    'workoutTemplate',
    'workout',
    'cardio',
    'step',
  ]),
  operation: z.literal('delete'),
  recordId: recordIdSchema,
});

export const syncMutationSchema = z.union([...upsertMutationSchemas, deleteMutationSchema]);

export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPullQuerySchema = z.object({
  since: clientTimestampSchema.optional(),
  includeCore: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;

export const syncPushBodySchema = z.object({
  since: clientTimestampSchema.optional(),
  mutations: z.array(syncMutationSchema).max(SYNC_MAX_MUTATIONS),
});

export type SyncPushBody = z.infer<typeof syncPushBodySchema>;
