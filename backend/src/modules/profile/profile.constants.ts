export type MicronutrientCategory = 'mineral' | 'vitamin';

export interface MicronutrientMeta {
  key: string;
  label: string;
  unit: 'mg' | 'µg';
  category: MicronutrientCategory;
}

export const MICRONUTRIENT_CATALOG: readonly MicronutrientMeta[] = [
  { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral' },
  { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral' },
  { key: 'Mg', label: 'Magnezyum (Mg)', unit: 'mg', category: 'mineral' },
  { key: 'Ca', label: 'Kalsiyum (Ca)', unit: 'mg', category: 'mineral' },
  { key: 'Fe', label: 'Demir (Fe)', unit: 'mg', category: 'mineral' },
  { key: 'Zn', label: 'Çinko (Zn)', unit: 'mg', category: 'mineral' },
  { key: 'P', label: 'Fosfor (P)', unit: 'mg', category: 'mineral' },
  { key: 'Se', label: 'Selenyum (Se)', unit: 'µg', category: 'mineral' },
  { key: 'Cu', label: 'Bakır (Cu)', unit: 'mg', category: 'mineral' },
  { key: 'I', label: 'İyot (I)', unit: 'µg', category: 'mineral' },
  { key: 'VitA', label: 'A Vitamini', unit: 'µg', category: 'vitamin' },
  { key: 'VitC', label: 'C Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitD', label: 'D Vitamini', unit: 'µg', category: 'vitamin' },
  { key: 'VitE', label: 'E Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitK', label: 'K Vitamini', unit: 'µg', category: 'vitamin' },
  { key: 'VitB1', label: 'B1 Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitB2', label: 'B2 Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitB3', label: 'B3 Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitB6', label: 'B6 Vitamini', unit: 'mg', category: 'vitamin' },
  { key: 'VitB9', label: 'Folat (B9)', unit: 'µg', category: 'vitamin' },
  { key: 'VitB12', label: 'B12 Vitamini', unit: 'µg', category: 'vitamin' },
] as const;

export const VALID_MICRONUTRIENT_KEYS = new Set(MICRONUTRIENT_CATALOG.map((item) => item.key));

export const DEFAULT_VISIBLE_MICRONUTRIENTS: readonly string[] = [
  'Na',
  'K',
  'Mg',
  'Ca',
  'Fe',
  'Zn',
];

export const DEFAULT_PROFILE_GOALS = {
  dailyCalorieGoal: 2000,
  proteinGoalG: 150,
  carbsGoalG: 200,
  fatGoalG: 65,
  dailyStepGoal: 8000,
} as const;

export function parseVisibleMicronutrients(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_MICRONUTRIENTS];
    const valid = parsed.filter(
      (item): item is string => typeof item === 'string' && VALID_MICRONUTRIENT_KEYS.has(item),
    );
    return Array.from(new Set(valid));
  } catch {
    return [...DEFAULT_VISIBLE_MICRONUTRIENTS];
  }
}
