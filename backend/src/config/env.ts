import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export const PRODUCTION_MIN_PIN_LENGTH = 8;

const WEAK_JWT_SECRET_PATTERNS = [
  'change-this',
  'changeme',
  'change_me',
  'replace-me',
  'replace_me',
  'your-secret',
  'your_secret',
  'example',
  'default-secret',
  'default_secret',
  'test-secret',
  'test_secret',
  'dev-secret',
  'dev_secret',
  'supersecret',
  'super-secret',
  'secret-key',
  'jwt-secret',
  'jwt_secret',
  'placeholder',
  'in-production',
  '12345678',
  'password',
  'qwerty',
] as const;

const WEAK_PIN_PATTERNS = [
  'password',
  'passcode',
  'changeme',
  'change-me',
  'change_me',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'admin123',
  '12345678',
  '87654321',
  '00000000',
  '12341234',
  '11112222',
  'fitness1',
] as const;

function isSequentialString(value: string): boolean {
  if (value.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < value.length; i += 1) {
    const diff = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (diff !== 1) ascending = false;
    if (diff !== -1) descending = false;
    if (!ascending && !descending) return false;
  }
  return true;
}

export function isWeakJwtSecret(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();
  if (WEAK_JWT_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }
  return new Set(secret).size < 10;
}

export function isWeakProductionPin(pin: string): boolean {
  const normalized = pin.trim().toLowerCase();
  if (normalized.length < PRODUCTION_MIN_PIN_LENGTH) {
    return true;
  }
  if (new Set(normalized).size <= 2) {
    return true;
  }
  if (isSequentialString(normalized)) {
    return true;
  }
  return WEAK_PIN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

const optionalPinSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || (value.length >= 4 && value.length <= 64), {
    message: 'APP_PIN en az 4, en fazla 64 karakter olmalıdır',
  });

const optionalBooleanFlagSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value.toLowerCase() : undefined))
  .refine((value) => value === undefined || value === 'true' || value === 'false', {
    message: 'ALLOW_PUBLIC_AUTH yalnızca "true" veya "false" olabilir',
  })
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL tanımlı olmalıdır'),
    DIRECT_URL: z.string().optional(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalıdır'),
    JWT_EXPIRES_IN: z.string().min(1).default('1d'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    SERVE_FRONTEND: z.enum(['true', 'false']).default('false'),
    FRONTEND_DIST_DIR: z.string().optional(),
    APP_PIN: optionalPinSchema,
    ALLOW_PUBLIC_AUTH: optionalBooleanFlagSchema,
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }

    if (isWeakJwtSecret(data.JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'NODE_ENV=production ortamında şablon veya düşük entropili JWT_SECRET kullanılamaz. Rastgele güçlü bir anahtar üretin.',
      });
    }

    if (!data.APP_PIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_PIN'],
        message:
          'NODE_ENV=production ortamında APP_PIN zorunludur; yerel moda sessiz düşüş güvenlik gereği kapalıdır.',
      });
      return;
    }

    if (data.APP_PIN.length < PRODUCTION_MIN_PIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_PIN'],
        message: `NODE_ENV=production ortamında APP_PIN en az ${PRODUCTION_MIN_PIN_LENGTH} karakter olmalıdır.`,
      });
      return;
    }

    if (isWeakProductionPin(data.APP_PIN)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_PIN'],
        message:
          'NODE_ENV=production ortamında tekrarlı, ardışık veya bilinen zayıf APP_PIN değerleri kullanılamaz.',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(rawEnv);
}

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0 && origin !== '*');
}

export const env = parseEnv(process.env);
