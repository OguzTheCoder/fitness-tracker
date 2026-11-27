import { localStore, offlineFirstRead } from '../offline/localStore';
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
    cardioCount?: number;
    cardioDurationMinutes?: number;
    cardioDistanceKm?: number;
    cardioCaloriesBurned?: number;
    todaySteps?: number;
    dailyStepGoal?: number;
    averageDailySteps?: number;
    stepDaysLogged?: number;
  };
  trends: {
    weights: TrendPoint[];
    calories: TrendPoint[];
    steps?: TrendPoint[];
  };
}

export const statsService = {
  getSummary: (days: StatsDays = 7) =>
    offlineFirstRead(
      () =>
        apiRequest<StatsSummaryResponse>(`/stats/summary?days=${days}`, {
          method: 'GET',
        }),
      () => {},
      (data) => localStore.stats.getSummary(data, days),
    ),
};
