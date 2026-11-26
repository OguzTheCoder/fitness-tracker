import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

export const weightEntrySchema = z.object({
  date: isoDateSchema,
  weightKg: z
    .number({ invalid_type_error: 'Kilo sayısal bir değer olmalıdır.' })
    .min(20, 'Kilo en az 20 kg olmalıdır.')
    .max(350, 'Kilo en fazla 350 kg olmalıdır.')
    .transform((v) => Math.round(v * 10) / 10),
  note: z
    .string()
    .trim()
    .max(300, 'Not en fazla 300 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const weightListQuerySchema = dateRangeQuerySchema;

export type WeightEntryInput = z.infer<typeof weightEntrySchema>;
