import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Ad soyad zorunludur.' })
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.')
    .max(80, 'Ad soyad en fazla 80 karakter olabilir.'),
  email: z
    .string({ required_error: 'E-posta zorunludur.' })
    .trim()
    .toLowerCase()
    .email('Geçerli bir e-posta adresi giriniz.'),
  password: z
    .string({ required_error: 'Şifre zorunludur.' })
    .min(8, 'Şifre en az 8 karakter olmalıdır.')
    .max(72, 'Şifre en fazla 72 karakter olabilir.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
