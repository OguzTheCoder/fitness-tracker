import { apiDownload, apiRequest } from './api';

export type CsvDataset = 'weights' | 'nutrition' | 'workouts' | 'cardio' | 'steps' | 'calories';
export type BackupImportMode = 'merge' | 'overwrite';
export type BackupConflictStrategy = 'keep_existing' | 'prefer_backup';

export interface CsvDatasetOption {
  value: CsvDataset;
  label: string;
}

export const CSV_DATASET_OPTIONS: readonly CsvDatasetOption[] = [
  { value: 'weights', label: 'Kilo Kayıtları' },
  { value: 'nutrition', label: 'Beslenme Kayıtları' },
  { value: 'workouts', label: 'Antrenmanlar (Set Detayları)' },
  { value: 'cardio', label: 'Kardiyo Kayıtları' },
  { value: 'steps', label: 'Günlük Adımlar' },
  { value: 'calories', label: 'Eski Kalori Kayıtları' },
] as const;

export interface BackupImportSummaryCounts {
  weights: number;
  calories: number;
  customFoods: number;
  recipes: number;
  nutritionLogs: number;
  customExercises: number;
  workoutTemplates: number;
  workouts: number;
  cardio: number;
  steps: number;
}

export interface BackupImportResult {
  mode: BackupImportMode;
  conflictStrategy: BackupConflictStrategy;
  profileUpdated: boolean;
  summary: {
    imported: BackupImportSummaryCounts;
    updated: BackupImportSummaryCounts;
    skipped: BackupImportSummaryCounts;
  };
  totals: {
    imported: number;
    updated: number;
    skipped: number;
  };
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const backupService = {
  async downloadJson(): Promise<string> {
    const { blob, filename } = await apiDownload(
      '/backup/export?format=json',
      'fitness-tracker-backup.json',
    );
    triggerFileDownload(blob, filename);
    return filename;
  },

  async downloadCsv(dataset: CsvDataset): Promise<string> {
    const { blob, filename } = await apiDownload(
      `/backup/export?format=csv&dataset=${encodeURIComponent(dataset)}`,
      `fitness-tracker-${dataset}.csv`,
    );
    triggerFileDownload(blob, filename);
    return filename;
  },

  importJson(payload: {
    mode: BackupImportMode;
    conflictStrategy: BackupConflictStrategy;
    backup: unknown;
  }): Promise<BackupImportResult> {
    return apiRequest<BackupImportResult>('/backup/import', {
      method: 'POST',
      body: payload,
    });
  },
};
