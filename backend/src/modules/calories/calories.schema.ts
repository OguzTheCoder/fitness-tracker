import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

export const calorieEntrySchema = z.object({
  date: isoDateSchema,
  mealName: z
    .string()
    .trim()
    .min(1, 'Öğün açıklaması giriniz.')
    .max(120, 'Öğün açıklaması en fazla 120 karakter olabilir.'),
  calories: z
    .number({ invalid_type_error: 'Kalori sayısal bir değer olmalıdır.' })
    .int('Kalori tam sayı olmalıdır.')
    .min(1, 'Kalori en az 1 kcal olmalıdır.')
    .max(10000, 'Kalori en fazla 10000 kcal olmalıdır.'),
});

export const calorieListQuerySchema = dateRangeQuerySchema;

export type CalorieEntryInput = z.infer<typeof calorieEntrySchema>;
