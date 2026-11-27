import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/session.utils.js';
import {
  OpenFoodFactsProvider,
  setBarcodeProvider,
  type BarcodeLookupProvider,
  type BarcodeProductData,
} from '../src/modules/foods/barcode.provider.js';

const app = createApp({ appPin: null });

function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const match = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) {
    throw new Error('Session cookie missing');
  }
  return match.split(';')[0];
}

async function registerAndGetCookie(
  targetApp: ReturnType<typeof createApp>,
  email: string,
  name: string,
): Promise<string> {
  const res = await request(targetApp).post('/api/auth/register').send({
    name,
    email,
    password: 'StrongPassword123!',
  });
  expect(res.status).toBe(201);
  return extractCookieHeader(res.headers['set-cookie']);
}

describe('Barcode / QR Lookup & Open Food Facts Caching (AUTH-11 / v1.2.0)', () => {
  beforeEach(async () => {
    setBarcodeProvider(null);
    await prisma.nutritionLog.deleteMany();
    await prisma.recipeItem.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.food.deleteMany({ where: { isCore: false } });
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    setBarcodeProvider(null);
    await prisma.$disconnect();
  });

  it('rejects unauthenticated barcode lookups with 401 and invalid/injection codes with 400', async () => {
    const lookupSpy = vi.fn<BarcodeLookupProvider['lookup']>().mockResolvedValue(null);
    setBarcodeProvider({ lookup: lookupSpy });

    const unauthRes = await request(app).get('/api/foods/barcode/8690526012345');
    expect(unauthRes.status).toBe(401);

    const cookie = await registerAndGetCookie(app, 'validate@example.com', 'Doğrulama');

    const invalidCodes = ['123', 'abc..def', '869%20123', 'http%3A%2F%2Fevil.test', 'kod$1234'];
    for (const bad of invalidCodes) {
      const res = await request(app)
        .get(`/api/foods/barcode/${bad}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
    }

    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it('queries Open Food Facts once, caches product in user DB, and serves subsequent lookups locally', async () => {
    const sampleProduct: BarcodeProductData = {
      barcode: '8690526012345',
      name: 'Yulaf Ezmesi',
      brand: 'Eti',
      category: 'Tahıl',
      servingLabel: '40 g (4 yemek kaşığı)',
      servingGrams: 40,
      caloriesPer100g: 370,
      proteinPer100g: 12.5,
      carbsPer100g: 61.2,
      fatPer100g: 7.1,
      micronutrientsPer100g: { Mg: 138, Fe: 4.2, K: 362 },
    };

    const lookupSpy = vi
      .fn<BarcodeLookupProvider['lookup']>()
      .mockResolvedValue(sampleProduct);
    setBarcodeProvider({ lookup: lookupSpy });

    const cookie = await registerAndGetCookie(app, 'cache@example.com', 'Önbellek');

    // First lookup hits external provider and caches in DB
    const firstRes = await request(app)
      .get('/api/foods/barcode/8690526012345')
      .set('Cookie', cookie);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.found).toBe(true);
    expect(firstRes.body.source).toBe('open_food_facts');
    expect(firstRes.body.food.barcode).toBe('8690526012345');
    expect(firstRes.body.food.name).toBe('Yulaf Ezmesi');
    expect(firstRes.body.food.caloriesPer100g).toBe(370);
    expect(firstRes.body.food.micronutrientsPer100g).toEqual({ Mg: 138, Fe: 4.2, K: 362 });
    expect(lookupSpy).toHaveBeenCalledTimes(1);

    // Second lookup comes straight from local DB without calling external provider
    const secondRes = await request(app)
      .get('/api/foods/barcode/8690526012345')
      .set('Cookie', cookie);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.found).toBe(true);
    expect(secondRes.body.source).toBe('local');
    expect(secondRes.body.food.id).toBe(firstRes.body.food.id);
    expect(lookupSpy).toHaveBeenCalledTimes(1);

    // Searchable in /api/foods by barcode
    const searchRes = await request(app)
      .get('/api/foods?q=8690526012345')
      .set('Cookie', cookie);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.foods).toHaveLength(1);
    expect(searchRes.body.foods[0].id).toBe(firstRes.body.food.id);
  });

  it('allows defining unknown barcodes/custom QR codes as user foods while enforcing per-user isolation and uniqueness', async () => {
    const lookupSpy = vi.fn<BarcodeLookupProvider['lookup']>().mockResolvedValue(null);
    setBarcodeProvider({ lookup: lookupSpy });

    const cookieA = await registerAndGetCookie(app, 'usera@example.com', 'Kullanıcı A');
    const cookieB = await registerAndGetCookie(app, 'userb@example.com', 'Kullanıcı B');

    // Non-numeric QR code does not even query external Open Food Facts
    const qrMissRes = await request(app)
      .get('/api/foods/barcode/EV-PROTEIN-01')
      .set('Cookie', cookieA);
    expect(qrMissRes.status).toBe(200);
    expect(qrMissRes.body).toEqual({
      found: false,
      source: 'not_found',
      barcode: 'EV-PROTEIN-01',
      food: null,
    });
    expect(lookupSpy).not.toHaveBeenCalled();

    // User A creates a custom food with that QR code
    const createARes = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        barcode: 'EV-PROTEIN-01',
        name: 'Ev Yapımı Protein Bar',
        brand: 'Ev',
        servingLabel: '1 bar',
        servingGrams: 55,
        caloriesPer100g: 390,
        proteinPer100g: 28,
        carbsPer100g: 36,
        fatPer100g: 14,
        micronutrientsPer100g: { Mg: 80 },
      });
    expect(createARes.status).toBe(201);
    expect(createARes.body.food.barcode).toBe('EV-PROTEIN-01');

    // Same user cannot assign duplicate barcode to another food -> 409
    const duplicateRes = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        barcode: 'EV-PROTEIN-01',
        name: 'Başka Bar',
        caloriesPer100g: 200,
        proteinPer100g: 10,
        carbsPer100g: 20,
        fatPer100g: 5,
      });
    expect(duplicateRes.status).toBe(409);

    // User A lookup finds their custom food locally
    const hitARes = await request(app)
      .get('/api/foods/barcode/EV-PROTEIN-01')
      .set('Cookie', cookieA);
    expect(hitARes.status).toBe(200);
    expect(hitARes.body.found).toBe(true);
    expect(hitARes.body.source).toBe('local');
    expect(hitARes.body.food.name).toBe('Ev Yapımı Protein Bar');

    // User B does NOT see User A's food (user isolation) and can define the same code independently
    const missBRes = await request(app)
      .get('/api/foods/barcode/EV-PROTEIN-01')
      .set('Cookie', cookieB);
    expect(missBRes.status).toBe(200);
    expect(missBRes.body.found).toBe(false);

    const createBRes = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieB)
      .send({
        barcode: 'EV-PROTEIN-01',
        name: 'B Kullanıcısının Karışımı',
        caloriesPer100g: 250,
        proteinPer100g: 20,
        carbsPer100g: 25,
        fatPer100g: 8,
      });
    expect(createBRes.status).toBe(201);

    // User A can update barcode via PUT /api/foods/:id
    const updateARes = await request(app)
      .put(`/api/foods/${createARes.body.food.id}`)
      .set('Cookie', cookieA)
      .send({
        barcode: 'EV-PROTEIN-02',
        name: 'Ev Yapımı Protein Bar v2',
        caloriesPer100g: 395,
        proteinPer100g: 30,
        carbsPer100g: 35,
        fatPer100g: 14,
      });
    expect(updateARes.status).toBe(200);
    expect(updateARes.body.food.barcode).toBe('EV-PROTEIN-02');
  });

  it('handles Open Food Facts network errors gracefully and allows manual creation fallback', async () => {
    setBarcodeProvider({
      lookup: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    });

    const cookie = await registerAndGetCookie(app, 'offline@example.com', 'Offline');
    const res = await request(app)
      .get('/api/foods/barcode/8690504099999')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.source).toBe('not_found');
    expect(res.body.externalError).toContain('Open Food Facts');
  });

  it('enforces dedicated rate limiting on GET /api/foods/barcode/:code with 429', async () => {
    const strictApp = createApp({
      appPin: null,
      rateLimit: {
        windowMs: 60_000,
        barcodeMax: 2,
        apiMax: 100,
      },
    });
    setBarcodeProvider({ lookup: vi.fn().mockResolvedValue(null) });

    const cookie = await registerAndGetCookie(strictApp, 'rate@example.com', 'Hız Sınırı');

    const r1 = await request(strictApp)
      .get('/api/foods/barcode/EV-LIMIT-01')
      .set('Cookie', cookie);
    const r2 = await request(strictApp)
      .get('/api/foods/barcode/EV-LIMIT-02')
      .set('Cookie', cookie);
    const r3 = await request(strictApp)
      .get('/api/foods/barcode/EV-LIMIT-03')
      .set('Cookie', cookie);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers['ratelimit']).toBeDefined();
  });

  it('OpenFoodFactsProvider uses strict HTTPS URL, redirect: error, and converts macro/micronutrient units accurately', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name_tr: 'Süzme Yoğurt',
            brands: 'Sütaş, Sütaş A.Ş.',
            categories: 'Süt Ürünleri, Yoğurt',
            serving_size: '150 g (1 kase)',
            serving_quantity: 150,
            nutriments: {
              'energy-kj_100g': 418.4,
              proteins_100g: 9.5,
              carbohydrates_100g: 4.2,
              fat_100g: 5.0,
              salt_100g: 0.2,
              calcium_100g: 0.14,
              'vitamin-d_100g': 0.0000015,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = new OpenFoodFactsProvider(fetchMock, 3000);
    const product = await provider.lookup('8690565000123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8690565000123\.json\?fields=/,
    );
    expect(init?.redirect).toBe('error');

    expect(product).toEqual({
      barcode: '8690565000123',
      name: 'Süzme Yoğurt',
      brand: 'Sütaş',
      category: 'Süt Ürünleri',
      servingLabel: '150 g (1 kase)',
      servingGrams: 150,
      caloriesPer100g: 100,
      proteinPer100g: 9.5,
      carbsPer100g: 4.2,
      fatPer100g: 5,
      micronutrientsPer100g: {
        Ca: 140,
        Na: 78.68,
        VitD: 1.5,
      },
    });
  });
});
