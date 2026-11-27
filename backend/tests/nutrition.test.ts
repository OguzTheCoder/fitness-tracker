import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/session.utils.js';
import { CORE_FOODS } from '../src/modules/foods/coreFoods.data.js';

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

async function registerAndGetCookie(email: string, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'StrongPassword123!',
  });
  expect(res.status).toBe(201);
  return extractCookieHeader(res.headers['set-cookie']);
}

describe('Nutrition Core, Recipes, Snapshots & Micronutrients (AUTH-10 / v1.1.0)', () => {
  beforeEach(async () => {
    await prisma.nutritionLog.deleteMany();
    await prisma.recipeItem.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.food.deleteMany({ where: { isCore: false } });
    await prisma.calorieEntry.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.workoutEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests on foods, recipes, and nutrition logs with 401', async () => {
    const [foodsRes, recipesRes, logsRes] = await Promise.all([
      request(app).get('/api/foods'),
      request(app).get('/api/recipes'),
      request(app).get('/api/nutrition/logs'),
    ]);

    expect(foodsRes.status).toBe(401);
    expect(recipesRes.status).toBe(401);
    expect(logsRes.status).toBe(401);
  });

  it('auto-seeds core foods, searches in Turkish, manages custom foods, enforces limits and user isolation', async () => {
    const cookieA = await registerAndGetCookie('a@example.com', 'Kullanıcı A');
    const cookieB = await registerAndGetCookie('b@example.com', 'Kullanıcı B');

    // Core foods auto-seeded & searchable
    const coreRes = await request(app)
      .get('/api/foods?scope=core&limit=100')
      .set('Cookie', cookieA);
    expect(coreRes.status).toBe(200);
    expect(coreRes.body.total).toBe(CORE_FOODS.length);
    const chicken = coreRes.body.foods.find((f: { name: string }) =>
      f.name.includes('Tavuk Göğsü (Izgara)'),
    );
    expect(chicken).toBeDefined();
    expect(chicken.isCore).toBe(true);
    expect(chicken.micronutrientsPer100g.K).toBeGreaterThan(0);

    // Search filter
    const searchRes = await request(app)
      .get('/api/foods?q=tavuk')
      .set('Cookie', cookieA);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.foods.length).toBeGreaterThanOrEqual(2);

    // Pagination upper bound
    const badLimitRes = await request(app)
      .get('/api/foods?limit=500')
      .set('Cookie', cookieA);
    expect(badLimitRes.status).toBe(400);

    // Cannot edit or delete core food
    const editCoreRes = await request(app)
      .put(`/api/foods/${chicken.id}`)
      .set('Cookie', cookieA)
      .send({
        name: 'Hack',
        caloriesPer100g: 10,
        proteinPer100g: 1,
        carbsPer100g: 1,
        fatPer100g: 1,
      });
    expect(editCoreRes.status).toBe(403);

    const deleteCoreRes = await request(app)
      .delete(`/api/foods/${chicken.id}`)
      .set('Cookie', cookieA);
    expect(deleteCoreRes.status).toBe(403);

    // Rejects unknown micronutrient key
    const badMicroRes = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        name: 'Hatalı Besin',
        caloriesPer100g: 100,
        proteinPer100g: 10,
        carbsPer100g: 10,
        fatPer100g: 2,
        micronutrientsPer100g: { InvalidKey: 50 },
      });
    expect(badMicroRes.status).toBe(400);

    // User A creates custom food
    const createRes = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        name: 'Ev Yapımı Protein Bar',
        brand: 'Kişisel',
        category: 'Atıştırmalık',
        servingLabel: '1 bar',
        servingGrams: 50,
        caloriesPer100g: 400,
        proteinPer100g: 30,
        carbsPer100g: 40,
        fatPer100g: 12,
        micronutrientsPer100g: { Mg: 80, Fe: 3.2, VitC: 12 },
      });
    expect(createRes.status).toBe(201);
    const customFoodId = createRes.body.food.id;
    expect(createRes.body.food.isCore).toBe(false);
    expect(createRes.body.food.micronutrientsPer100g).toEqual({ Mg: 80, Fe: 3.2, VitC: 12 });

    // User B cannot see, update, or delete User A's custom food
    const bList = await request(app)
      .get('/api/foods?scope=custom')
      .set('Cookie', cookieB);
    expect(bList.status).toBe(200);
    expect(bList.body.foods).toHaveLength(0);

    const bUpdate = await request(app)
      .put(`/api/foods/${customFoodId}`)
      .set('Cookie', cookieB)
      .send({
        name: 'Çalınan Besin',
        caloriesPer100g: 100,
        proteinPer100g: 5,
        carbsPer100g: 5,
        fatPer100g: 5,
      });
    expect(bUpdate.status).toBe(404);

    const bDelete = await request(app)
      .delete(`/api/foods/${customFoodId}`)
      .set('Cookie', cookieB);
    expect(bDelete.status).toBe(404);

    // User A updates and deletes own food
    const aUpdate = await request(app)
      .put(`/api/foods/${customFoodId}`)
      .set('Cookie', cookieA)
      .send({
        name: 'Güncel Protein Bar',
        servingLabel: '1 adet',
        servingGrams: 60,
        caloriesPer100g: 420,
        proteinPer100g: 32,
        carbsPer100g: 38,
        fatPer100g: 14,
        micronutrientsPer100g: { Mg: 90 },
      });
    expect(aUpdate.status).toBe(200);
    expect(aUpdate.body.food.name).toBe('Güncel Protein Bar');

    const aDelete = await request(app)
      .delete(`/api/foods/${customFoodId}`)
      .set('Cookie', cookieA);
    expect(aDelete.status).toBe(200);
  });

  it('supports recipe CRUD, all 3 logging modes (servings/grams/decompose), snapshot locking, and visible micronutrients', async () => {
    const cookieA = await registerAndGetCookie('chef@example.com', 'Şef A');
    const cookieB = await registerAndGetCookie('other@example.com', 'Diğer B');

    // Create two deterministic custom foods for exact math assertions
    const food1Res = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        name: 'Test Yulaf',
        servingLabel: '1 porsiyon',
        servingGrams: 50,
        caloriesPer100g: 400,
        proteinPer100g: 10,
        carbsPer100g: 70,
        fatPer100g: 8,
        micronutrientsPer100g: { Na: 10, K: 300, Mg: 120, Fe: 4, VitC: 0 },
      });
    const food1Id = food1Res.body.food.id;

    const food2Res = await request(app)
      .post('/api/foods')
      .set('Cookie', cookieA)
      .send({
        name: 'Test Çilek',
        servingLabel: '1 kase',
        servingGrams: 100,
        caloriesPer100g: 50,
        proteinPer100g: 2,
        carbsPer100g: 10,
        fatPer100g: 0,
        micronutrientsPer100g: { K: 150, Fe: 1, VitC: 60 },
      });
    const food2Id = food2Res.body.food.id;

    // User B cannot reference User A's private food in a recipe
    const crossRecipe = await request(app)
      .post('/api/recipes')
      .set('Cookie', cookieB)
      .send({
        name: 'İzinsiz Tarif',
        servingsCount: 1,
        items: [{ foodId: food1Id, grams: 100 }],
      });
    expect(crossRecipe.status).toBe(400);

    // User A creates a 2-serving recipe: 100g Test Yulaf (400 kcal) + 200g Test Çilek (100 kcal) = 500 kcal, 300g raw, 400g cooked
    const recipeRes = await request(app)
      .post('/api/recipes')
      .set('Cookie', cookieA)
      .send({
        name: 'Çilekli Yulaf',
        description: '2 porsiyonluk kahvaltı',
        servingsCount: 2,
        cookedWeightG: 400,
        items: [
          { foodId: food1Id, grams: 100 },
          { foodId: food2Id, grams: 200 },
        ],
      });
    expect(recipeRes.status).toBe(201);
    const recipeId = recipeRes.body.recipe.id;
    expect(recipeRes.body.recipe.rawWeightG).toBe(300);
    expect(recipeRes.body.recipe.totalWeightG).toBe(400);
    expect(recipeRes.body.recipe.totals.calories).toBe(500);
    expect(recipeRes.body.recipe.perServing.calories).toBe(250);
    expect(recipeRes.body.recipe.perServing.micronutrients.VitC).toBe(60);

    // Cannot delete food1 while used in recipe
    const lockedFoodDelete = await request(app)
      .delete(`/api/foods/${food1Id}`)
      .set('Cookie', cookieA);
    expect(lockedFoodDelete.status).toBe(409);

    // 1) Log food by servings (without mealLabel — optional!)
    const logFoodRes = await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', cookieA)
      .send({
        kind: 'food',
        date: '2026-11-25',
        foodId: food1Id,
        quantityMode: 'servings',
        servings: 1, // 50g -> 200 kcal, 5P, 35K, 4Y, Mg 60, Fe 2
      });
    expect(logFoodRes.status).toBe(201);
    expect(logFoodRes.body.log.mealLabel).toBeNull();
    expect(logFoodRes.body.log.grams).toBe(50);
    expect(logFoodRes.body.log.calories).toBe(200);
    const foodLogId = logFoodRes.body.log.id;

    // 2) Log recipe by servings (1 serving of 2 -> 250 kcal, 200g)
    const logRecipeServings = await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', cookieA)
      .send({
        kind: 'recipe',
        date: '2026-11-25',
        mealLabel: 'Kahvaltı',
        recipeId,
        mode: 'servings',
        servings: 1,
      });
    expect(logRecipeServings.status).toBe(201);
    expect(logRecipeServings.body.log.calories).toBe(250);
    expect(logRecipeServings.body.log.grams).toBe(200);
    expect(logRecipeServings.body.log.mealLabel).toBe('Kahvaltı');

    // 3) Log recipe by grams (100g out of 400g cookedWeight -> 125 kcal)
    const logRecipeGrams = await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', cookieA)
      .send({
        kind: 'recipe',
        date: '2026-11-24',
        recipeId,
        mode: 'grams',
        grams: 100,
      });
    expect(logRecipeGrams.status).toBe(201);
    expect(logRecipeGrams.body.log.calories).toBe(125);
    expect(logRecipeGrams.body.log.grams).toBe(100);

    // 4) Log recipe decomposed into ingredients (1 serving -> 50g Test Yulaf + 100g Test Çilek)
    const logDecompose = await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', cookieA)
      .send({
        kind: 'recipe',
        date: '2026-11-23',
        mealLabel: 'Ara Öğün',
        recipeId,
        mode: 'decompose',
        servings: 1,
      });
    expect(logDecompose.status).toBe(201);
    expect(logDecompose.body.logs).toHaveLength(2);
    expect(logDecompose.body.logs[0].sourceType).toBe('recipe_item');
    expect(logDecompose.body.logs[0].grams).toBe(50);
    expect(logDecompose.body.logs[0].calories).toBe(200);
    expect(logDecompose.body.logs[1].grams).toBe(100);
    expect(logDecompose.body.logs[1].calories).toBe(50);

    // SNAPSHOT LOCK TEST: drastically mutate food1 AND delete recipe!
    await request(app)
      .put(`/api/foods/${food1Id}`)
      .set('Cookie', cookieA)
      .send({
        name: 'Değişmiş Yulaf',
        servingLabel: '1 porsiyon',
        servingGrams: 50,
        caloriesPer100g: 999,
        proteinPer100g: 99,
        carbsPer100g: 1,
        fatPer100g: 1,
        micronutrientsPer100g: { Mg: 9999 },
      });

    const delRecipeRes = await request(app)
      .delete(`/api/recipes/${recipeId}`)
      .set('Cookie', cookieA);
    expect(delRecipeRes.status).toBe(200);

    // Past day 2026-11-25 MUST stay locked at original snapshot values (200 + 250 = 450 kcal)
    const dayRes = await request(app)
      .get('/api/nutrition/logs?date=2026-11-25')
      .set('Cookie', cookieA);
    expect(dayRes.status).toBe(200);
    expect(dayRes.body.logs).toHaveLength(2);
    expect(dayRes.body.totals.calories).toBe(450);
    // Default 6 visible minerals returned
    const visibleKeys = dayRes.body.visibleMicronutrients.map((m: { key: string }) => m.key);
    expect(visibleKeys).toEqual(['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn']);
    const mgSummary = dayRes.body.visibleMicronutrients.find(
      (m: { key: string }) => m.key === 'Mg',
    );
    expect(mgSummary.amount).toBe(120); // 60 (from 50g food1) + 60 (from 1 serving recipe)

    // Rescaling snapshot via PATCH uses locked ratio (50g -> 100g doubles 200 kcal to 400, NOT 999!)
    const patchRes = await request(app)
      .patch(`/api/nutrition/logs/${foodLogId}`)
      .set('Cookie', cookieA)
      .send({ grams: 100, mealLabel: 'Güncel Öğün' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.log.calories).toBe(400);
    expect(patchRes.body.log.mealLabel).toBe('Güncel Öğün');

    // Update profile visibleMicronutrients to ['VitC', 'Fe'] and confirm nutrition summary follows profile
    const profRes = await request(app)
      .put('/api/profile')
      .set('Cookie', cookieA)
      .send({ visibleMicronutrients: ['VitC', 'Fe'] });
    expect(profRes.status).toBe(200);

    const updatedDayRes = await request(app)
      .get('/api/nutrition/logs?date=2026-11-25')
      .set('Cookie', cookieA);
    expect(updatedDayRes.status).toBe(200);
    expect(updatedDayRes.body.visibleMicronutrients).toEqual([
      { key: 'VitC', label: 'C Vitamini', unit: 'mg', category: 'vitamin', amount: 60 },
      { key: 'Fe', label: 'Demir (Fe)', unit: 'mg', category: 'mineral', amount: 7 }, // 4 (100g food1) + 3 (1 serving recipe)
    ]);

    // Stats summary includes nutrition logs
    const todayIso = new Date().toISOString().slice(0, 10);
    await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', cookieA)
      .send({
        kind: 'food',
        date: todayIso,
        foodId: food2Id,
        quantityMode: 'grams',
        grams: 200, // 100 kcal
      });

    const statsRes = await request(app)
      .get('/api/stats/summary?days=7')
      .set('Cookie', cookieA);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.summary.todayCalories).toBe(100);

    // Pagination limit bound on logs
    const badLogsLimit = await request(app)
      .get('/api/nutrition/logs?limit=999')
      .set('Cookie', cookieA);
    expect(badLogsLimit.status).toBe(400);

    // User B cannot see or delete User A's logs
    const bLogs = await request(app)
      .get('/api/nutrition/logs?date=2026-11-25')
      .set('Cookie', cookieB);
    expect(bLogs.status).toBe(200);
    expect(bLogs.body.logs).toHaveLength(0);

    const bDelLog = await request(app)
      .delete(`/api/nutrition/logs/${foodLogId}`)
      .set('Cookie', cookieB);
    expect(bDelLog.status).toBe(404);
  });
});
