import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

export interface RateLimitConfig {
  windowMs: number;
  apiMax: number;
  authIpMax: number;
  authAccountMax: number;
  barcodeMax: number;
  backupMax: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  apiMax: 300,
  authIpMax: 25,
  authAccountMax: 10,
  barcodeMax: 40,
  backupMax: 20,
};

const RATE_LIMIT_MESSAGE = {
  error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.',
};

function extractNormalizedEmail(req: Request): string | null {
  const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof rawEmail !== 'string') return null;
  const normalized = rawEmail.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= 254 ? normalized : null;
}

export function createRateLimiters(overrides?: Partial<RateLimitConfig>): {
  apiLimiter: RequestHandler;
  authWriteLimiters: RequestHandler[];
  barcodeLimiter: RequestHandler;
  backupLimiter: RequestHandler;
} {
  const config: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...overrides };

  const apiLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.apiMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });

  const authIpLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.authIpMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),
    message: RATE_LIMIT_MESSAGE,
  });

  const authAccountLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.authAccountMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => extractNormalizedEmail(req) === null,
    keyGenerator: (req) => `${req.path}:${extractNormalizedEmail(req)}`,
    message: RATE_LIMIT_MESSAGE,
  });

  const barcodeLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.barcodeMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),
    message: RATE_LIMIT_MESSAGE,
  });

  const backupLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.backupMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),
    message: RATE_LIMIT_MESSAGE,
  });

  return {
    apiLimiter,
    authWriteLimiters: [authIpLimiter, authAccountLimiter],
    barcodeLimiter,
    backupLimiter,
  };
}
