import { normalizeMicronutrients, round1, type MicronutrientMap } from '../nutrition/nutrition.math.js';
import { MICRONUTRIENT_CATALOG } from '../profile/profile.constants.js';
import { isStandardBarcode } from './foods.schema.js';

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'product_name_tr',
  'brands',
  'categories',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',');

const DEFAULT_TIMEOUT_MS = 5000;

export interface BarcodeProductData {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  servingLabel: string | null;
  servingGrams: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  micronutrientsPer100g: MicronutrientMap;
}

export interface BarcodeLookupProvider {
  lookup(barcode: string): Promise<BarcodeProductData | null>;
}

interface OpenFoodFactsNutriments {
  [key: string]: unknown;
}

interface OpenFoodFactsProduct {
  product_name?: unknown;
  product_name_tr?: unknown;
  brands?: unknown;
  categories?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  nutriments?: OpenFoodFactsNutriments;
}

interface OpenFoodFactsResponse {
  status?: unknown;
  product?: OpenFoodFactsProduct;
}

/**
 * Open Food Facts `*_100g` mikro besin anahtarları her zaman gram (g) cinsindedir.
 * Katalog birimine (`mg` -> *1000, `µg` -> *1_000_000) dönüştürülür.
 */
const OFF_MICRONUTRIENT_KEYS: ReadonlyArray<{ key: string; offKey: string }> = [
  { key: 'Na', offKey: 'sodium_100g' },
  { key: 'K', offKey: 'potassium_100g' },
  { key: 'Mg', offKey: 'magnesium_100g' },
  { key: 'Ca', offKey: 'calcium_100g' },
  { key: 'Fe', offKey: 'iron_100g' },
  { key: 'Zn', offKey: 'zinc_100g' },
  { key: 'P', offKey: 'phosphorus_100g' },
  { key: 'Se', offKey: 'selenium_100g' },
  { key: 'Cu', offKey: 'copper_100g' },
  { key: 'I', offKey: 'iodine_100g' },
  { key: 'VitA', offKey: 'vitamin-a_100g' },
  { key: 'VitC', offKey: 'vitamin-c_100g' },
  { key: 'VitD', offKey: 'vitamin-d_100g' },
  { key: 'VitE', offKey: 'vitamin-e_100g' },
  { key: 'VitK', offKey: 'vitamin-k_100g' },
  { key: 'VitB1', offKey: 'vitamin-b1_100g' },
  { key: 'VitB2', offKey: 'vitamin-b2_100g' },
  { key: 'VitB3', offKey: 'vitamin-pp_100g' },
  { key: 'VitB6', offKey: 'vitamin-b6_100g' },
  { key: 'VitB9', offKey: 'vitamin-b9_100g' },
  { key: 'VitB12', offKey: 'vitamin-b12_100g' },
];

const MICRO_UNIT_BY_KEY = new Map(MICRONUTRIENT_CATALOG.map((item) => [item.key, item.unit]));

function toCleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampMetric(value: number | null, max: number): number | null {
  if (value === null || value < 0 || value > max) return null;
  return round1(value);
}

function extractMicronutrients(nutriments: OpenFoodFactsNutriments): MicronutrientMap {
  const raw: Record<string, number> = {};

  for (const { key, offKey } of OFF_MICRONUTRIENT_KEYS) {
    const gramsValue = toFiniteNumber(nutriments[offKey]);
    if (gramsValue === null || gramsValue <= 0) continue;
    const unit = MICRO_UNIT_BY_KEY.get(key);
    const converted = unit === 'µg' ? gramsValue * 1_000_000 : gramsValue * 1000;
    if (converted > 0 && converted <= 100_000) {
      raw[key] = converted;
    }
  }

  // Sodyum yoksa tuz (g) değerinden türet (1 g tuz ≈ 393.4 mg Na)
  if (raw.Na === undefined) {
    const saltG = toFiniteNumber(nutriments['salt_100g']);
    if (saltG !== null && saltG > 0) {
      const sodiumMg = saltG * 393.4;
      if (sodiumMg <= 100_000) raw.Na = sodiumMg;
    }
  }

  return normalizeMicronutrients(raw);
}

export function mapOpenFoodFactsProduct(
  barcode: string,
  payload: OpenFoodFactsResponse,
): BarcodeProductData | null {
  if (payload.status !== 1 || !payload.product || typeof payload.product !== 'object') {
    return null;
  }

  const product = payload.product;
  const name =
    toCleanText(product.product_name_tr, 120) ?? toCleanText(product.product_name, 120);
  if (!name) return null;

  const nutriments =
    product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};

  const directKcal = toFiniteNumber(nutriments['energy-kcal_100g']);
  const kj = toFiniteNumber(nutriments['energy-kj_100g']);
  const calories = clampMetric(directKcal ?? (kj !== null ? kj / 4.184 : null), 1000);
  const protein = clampMetric(toFiniteNumber(nutriments['proteins_100g']), 100);
  const carbs = clampMetric(toFiniteNumber(nutriments['carbohydrates_100g']), 100);
  const fat = clampMetric(toFiniteNumber(nutriments['fat_100g']), 100);

  if (calories === null && protein === null && carbs === null && fat === null) {
    return null;
  }

  const rawBrand = toCleanText(product.brands, 80);
  const brand = rawBrand ? rawBrand.split(',')[0].trim().slice(0, 80) || null : null;

  const rawCategory = toCleanText(product.categories, 120);
  const category = rawCategory ? rawCategory.split(',')[0].trim().slice(0, 40) || null : null;

  const parsedServingGrams = toFiniteNumber(product.serving_quantity);
  const servingGrams =
    parsedServingGrams !== null && parsedServingGrams > 0 && parsedServingGrams <= 5000
      ? round1(parsedServingGrams)
      : null;
  const servingLabel =
    toCleanText(product.serving_size, 40) ?? (servingGrams ? '1 porsiyon' : null);

  return {
    barcode,
    name,
    brand,
    category,
    servingLabel,
    servingGrams,
    caloriesPer100g: calories ?? 0,
    proteinPer100g: protein ?? 0,
    carbsPer100g: carbs ?? 0,
    fatPer100g: fat ?? 0,
    micronutrientsPer100g: extractMicronutrients(nutriments),
  };
}

export class OpenFoodFactsProvider implements BarcodeLookupProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async lookup(barcode: string): Promise<BarcodeProductData | null> {
    if (!isStandardBarcode(barcode)) {
      return null;
    }

    const url = `${OPEN_FOOD_FACTS_BASE_URL}${encodeURIComponent(barcode)}.json?fields=${OPEN_FOOD_FACTS_FIELDS}`;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FitnessTracker/1.2.0 (OpenFoodFacts lookup)',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Open Food Facts HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenFoodFactsResponse;
    return mapOpenFoodFactsProduct(barcode, data);
  }
}

let activeBarcodeProvider: BarcodeLookupProvider | null = null;

export function getBarcodeProvider(): BarcodeLookupProvider {
  if (!activeBarcodeProvider) {
    activeBarcodeProvider = new OpenFoodFactsProvider();
  }
  return activeBarcodeProvider;
}

export function setBarcodeProvider(provider: BarcodeLookupProvider | null): void {
  activeBarcodeProvider = provider;
}
