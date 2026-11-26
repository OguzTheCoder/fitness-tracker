import { z } from 'zod';
import { VALID_MICRONUTRIENT_KEYS } from './profile.constants.js';

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Ad soyad en az 2 karakter olmalıdır.')
      .max(80, 'Ad soyad en fazla 80 karakter olabilir.')
      .optional(),
    dailyCalorieGoal: z
      .number({ invalid_type_error: 'Günlük kalori hedefi sayı olmalıdır.' })
      .int('Günlük kalori hedefi tam sayı olmalıdır.')
      .min(500, 'Günlük kalori hedefi en az 500 kcal olmalıdır.')
      .max(15000, 'Günlük kalori hedefi en fazla 15000 kcal olabilir.')
      .optional(),
    proteinGoalG: z
      .number({ invalid_type_error: 'Protein hedefi sayı olmalıdır.' })
      .int('Protein hedefi tam sayı olmalıdır.')
      .min(0, 'Protein hedefi negatif olamaz.')
      .max(1000, 'Protein hedefi en fazla 1000 g olabilir.')
      .optional(),
    carbsGoalG: z
      .number({ invalid_type_error: 'Karbonhidrat hedefi sayı olmalıdır.' })
      .int('Karbonhidrat hedefi tam sayı olmalıdır.')
      .min(0, 'Karbonhidrat hedefi negatif olamaz.')
      .max(2000, 'Karbonhidrat hedefi en fazla 2000 g olabilir.')
      .optional(),
    fatGoalG: z
      .number({ invalid_type_error: 'Yağ hedefi sayı olmalıdır.' })
      .int('Yağ hedefi tam sayı olmalıdır.')
      .min(0, 'Yağ hedefi negatif olamaz.')
      .max(500, 'Yağ hedefi en fazla 500 g olabilir.')
      .optional(),
    dailyStepGoal: z
      .number({ invalid_type_error: 'Günlük adım hedefi sayı olmalıdır.' })
      .int('Günlük adım hedefi tam sayı olmalıdır.')
      .min(0, 'Günlük adım hedefi negatif olamaz.')
      .max(100000, 'Günlük adım hedefi en fazla 100000 olabilir.')
      .optional(),
    visibleMicronutrients: z
      .array(
        z.string().refine((key) => VALID_MICRONUTRIENT_KEYS.has(key), {
          message: 'Geçersiz mikro besin anahtarı.',
        }),
      )
      .max(VALID_MICRONUTRIENT_KEYS.size, 'Çok fazla mikro besin seçildi.')
      .transform((keys) => Array.from(new Set(keys)))
      .optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
