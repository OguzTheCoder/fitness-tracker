import { z } from 'zod';
import { VALID_MICRONUTRIENT_KEYS } from '../profile/profile.constants.js';

export const BARCODE_CODE_REGEX = /^[A-Za-z0-9_-]{4,64}$/;
export const STANDARD_BARCODE_REGEX = /^\d{8,14}$/;

export function isStandardBarcode(code: string): boolean {
  return STANDARD_BARCODE_REGEX.test(code);
}

export const barcodeCodeSchema = z
  .string()
  .trim()
  .min(4, 'Barkod / QR kodu en az 4 karakter olmalıdır.')
  .max(64, 'Barkod / QR kodu en fazla 64 karakter olabilir.')
  .regex(
    BARCODE_CODE_REGEX,
    'Barkod / QR kodu yalnızca harf, rakam, tire (-) ve alt çizgi (_) içerebilir.',
  );

const optionalBarcodeSchema = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .refine((val) => val === null || BARCODE_CODE_REGEX.test(val), {
    message:
      'Barkod / QR kodu 4–64 karakter olmalı ve yalnızca harf, rakam, tire (-) veya alt çizgi (_) içermelidir.',
  })
  .nullable()
  .optional();

const optionalTrimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional();

export const micronutrientsRecordSchema = z
  .record(
    z.string(),
    z
      .number({ invalid_type_error: 'Mikro besin değeri sayı olmalıdır.' })
      .min(0, 'Mikro besin değeri negatif olamaz.')
      .max(100000, 'Mikro besin değeri çok yüksek.'),
  )
  .refine(
    (record) => Object.keys(record).every((key) => VALID_MICRONUTRIENT_KEYS.has(key)),
    'Geçersiz mikro besin anahtarı içeriyor.',
  )
  .refine(
    (record) => Object.keys(record).length <= VALID_MICRONUTRIENT_KEYS.size,
    'Çok fazla mikro besin alanı gönderildi.',
  )
  .optional()
  .default({});

export const foodBodySchema = z
  .object({
    barcode: optionalBarcodeSchema,
    name: z
      .string()
      .trim()
      .min(1, 'Besin adı giriniz.')
      .max(120, 'Besin adı en fazla 120 karakter olabilir.'),
    brand: optionalTrimmedString(80, 'Marka'),
    category: optionalTrimmedString(40, 'Kategori'),
    servingLabel: optionalTrimmedString(40, 'Porsiyon etiketi'),
    servingGrams: z
      .number({ invalid_type_error: 'Porsiyon ağırlığı sayı olmalıdır.' })
      .positive('Porsiyon ağırlığı 0’dan büyük olmalıdır.')
      .max(5000, 'Porsiyon ağırlığı en fazla 5000 g olabilir.')
      .nullable()
      .optional(),
    caloriesPer100g: z
      .number({ invalid_type_error: 'Kalori sayı olmalıdır.' })
      .min(0, 'Kalori negatif olamaz.')
      .max(1000, '100 g kalori en fazla 1000 kcal olabilir.'),
    proteinPer100g: z
      .number({ invalid_type_error: 'Protein sayı olmalıdır.' })
      .min(0, 'Protein negatif olamaz.')
      .max(100, '100 g protein en fazla 100 g olabilir.'),
    carbsPer100g: z
      .number({ invalid_type_error: 'Karbonhidrat sayı olmalıdır.' })
      .min(0, 'Karbonhidrat negatif olamaz.')
      .max(100, '100 g karbonhidrat en fazla 100 g olabilir.'),
    fatPer100g: z
      .number({ invalid_type_error: 'Yağ sayı olmalıdır.' })
      .min(0, 'Yağ negatif olamaz.')
      .max(100, '100 g yağ en fazla 100 g olabilir.'),
    micronutrientsPer100g: micronutrientsRecordSchema,
  })
  .strict();

export const foodListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, 'Arama metni en fazla 80 karakter olabilir.')
    .optional(),
  scope: z.enum(['all', 'core', 'custom']).default('all'),
  category: z.string().trim().max(40).optional(),
  limit: z.coerce
    .number({ invalid_type_error: 'Kayıt sınırı sayısal olmalıdır.' })
    .int('Kayıt sınırı tam sayı olmalıdır.')
    .min(1, 'Kayıt sınırı en az 1 olmalıdır.')
    .max(100, 'Kayıt sınırı en fazla 100 olabilir.')
    .default(50),
  offset: z.coerce
    .number({ invalid_type_error: 'Başlangıç kaydı sayısal olmalıdır.' })
    .int('Başlangıç kaydı tam sayı olmalıdır.')
    .min(0, 'Başlangıç kaydı negatif olamaz.')
    .default(0),
});

export type FoodBodyInput = z.infer<typeof foodBodySchema>;
export type FoodListQuery = z.infer<typeof foodListQuerySchema>;
