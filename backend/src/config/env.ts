import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const optionalPinSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || (value.length >= 4 && value.length <= 64), {
    message: 'APP_PIN en az 4, en fazla 64 karakter olmalıdır',
  });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL tanımlı olmalıdır'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalıdır'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  APP_PIN: optionalPinSchema,
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(15),
});

export const env = envSchema.parse(process.env);
