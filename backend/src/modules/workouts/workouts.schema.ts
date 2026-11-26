import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

export const workoutSetInputSchema = z.object({
  reps: z
    .number({ invalid_type_error: 'Tekrar sayısı sayısal olmalıdır.' })
    .int('Tekrar sayısı tam sayı olmalıdır.')
    .min(1, 'Tekrar sayısı en az 1 olmalıdır.')
    .max(1000, 'Tekrar sayısı en fazla 1000 olabilir.'),
  weightKg: z
    .number({ invalid_type_error: 'Ağırlık sayısal bir değer olmalıdır.' })
    .min(0, 'Ağırlık negatif olamaz.')
    .max(1000, 'Ağırlık en fazla 1000 kg olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
});

export const workoutExerciseInputSchema = z
  .object({
    exerciseId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    exerciseName: z
      .string()
      .trim()
      .max(100, 'Hareket adı en fazla 100 karakter olabilir.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    muscleGroup: z
      .string()
      .trim()
      .max(50, 'Kas bölgesi en fazla 50 karakter olabilir.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    note: z
      .string()
      .trim()
      .max(200, 'Hareket notu en fazla 200 karakter olabilir.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    sets: z
      .array(workoutSetInputSchema)
      .min(1, 'Her hareket için en az 1 set giriniz.')
      .max(20, 'Bir hareket için en fazla 20 set girilebilir.'),
  })
  .refine((item) => Boolean(item.exerciseId || item.exerciseName), {
    message: 'Her hareket için egzersiz seçiniz veya hareket adı giriniz.',
    path: ['exerciseName'],
  });

export const workoutEntrySchema = z.object({
  date: isoDateSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Antrenman adı giriniz.')
    .max(120, 'Antrenman adı en fazla 120 karakter olabilir.'),
  durationMinutes: z
    .number({ invalid_type_error: 'Süre sayısal bir değer olmalıdır.' })
    .int('Süre tam sayı olmalıdır.')
    .min(1, 'Süre en az 1 dakika olmalıdır.')
    .max(1440, 'Süre en fazla 1440 dakika olabilir.'),
  note: z
    .string()
    .trim()
    .max(300, 'Not en fazla 300 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  templateId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  exercises: z
    .array(workoutExerciseInputSchema)
    .max(40, 'Bir antrenmanda en fazla 40 hareket bulunabilir.')
    .optional(),
});

export const workoutListQuerySchema = dateRangeQuerySchema;

function parseCsvParam(raw?: string): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  );
}

export const previousPerformanceQuerySchema = z
  .object({
    exerciseIds: z.string().max(1500).optional(),
    exerciseNames: z.string().max(2000).optional(),
    beforeDate: isoDateSchema.optional(),
    excludeWorkoutId: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .transform((raw) => ({
    exerciseIds: parseCsvParam(raw.exerciseIds),
    exerciseNames: parseCsvParam(raw.exerciseNames),
    beforeDate: raw.beforeDate,
    excludeWorkoutId: raw.excludeWorkoutId,
  }))
  .refine((parsed) => parsed.exerciseIds.length <= 30 && parsed.exerciseNames.length <= 30, {
    message: 'Tek sorguda en fazla 30 egzersiz istenebilir.',
  });

export type WorkoutEntryInput = z.infer<typeof workoutEntrySchema>;
export type PreviousPerformanceQuery = z.infer<typeof previousPerformanceQuerySchema>;
