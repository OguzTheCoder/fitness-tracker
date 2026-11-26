import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

const mockUser = {
  id: 'u1',
  name: 'Oğuz Yılmaz',
  email: 'personal@local.fitness',
  createdAt: '2026-11-25T10:00:00.000Z',
};

const authStatusOk = {
  mode: 'local',
  isConfigured: true,
  isAuthenticated: true,
  user: mockUser,
};

const baseFoods = [
  {
    id: 'f-chicken',
    isCore: true,
    barcode: null,
    name: 'Tavuk Göğsü (Izgara)',
    brand: null,
    category: 'Protein',
    servingLabel: '1 porsiyon',
    servingGrams: 150,
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    micronutrientsPer100g: { Na: 74, K: 256, Mg: 29 },
    createdAt: '2026-11-26T08:00:00.000Z',
    updatedAt: '2026-11-26T08:00:00.000Z',
  },
];

const sampleProfileRes = {
  profile: {
    id: 'p1',
    userId: 'u1',
    name: 'Oğuz Yılmaz',
    email: 'personal@local.fitness',
    dailyCalorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 200,
    fatGoalG: 65,
    dailyStepGoal: 8000,
    visibleMicronutrients: ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'],
    updatedAt: '2026-11-26T08:00:00.000Z',
  },
  availableMicronutrients: [
    { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral' },
    { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral' },
    { key: 'Mg', label: 'Magnezyum (Mg)', unit: 'mg', category: 'mineral' },
  ],
};

function makeLogsResponse(logs: unknown[], calories = 0) {
  return {
    date: '2026-11-26',
    logs,
    totals: {
      calories,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      micronutrients: {},
    },
    goals: {
      dailyCalorieGoal: 2000,
      proteinGoalG: 150,
      carbsGoalG: 200,
      fatGoalG: 65,
    },
    visibleMicronutrients: [
      { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral', amount: 0 },
    ],
    dailyTotals: [],
  };
}

describe('Barcode / QR Lookup & Custom Food Flow (AUTH-11 / v1.2.0)', () => {
  it('looks up barcode from Open Food Facts, refreshes catalog, and logs found product with one click', async () => {
    const user = userEvent.setup();
    const cachedFood = {
      id: 'f-oats-barcode',
      isCore: false,
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
      micronutrientsPer100g: { Mg: 138 },
      createdAt: '2026-11-26T10:00:00.000Z',
      updatedAt: '2026-11-26T10:00:00.000Z',
    };

    const currentLogs: unknown[] = [];
    let currentCalories = 0;
    let foodListCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/access/status')) {
        return new Response(JSON.stringify(authStatusOk), { status: 200 });
      }
      if (url.includes('/foods/barcode/8690526012345')) {
        return new Response(
          JSON.stringify({
            found: true,
            source: 'open_food_facts',
            barcode: '8690526012345',
            food: cachedFood,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/foods') && method === 'GET') {
        foodListCalls += 1;
        return new Response(
          JSON.stringify({
            foods: foodListCalls > 1 ? [...baseFoods, cachedFood] : baseFoods,
            total: foodListCalls > 1 ? 2 : 1,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/recipes') && method === 'GET') {
        return new Response(JSON.stringify({ recipes: [], total: 0 }), { status: 200 });
      }
      if (url.endsWith('/profile')) {
        return new Response(JSON.stringify(sampleProfileRes), { status: 200 });
      }
      if (url.includes('/nutrition/logs') && method === 'GET') {
        return new Response(JSON.stringify(makeLogsResponse(currentLogs, currentCalories)), {
          status: 200,
        });
      }
      if (url.includes('/nutrition/logs') && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { foodId: string; grams: number };
        expect(body.foodId).toBe('f-oats-barcode');
        expect(body.grams).toBe(40);
        currentCalories = 148;
        currentLogs.push({
          id: 'log-bc-1',
          date: '2026-11-26',
          mealLabel: null,
          sourceType: 'food',
          foodId: 'f-oats-barcode',
          recipeId: null,
          entryName: 'Yulaf Ezmesi',
          quantityMode: 'grams',
          servings: null,
          grams: 40,
          calories: 148,
          proteinG: 5,
          carbsG: 24.5,
          fatG: 2.8,
          micronutrients: { Mg: 55.2 },
          createdAt: '2026-11-26T10:05:00.000Z',
          updatedAt: '2026-11-26T10:05:00.000Z',
        });
        return new Response(JSON.stringify({ log: currentLogs[0], logs: currentLogs }), {
          status: 201,
        });
      }

      return new Response(JSON.stringify({ error: 'Not mocked' }), { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const openBtn = await screen.findByRole('button', { name: 'Barkod / QR Tara' });
    await user.click(openBtn);

    const codeInput = screen.getByLabelText('Barkod veya QR kodu');
    await user.type(codeInput, '8690526012345');
    await user.click(screen.getByRole('button', { name: 'Kodu Ara' }));

    expect(await screen.findByText('Open Food Facts · Kaydedildi')).toBeInTheDocument();
    expect(screen.getByText('Yulaf Ezmesi')).toBeInTheDocument();
    expect(foodListCalls).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: /Günlük Kayda Ekle/i }));

    expect(await screen.findByText('Yulaf Ezmesi günlük kayda eklendi.')).toBeInTheDocument();
  });

  it('hands off unknown QR code to custom food form with barcode prefilled and submits it', async () => {
    const user = userEvent.setup();
    let createdPayload: Record<string, unknown> | null = null;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/access/status')) {
        return new Response(JSON.stringify(authStatusOk), { status: 200 });
      }
      if (url.includes('/foods/barcode/EV-BAR-01')) {
        return new Response(
          JSON.stringify({
            found: false,
            source: 'not_found',
            barcode: 'EV-BAR-01',
            food: null,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/foods') && method === 'POST') {
        createdPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            food: {
              id: 'f-custom-bar',
              isCore: false,
              barcode: createdPayload.barcode,
              name: createdPayload.name,
              brand: null,
              category: null,
              servingLabel: null,
              servingGrams: null,
              caloriesPer100g: createdPayload.caloriesPer100g,
              proteinPer100g: createdPayload.proteinPer100g,
              carbsPer100g: createdPayload.carbsPer100g,
              fatPer100g: createdPayload.fatPer100g,
              micronutrientsPer100g: {},
              createdAt: '2026-11-26T10:10:00.000Z',
              updatedAt: '2026-11-26T10:10:00.000Z',
            },
          }),
          { status: 201 },
        );
      }
      if (url.includes('/foods') && method === 'GET') {
        return new Response(JSON.stringify({ foods: baseFoods, total: baseFoods.length }), {
          status: 200,
        });
      }
      if (url.includes('/recipes') && method === 'GET') {
        return new Response(JSON.stringify({ recipes: [], total: 0 }), { status: 200 });
      }
      if (url.endsWith('/profile')) {
        return new Response(JSON.stringify(sampleProfileRes), { status: 200 });
      }
      if (url.includes('/nutrition/logs') && method === 'GET') {
        return new Response(JSON.stringify(makeLogsResponse([])), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'Not mocked' }), { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Barkod / QR Tara' }));
    await user.type(screen.getByLabelText('Barkod veya QR kodu'), 'EV-BAR-01');
    await user.click(screen.getByRole('button', { name: 'Kodu Ara' }));

    const defineBtn = await screen.findByRole('button', {
      name: /Bu Kodla Yeni Besin Tanımla/i,
    });
    await user.click(defineBtn);

    const barcodeField = await screen.findByLabelText('Barkod / QR Kodu (Opsiyonel)');
    expect(barcodeField).toHaveValue('EV-BAR-01');

    await user.type(screen.getByLabelText('Besin Adı'), 'Ev Yapımı Bar');
    await user.type(screen.getByLabelText('Kalori / 100g (kcal)'), '380');
    await user.type(screen.getByLabelText('Protein / 100g (g)'), '25');
    await user.type(screen.getByLabelText('Karb / 100g (g)'), '40');
    await user.type(screen.getByLabelText('Yağ / 100g (g)'), '12');
    await user.click(screen.getByRole('button', { name: 'Besin Ekle' }));

    await waitFor(() => {
      expect(createdPayload).not.toBeNull();
    });
    expect(createdPayload?.barcode).toBe('EV-BAR-01');
    expect(createdPayload?.name).toBe('Ev Yapımı Bar');
  });

  it('gracefully handles unsupported camera, rejects invalid barcode format, and shows 429 rate-limit error', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/access/status')) {
        return new Response(JSON.stringify(authStatusOk), { status: 200 });
      }
      if (url.includes('/foods/barcode/8690000000001')) {
        return new Response(
          JSON.stringify({
            error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.',
          }),
          { status: 429 },
        );
      }
      if (url.includes('/foods')) {
        return new Response(JSON.stringify({ foods: baseFoods, total: baseFoods.length }), {
          status: 200,
        });
      }
      if (url.includes('/recipes')) {
        return new Response(JSON.stringify({ recipes: [], total: 0 }), { status: 200 });
      }
      if (url.endsWith('/profile')) {
        return new Response(JSON.stringify(sampleProfileRes), { status: 200 });
      }
      if (url.includes('/nutrition/logs')) {
        return new Response(JSON.stringify(makeLogsResponse([])), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Not mocked' }), { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Barkod / QR Tara' }));

    // Camera unsupported in JSDOM -> graceful status message
    await user.click(screen.getByRole('button', { name: 'Kamerayla Tara' }));
    expect(
      await screen.findByText(
        'Bu tarayıcı kamera erişimini desteklemiyor. Kodu elle girebilirsin.',
      ),
    ).toBeInTheDocument();

    // Invalid barcode rejected before calling backend
    const codeInput = screen.getByLabelText('Barkod veya QR kodu');
    await user.type(codeInput, '../bad');
    await user.click(screen.getByRole('button', { name: 'Kodu Ara' }));
    expect(
      await screen.findByText(/Geçerli bir barkod veya QR kodu giriniz/i),
    ).toBeInTheDocument();

    // Rate limit 429 message displayed
    await user.clear(codeInput);
    await user.type(codeInput, '8690000000001');
    await user.click(screen.getByRole('button', { name: 'Kodu Ara' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Çok fazla istek gönderildi');
  });
});
