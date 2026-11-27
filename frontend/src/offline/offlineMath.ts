import type { MicronutrientMap, NutrientTotals } from '../services/nutritionService';
import type { MicronutrientMeta } from '../services/profileService';

export const DEFAULT_MICRONUTRIENT_CATALOG: MicronutrientMeta[] = [
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
];

export const DEFAULT_VISIBLE_MICRONUTRIENTS = ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'];

export const DEFAULT_GOALS = {
  dailyCalorieGoal: 2000,
  proteinGoalG: 150,
  carbsGoalG: 200,
  fatGoalG: 65,
  dailyStepGoal: 8000,
};

export const DEFAULT_CARDIO_TYPES = [
  'Yürüyüş',
  'Koşu',
  'Bisiklet',
  'Yüzme',
  'Eliptik',
  'Kürek',
  'HIIT',
  'İp Atlama',
  'Diğer',
];

export const DEFAULT_MUSCLE_GROUPS = [
  'Göğüs',
  'Sırt',
  'Bacak',
  'Omuz',
  'Ön Kol',
  'Arka Kol',
  'Karın',
  'Tüm Vücut',
];

export function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

export function scaleNutrientsFrom100g(
  per100g: {
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    micronutrientsPer100g: MicronutrientMap;
  },
  grams: number,
): NutrientTotals {
  const factor = grams / 100;
  const micronutrients: MicronutrientMap = {};
  for (const [k, v] of Object.entries(per100g.micronutrientsPer100g ?? {})) {
    if (Number.isFinite(v) && v > 0) {
      micronutrients[k] = round2(v * factor);
    }
  }
  return {
    calories: round1(per100g.caloriesPer100g * factor),
    proteinG: round1(per100g.proteinPer100g * factor),
    carbsG: round1(per100g.carbsPer100g * factor),
    fatG: round1(per100g.fatPer100g * factor),
    micronutrients,
  };
}

export function scaleNutrientTotals(totals: NutrientTotals, factor: number): NutrientTotals {
  const micronutrients: MicronutrientMap = {};
  for (const [k, v] of Object.entries(totals.micronutrients ?? {})) {
    if (Number.isFinite(v) && v > 0) {
      micronutrients[k] = round2(v * factor);
    }
  }
  return {
    calories: round1(totals.calories * factor),
    proteinG: round1(totals.proteinG * factor),
    carbsG: round1(totals.carbsG * factor),
    fatG: round1(totals.fatG * factor),
    micronutrients,
  };
}

export function sumNutrientTotals(items: NutrientTotals[]): NutrientTotals {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  const micros: MicronutrientMap = {};

  for (const item of items) {
    calories += item.calories;
    proteinG += item.proteinG;
    carbsG += item.carbsG;
    fatG += item.fatG;
    for (const [k, v] of Object.entries(item.micronutrients ?? {})) {
      if (Number.isFinite(v)) {
        micros[k] = round2((micros[k] ?? 0) + v);
      }
    }
  }

  return {
    calories: round1(calories),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    micronutrients: micros,
  };
}

export function getRollingRange(days: number): { from: string; to: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}
