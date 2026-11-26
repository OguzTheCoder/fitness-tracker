import { z } from 'zod';
import {
  DEFAULT_LIST_LIMIT,
  isoDateSchema,
  MAX_LIST_LIMIT,
} from '../../utils/dateRange.js';

const optionalMealLabelSchema = z
  .string()
  .trim()
  .max(40, 'Öğün etiketi en fazla 40 karakter olabilir.')
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

export const nutritionLogListQuerySchema = z
  .object({
    date: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    limit: z.coerce
      .number({ invalid_type_error: 'Kayıt sınırı sayısal olmalıdır.' })
      .int('Kayıt sınırı tam sayı olmalıdır.')
      .min(1, 'Kayıt sınırı en az 1 olmalıdır.')
      .max(MAX_LIST_LIMIT, `Kayıt sınırı en fazla ${MAX_LIST_LIMIT} olabilir.`)
      .default(DEFAULT_LIST_LIMIT),
    offset: z.coerce
      .number({ invalid_type_error: 'Başlangıç kaydı sayısal olmalıdır.' })
      .int('Başlangıç kaydı tam sayı olmalıdır.')
      .min(0, 'Başlangıç kaydı negatif olamaz.')
      .default(0),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.',
    path: ['from'],
  });

const logFoodSchema = z
  .object({
    kind: z.literal('food'),
    date: isoDateSchema,
    mealLabel: optionalMealLabelSchema,
    foodId: z.string().trim().min(1, 'Besin seçiniz.'),
    quantityMode: z.enum(['grams', 'servings']).default('grams'),
    grams: z
      .number({ invalid_type_error: 'Gram miktarı sayı olmalıdır.' })
      .positive('Gram miktarı 0’dan büyük olmalıdır.')
      .max(10000, 'Gram miktarı en fazla 10000 g olabilir.')
      .optional(),
    servings: z
      .number({ invalid_type_error: 'Porsiyon miktarı sayı olmalıdır.' })
      .positive('Porsiyon miktarı 0’dan büyük olmalıdır.')
      .max(100, 'Porsiyon miktarı en fazla 100 olabilir.')
      .optional(),
  })
  .strict();

const logRecipeSchema = z
  .object({
    kind: z.literal('recipe'),
    date: isoDateSchema,
    mealLabel: optionalMealLabelSchema,
    recipeId: z.string().trim().min(1, 'Tarif seçiniz.'),
    mode: z.enum(['servings', 'grams', 'decompose']),
    servings: z
      .number({ invalid_type_error: 'Porsiyon miktarı sayı olmalıdır.' })
      .positive('Porsiyon miktarı 0’dan büyük olmalıdır.')
      .max(100, 'Porsiyon miktarı en fazla 100 olabilir.')
      .optional(),
    grams: z
      .number({ invalid_type_error: 'Gram miktarı sayı olmalıdır.' })
      .positive('Gram miktarı 0’dan büyük olmalıdır.')
      .max(20000, 'Gram miktarı en fazla 20000 g olabilir.')
      .optional(),
  })
  .strict();

export const createNutritionLogSchema = z
  .discriminatedUnion('kind', [logFoodSchema, logRecipeSchema])
  .superRefine((data, ctx) => {
    if (data.kind === 'food') {
      if (data.quantityMode === 'grams' && data.grams === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['grams'],
          message: 'Gram miktarı giriniz.',
        });
      }
      if (data.quantityMode === 'servings' && data.servings === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['servings'],
          message: 'Porsiyon miktarı giriniz.',
        });
      }
      return;
    }

    if (data.mode === 'servings' && data.servings === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['servings'],
        message: 'Porsiyon miktarı giriniz.',
      });
    }
    if (data.mode === 'grams' && data.grams === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['grams'],
        message: 'Gram miktarı giriniz.',
      });
    }
  });

export const updateNutritionLogSchema = z
  .object({
    date: isoDateSchema.optional(),
    mealLabel: optionalMealLabelSchema,
    grams: z
      .number({ invalid_type_error: 'Gram miktarı sayı olmalıdır.' })
      .positive('Gram miktarı 0’dan büyük olmalıdır.')
      .max(20000, 'Gram miktarı en fazla 20000 g olabilir.')
      .optional(),
  })
  .strict()
  .refine(
    (data) => data.date !== undefined || data.mealLabel !== undefined || data.grams !== undefined,
    { message: 'Güncellenecek en az bir alan giriniz.' },
  );

export type NutritionLogListQuery = z.infer<typeof nutritionLogListQuerySchema>;
export type CreateNutritionLogInput = z.infer<typeof createNutritionLogSchema>;
export type UpdateNutritionLogInput = z.infer<typeof updateNutritionLogSchema>;
