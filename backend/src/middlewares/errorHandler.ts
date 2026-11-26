import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'İstenen uç nokta bulunamadı.' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Geçersiz istek verisi.',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.too.large') {
      const limitBytes =
        'limit' in err && typeof err.limit === 'number' && Number.isFinite(err.limit)
          ? err.limit
          : 16 * 1024;
      const limitLabel =
        limitBytes >= 1024 * 1024
          ? `${Math.round((limitBytes / (1024 * 1024)) * 10) / 10} MB`
          : `${Math.round(limitBytes / 1024)} KB`;
      res.status(413).json({
        error: `İstek gövdesi izin verilen sınırı (${limitLabel}) aşıyor.`,
      });
      return;
    }
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Geçersiz JSON biçimi.' });
      return;
    }
  }

  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
    res.status(409).json({ error: 'Bu kayıt zaten mevcut.' });
    return;
  }

  console.error('[Error]', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
};
