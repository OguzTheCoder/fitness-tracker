import { z } from 'zod';

const emailField = z
  .string({ required_error: 'E-posta zorunludur.' })
  .trim()
  .toLowerCase()
  .email('Geçerli bir e-posta adresi giriniz.');

const strongPasswordField = z
  .string({ required_error: 'Şifre zorunludur.' })
  .min(8, 'Şifre en az 8 karakter olmalıdır.')
  .max(72, 'Şifre en fazla 72 karakter olabilir.');

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Ad soyad zorunludur.' })
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalıdır.')
    .max(80, 'Ad soyad en fazla 80 karakter olabilir.'),
  email: emailField,
  password: strongPasswordField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ required_error: 'Şifre zorunludur.' })
    .min(1, 'Şifre zorunludur.')
    .max(72, 'Şifre en fazla 72 karakter olabilir.'),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Sıfırlama kodu zorunludur.' })
    .trim()
    .min(1, 'Sıfırlama kodu zorunludur.'),
  password: strongPasswordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
