import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

export const stepEntrySchema = z.object({
  date: isoDateSchema,
  steps: z
    .number({ invalid_type_error: 'Adım sayısı sayısal bir değer olmalıdır.' })
    .int('Adım sayısı tam sayı olmalıdır.')
    .min(0, 'Adım sayısı negatif olamaz.')
    .max(200000, 'Adım sayısı en fazla 200.000 olabilir.'),
  note: z
    .string()
    .trim()
    .max(200, 'Not en fazla 200 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const stepListQuerySchema = dateRangeQuerySchema;

export type StepEntryInput = z.infer<typeof stepEntrySchema>;
