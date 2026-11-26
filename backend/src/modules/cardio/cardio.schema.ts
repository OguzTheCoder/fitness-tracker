import { z } from 'zod';
import { dateRangeQuerySchema, isoDateSchema } from '../../utils/dateRange.js';

export const CARDIO_TYPES = [
  'Yürüyüş',
  'Koşu',
  'Bisiklet',
  'Eliptik',
  'Yüzme',
  'Kürek',
  'HIIT',
  'İp Atlama',
  'Diğer',
] as const;

export const cardioEntrySchema = z.object({
  date: isoDateSchema,
  cardioType: z
    .string()
    .trim()
    .min(1, 'Kardiyo türü giriniz.')
    .max(60, 'Kardiyo türü en fazla 60 karakter olabilir.'),
  durationMinutes: z
    .number({ invalid_type_error: 'Süre sayısal bir değer olmalıdır.' })
    .int('Süre tam sayı olmalıdır.')
    .min(1, 'Süre en az 1 dakika olmalıdır.')
    .max(1440, 'Süre en fazla 1440 dakika olabilir.'),
  distanceKm: z
    .number({ invalid_type_error: 'Mesafe sayısal bir değer olmalıdır.' })
    .min(0, 'Mesafe negatif olamaz.')
    .max(500, 'Mesafe en fazla 500 km olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  caloriesBurned: z
    .number({ invalid_type_error: 'Yakılan kalori sayısal bir değer olmalıdır.' })
    .int('Yakılan kalori tam sayı olmalıdır.')
    .min(0, 'Yakılan kalori negatif olamaz.')
    .max(10000, 'Yakılan kalori en fazla 10000 kcal olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  note: z
    .string()
    .trim()
    .max(300, 'Not en fazla 300 karakter olabilir.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const cardioListQuerySchema = dateRangeQuerySchema.and(
  z.object({
    cardioType: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  }),
);

export type CardioEntryInput = z.infer<typeof cardioEntrySchema>;
export type CardioListQuery = z.infer<typeof cardioListQuerySchema>;
