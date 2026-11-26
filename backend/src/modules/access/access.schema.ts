import { z } from 'zod';

export const setupAccessSchema = z.object({
  name: z
    .string({ required_error: 'Adınız zorunludur.' })
    .trim()
    .min(2, 'Adınız en az 2 karakter olmalıdır.')
    .max(80, 'Adınız en fazla 80 karakter olabilir.'),
  pin: z
    .string()
    .trim()
    .min(1, 'PIN zorunludur.')
    .max(64, 'PIN en fazla 64 karakter olabilir.')
    .optional(),
});

export const unlockAccessSchema = z.object({
  pin: z
    .string({ required_error: 'PIN zorunludur.' })
    .trim()
    .min(1, 'PIN zorunludur.')
    .max(64, 'PIN en fazla 64 karakter olabilir.'),
});

export type SetupAccessInput = z.infer<typeof setupAccessSchema>;
export type UnlockAccessInput = z.infer<typeof unlockAccessSchema>;
