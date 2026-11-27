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

const sampleFoods = [
  {
    id: 'f-chicken',
    isCore: true,
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
  {
    id: 'f-oats',
    isCore: true,
    name: 'Yulaf Ezmesi (Kuru)',
    brand: null,
    category: 'Tahıl',
    servingLabel: '5 yemek kaşığı',
    servingGrams: 50,
    caloriesPer100g: 379,
    proteinPer100g: 13.2,
    carbsPer100g: 67.7,
    fatPer100g: 6.5,
    micronutrientsPer100g: { Mg: 138, Fe: 4.3 },
    createdAt: '2026-11-26T08:00:00.000Z',
    updatedAt: '2026-11-26T08:00:00.000Z',
  },
];

const sampleRecipes = [
  {
    id: 'r-bowl',
    name: 'Proteinli Yulaf',
    description: 'Hızlı kahvaltı',
    servingsCount: 2,
    cookedWeightG: 300,
    rawWeightG: 200,
    totalWeightG: 300,
    items: [
      {
        id: 'ri-1',
        foodId: 'f-oats',
        foodName: 'Yulaf Ezmesi (Kuru)',
        grams: 100,
        sortOrder: 0,
        calories: 379,
        proteinG: 13.2,
        carbsG: 67.7,
        fatG: 6.5,
        micronutrients: { Mg: 138 },
      },
    ],
    totals: { calories: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, micronutrients: { Mg: 138 } },
    perServing: {
      calories: 189.5,
      proteinG: 6.6,
      carbsG: 33.9,
      fatG: 3.3,
      micronutrients: { Mg: 69 },
    },
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
    { key: 'Ca', label: 'Kalsiyum (Ca)', unit: 'mg', category: 'mineral' },
    { key: 'Fe', label: 'Demir (Fe)', unit: 'mg', category: 'mineral' },
    { key: 'Zn', label: 'Çinko (Zn)', unit: 'mg', category: 'mineral' },
  ],
};

function makeLogsResponse(logs: unknown[], calories = 0, mgAmount = 0) {
  return {
    date: '2026-11-26',
    logs,
    totals: {
      calories,
      proteinG: calories > 0 ? 31 : 0,
      carbsG: 0,
      fatG: calories > 0 ? 3.6 : 0,
      micronutrients: mgAmount > 0 ? { Mg: mgAmount } : {},
    },
    goals: {
      dailyCalorieGoal: 2000,
      proteinGoalG: 150,
      carbsGoalG: 200,
      fatGoalG: 65,
    },
    visibleMicronutrients: [
      { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral', amount: 0 },
      { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral', amount: 0 },
      { key: 'Mg', label: 'Magnezyum (Mg)', unit: 'mg', category: 'mineral', amount: mgAmount },
    ],
    dailyTotals: [],
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderNutrition() {
  return render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Nutrition, Foods & Recipes (AUTH-10 / v1.1.0)', () => {
  it('displays macro/visible micronutrient summaries and logs a food and decomposed recipe', async () => {
    const user = userEvent.setup();
    const createdLog = {
      id: 'log-1',
      date: '2026-11-26',
      mealLabel: 'Öğle',
      sourceType: 'food',
      foodId: 'f-chicken',
      recipeId: null,
      entryName: 'Tavuk Göğsü (Izgara)',
      quantityMode: 'grams',
      servings: null,
      grams: 100,
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
      micronutrients: { Mg: 29 },
      createdAt: '2026-11-26T12:00:00.000Z',
      updatedAt: '2026-11-26T12:00:00.000Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/foods') && method === 'GET') {
        return jsonResponse(200, { foods: sampleFoods, total: sampleFoods.length });
      }
      if (url.includes('/recipes') && method === 'GET') {
        return jsonResponse(200, { recipes: sampleRecipes, total: sampleRecipes.length });
      }
      if (url.includes('/profile') && method === 'GET') {
        return jsonResponse(200, sampleProfileRes);
      }
      if (url.includes('/nutrition/logs') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.kind === 'recipe' && body.mode === 'decompose') {
          return jsonResponse(201, { logs: [createdLog, { ...createdLog, id: 'log-2' }] });
        }
        return jsonResponse(201, { log: createdLog, logs: [createdLog] });
      }
      if (url.includes('/nutrition/logs') && method === 'GET') {
        return jsonResponse(200, makeLogsResponse([createdLog], 165, 29));
      }
      return jsonResponse(404, { error: 'Bulunamadı' });
    });

    renderNutrition();

    expect(await screen.findByRole('heading', { name: 'Beslenme & Tarifler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beslenme' })).toBeInTheDocument();
    expect(await screen.findByText('Magnezyum (Mg)')).toBeInTheDocument();
    expect(screen.getByText(/Hedef: 2000 kcal/i)).toBeInTheDocument();

    // Open Add Nutrition Drawer and add food with meal label preset
    await user.click(screen.getByRole('button', { name: 'Besin / Tarif Ekle' }));
    await user.click(screen.getByRole('button', { name: 'Öğle' }));
    await user.click(screen.getByRole('button', { name: 'Kayda Ekle' }));

    expect(await screen.findByText('Besin günlük kayda eklendi.')).toBeInTheDocument();

    // Switch to Recipe mode and log decomposed
    await user.click(screen.getByRole('button', { name: 'Tarif Ekle' }));
    await user.selectOptions(screen.getByLabelText('Ekleme Yöntemi'), 'decompose');
    await user.click(screen.getByRole('button', { name: 'Kayda Ekle' }));

    expect(
      await screen.findByText('Tarif 2 malzeme halinde günlük kayda eklendi.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      const postCalls = fetchSpy.mock.calls.filter(
        ([url, init]) => String(url).includes('/nutrition/logs') && init?.method === 'POST',
      );
      expect(postCalls).toHaveLength(2);
      const secondPayload = JSON.parse(String(postCalls[1][1]?.body));
      expect(secondPayload.kind).toBe('recipe');
      expect(secondPayload.mode).toBe('decompose');
    });
  });

  it('creates custom foods in Besinler tab and multi-ingredient recipes in Tarifler tab', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/foods') && method === 'GET') {
        return jsonResponse(200, { foods: sampleFoods, total: sampleFoods.length });
      }
      if (url.includes('/foods') && method === 'POST') {
        return jsonResponse(201, {
          food: { ...sampleFoods[0], id: 'f-custom', isCore: false, name: 'Özel Bar' },
        });
      }
      if (url.includes('/recipes') && method === 'GET') {
        return jsonResponse(200, { recipes: sampleRecipes, total: sampleRecipes.length });
      }
      if (url.includes('/recipes') && method === 'POST') {
        return jsonResponse(201, { recipe: { ...sampleRecipes[0], id: 'r-new', name: 'Yeni Tarif' } });
      }
      if (url.includes('/profile') && method === 'GET') {
        return jsonResponse(200, sampleProfileRes);
      }
      if (url.includes('/nutrition/logs') && method === 'GET') {
        return jsonResponse(200, makeLogsResponse([]));
      }
      return jsonResponse(404, { error: 'Bulunamadı' });
    });

    renderNutrition();
    expect(await screen.findByRole('heading', { name: 'Beslenme & Tarifler' })).toBeInTheDocument();

    // Switch to Besinler tab and create custom food
    await user.click(screen.getByRole('tab', { name: 'Besinler' }));
    await user.type(screen.getByLabelText('Besin Adı'), 'Özel Bar');
    await user.type(screen.getByLabelText('Kalori / 100g (kcal)'), '380');
    await user.type(screen.getByLabelText('Protein / 100g (g)'), '28');
    await user.type(screen.getByLabelText('Karb / 100g (g)'), '35');
    await user.type(screen.getByLabelText('Yağ / 100g (g)'), '12');
    await user.click(screen.getByRole('button', { name: 'Besin Ekle' }));

    expect(await screen.findByText('Özel besin eklendi.')).toBeInTheDocument();

    // Switch to Tarifler tab and create recipe
    await user.click(screen.getByRole('tab', { name: 'Tarifler' }));
    await user.type(screen.getByLabelText('Tarif Adı'), 'Yeni Tarif');
    await user.click(screen.getByRole('button', { name: 'Tarifi Kaydet' }));

    expect(await screen.findByText('Tarif oluşturuldu.')).toBeInTheDocument();

    const recipePost = fetchSpy.mock.calls.find(
      ([url, init]) => String(url).includes('/recipes') && init?.method === 'POST',
    );
    expect(recipePost).toBeDefined();
    expect(JSON.parse(String(recipePost![1]?.body)).name).toBe('Yeni Tarif');
  });
});
