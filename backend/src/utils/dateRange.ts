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

export const dateRangeQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
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
