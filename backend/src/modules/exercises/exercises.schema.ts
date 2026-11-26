import { z } from 'zod';
import { DEFAULT_LIST_LIMIT } from '../../utils/dateRange.js';

export const EXERCISE_MAX_LIMIT = 200;

export const exerciseListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, 'Arama metni en fazla 80 karakter olabilir.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  muscleGroup: z
    .string()
    .trim()
    .max(50, 'Kas bölgesi en fazla 50 karakter olabilir.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  scope: z.enum(['all', 'core', 'custom']).default('all'),
  limit: z.coerce
    .number({ invalid_type_error: 'Kayıt sınırı sayısal olmalıdır.' })
    .int('Kayıt sınırı tam sayı olmalıdır.')
    .min(1, 'Kayıt sınırı en az 1 olmalıdır.')
    .max(EXERCISE_MAX_LIMIT, `Kayıt sınırı en fazla ${EXERCISE_MAX_LIMIT} olabilir.`)
    .default(DEFAULT_LIST_LIMIT),
  offset: z.coerce
    .number({ invalid_type_error: 'Başlangıç kaydı sayısal olmalıdır.' })
    .int('Başlangıç kaydı tam sayı olmalıdır.')
    .min(0, 'Başlangıç kaydı negatif olamaz.')
    .default(0),
});

export const exerciseBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Egzersiz adı giriniz.')
    .max(100, 'Egzersiz adı en fazla 100 karakter olabilir.'),
  muscleGroup: z
    .string()
    .trim()
    .min(1, 'Kas bölgesi seçiniz.')
    .max(50, 'Kas bölgesi en fazla 50 karakter olabilir.'),
  equipment: z
    .string()
    .trim()
    .max(50, 'Ekipman adı en fazla 50 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  isBodyweight: z.boolean().optional().default(false),
  notes: z
    .string()
    .trim()
    .max(300, 'Not en fazla 300 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>;
export type ExerciseBodyInput = z.infer<typeof exerciseBodySchema>;
