import { z } from 'zod';

export const ALLOWED_STATS_DAYS = [7, 30, 90] as const;
export type StatsDays = (typeof ALLOWED_STATS_DAYS)[number];

export const statsSummaryQuerySchema = z.object({
  days: z
    .enum(['7', '30', '90'], {
      errorMap: () => ({ message: 'Dönem yalnızca 7, 30 veya 90 gün olabilir.' }),
    })
    .default('7')
    .transform((v) => Number(v) as StatsDays),
});

export type StatsSummaryQuery = z.infer<typeof statsSummaryQuerySchema>;
