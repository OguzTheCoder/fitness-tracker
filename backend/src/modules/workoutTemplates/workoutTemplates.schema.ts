import { z } from 'zod';

export const TEMPLATE_MAX_LIMIT = 100;

export const workoutTemplateListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, 'Arama metni en fazla 80 karakter olabilir.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  limit: z.coerce
    .number({ invalid_type_error: 'Kayıt sınırı sayısal olmalıdır.' })
    .int('Kayıt sınırı tam sayı olmalıdır.')
    .min(1, 'Kayıt sınırı en az 1 olmalıdır.')
    .max(TEMPLATE_MAX_LIMIT, `Kayıt sınırı en fazla ${TEMPLATE_MAX_LIMIT} olabilir.`)
    .default(50),
  offset: z.coerce
    .number({ invalid_type_error: 'Başlangıç kaydı sayısal olmalıdır.' })
    .int('Başlangıç kaydı tam sayı olmalıdır.')
    .min(0, 'Başlangıç kaydı negatif olamaz.')
    .default(0),
});

export const templateExerciseItemSchema = z
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
    defaultSets: z
      .number({ invalid_type_error: 'Varsayılan set sayısı sayısal olmalıdır.' })
      .int('Varsayılan set sayısı tam sayı olmalıdır.')
      .min(1, 'Set sayısı en az 1 olmalıdır.')
      .max(20, 'Set sayısı en fazla 20 olabilir.')
      .default(3),
    defaultReps: z
      .number({ invalid_type_error: 'Varsayılan tekrar sayısı sayısal olmalıdır.' })
      .int('Varsayılan tekrar sayısı tam sayı olmalıdır.')
      .min(1, 'Tekrar sayısı en az 1 olmalıdır.')
      .max(1000, 'Tekrar sayısı en fazla 1000 olabilir.')
      .default(10),
    defaultWeightKg: z
      .number({ invalid_type_error: 'Ağırlık sayısal bir değer olmalıdır.' })
      .min(0, 'Ağırlık negatif olamaz.')
      .max(1000, 'Ağırlık en fazla 1000 kg olabilir.')
      .optional()
      .nullable()
      .transform((v) => (v === undefined ? null : v)),
  })
  .refine((item) => Boolean(item.exerciseId || item.exerciseName), {
    message: 'Her hareket için katalogdan seçim yapın veya hareket adı girin.',
    path: ['exerciseName'],
  });

export const workoutTemplateBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Şablon adı giriniz.')
    .max(120, 'Şablon adı en fazla 120 karakter olabilir.'),
  description: z
    .string()
    .trim()
    .max(300, 'Açıklama en fazla 300 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  exercises: z
    .array(templateExerciseItemSchema)
    .min(1, 'Şablona en az bir hareket ekleyiniz.')
    .max(40, 'Şablonda en fazla 40 hareket bulunabilir.'),
});

export type WorkoutTemplateListQuery = z.infer<typeof workoutTemplateListQuerySchema>;
export type WorkoutTemplateBodyInput = z.infer<typeof workoutTemplateBodySchema>;
