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

  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
    res.status(409).json({ error: 'Bu kayıt zaten mevcut.' });
    return;
  }

  console.error('[Error]', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
};
