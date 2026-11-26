import { z } from 'zod';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, 'Geçerli bir tarih giriniz (YYYY-AA-GG).');

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 366;

export const dateRangeQuerySchema = z
  .object({
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

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export function buildDateFilter(range: DateRangeQuery): { gte?: string; lte?: string } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

export function formatIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRollingDateRange(days: number, referenceDate = new Date()): { from: string; to: string } {
  const end = new Date(
    Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    from: formatIsoDateUtc(start),
    to: formatIsoDateUtc(end),
  };
}
