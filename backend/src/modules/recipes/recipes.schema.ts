import { z } from 'zod';

const recipeItemInputSchema = z
  .object({
    foodId: z.string().trim().min(1, 'Malzeme besini seçiniz.'),
    grams: z
      .number({ invalid_type_error: 'Gram miktarı sayı olmalıdır.' })
      .positive('Gram miktarı 0’dan büyük olmalıdır.')
      .max(20000, 'Gram miktarı en fazla 20000 g olabilir.'),
  })
  .strict();

export const recipeBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tarif adı giriniz.')
      .max(120, 'Tarif adı en fazla 120 karakter olabilir.'),
    description: z
      .string()
      .trim()
      .max(300, 'Açıklama en fazla 300 karakter olabilir.')
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .optional(),
    servingsCount: z
      .number({ invalid_type_error: 'Porsiyon sayısı sayı olmalıdır.' })
      .positive('Porsiyon sayısı 0’dan büyük olmalıdır.')
      .max(100, 'Porsiyon sayısı en fazla 100 olabilir.')
      .default(1),
    cookedWeightG: z
      .number({ invalid_type_error: 'Toplam ağırlık sayı olmalıdır.' })
      .positive('Toplam ağırlık 0’dan büyük olmalıdır.')
      .max(50000, 'Toplam ağırlık en fazla 50000 g olabilir.')
      .nullable()
      .optional(),
    items: z
      .array(recipeItemInputSchema)
      .min(1, 'Tarifte en az 1 malzeme olmalıdır.')
      .max(50, 'Tarifte en fazla 50 malzeme olabilir.'),
  })
  .strict();

export const recipeListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80, 'Arama metni en fazla 80 karakter olabilir.')
    .optional(),
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

export type RecipeBodyInput = z.infer<typeof recipeBodySchema>;
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;
