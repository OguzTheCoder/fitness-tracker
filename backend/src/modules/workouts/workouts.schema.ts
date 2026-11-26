import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

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
});

export const workoutListQuerySchema = dateRangeQuerySchema;

export type WorkoutEntryInput = z.infer<typeof workoutEntrySchema>;
