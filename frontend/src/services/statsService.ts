import { apiRequest } from './api';

export type StatsDays = 7 | 30 | 90;

export interface TrendPoint {
  date: string;
  value: number;
}

export interface StatsSummaryResponse {
  period: {
    days: StatsDays;
    from: string;
    to: string;
  };
  summary: {
    latestWeightKg: number | null;
    latestWeightDate: string | null;
    weightChangeKg: number | null;
    todayCalories: number;
    averageDailyCalories: number;
    calorieDaysLogged: number;
    workoutCount: number;
    workoutDurationMinutes: number;
  };
  trends: {
    weights: TrendPoint[];
    calories: TrendPoint[];
  };
}

export const statsService = {
  getSummary: (token: string, days: StatsDays = 7) =>
    apiRequest<StatsSummaryResponse>(`/stats/summary?days=${days}`, {
      method: 'GET',
      token,
    }),
};
