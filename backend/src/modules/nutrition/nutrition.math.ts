import { VALID_MICRONUTRIENT_KEYS } from '../profile/profile.constants.js';

export type MicronutrientMap = Record<string, number>;

export interface NutrientTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micronutrients: MicronutrientMap;
}

export interface Per100gNutrients {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  micronutrientsPer100g: MicronutrientMap;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeMicronutrients(input?: Record<string, number> | null): MicronutrientMap {
  if (!input || typeof input !== 'object') return {};
  const result: MicronutrientMap = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!VALID_MICRONUTRIENT_KEYS.has(key)) continue;
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue < 0) continue;
    if (rawValue > 0) {
      result[key] = round2(rawValue);
    }
  }
  return result;
}

export function parseMicronutrients(raw: string | null | undefined): MicronutrientMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return normalizeMicronutrients(parsed as Record<string, number>);
  } catch {
    return {};
  }
}

export function serializeMicronutrients(map?: Record<string, number> | null): string {
  return JSON.stringify(normalizeMicronutrients(map));
}

export function scaleNutrientsFrom100g(food: Per100gNutrients, grams: number): NutrientTotals {
  const factor = grams / 100;
  const micronutrients: MicronutrientMap = {};
  for (const [key, value] of Object.entries(food.micronutrientsPer100g)) {
    const scaled = round2(value * factor);
    if (scaled > 0) micronutrients[key] = scaled;
  }

  return {
    calories: round1(food.caloriesPer100g * factor),
    proteinG: round1(food.proteinPer100g * factor),
    carbsG: round1(food.carbsPer100g * factor),
    fatG: round1(food.fatPer100g * factor),
    micronutrients,
  };
}

export function scaleNutrientTotals(totals: NutrientTotals, factor: number): NutrientTotals {
  const micronutrients: MicronutrientMap = {};
  for (const [key, value] of Object.entries(totals.micronutrients)) {
    const scaled = round2(value * factor);
    if (scaled > 0) micronutrients[key] = scaled;
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
    for (const [key, value] of Object.entries(item.micronutrients)) {
      micros[key] = (micros[key] ?? 0) + value;
    }
  }

  for (const key of Object.keys(micros)) {
    micros[key] = round2(micros[key]);
  }

  return {
    calories: round1(calories),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    micronutrients: micros,
  };
}
