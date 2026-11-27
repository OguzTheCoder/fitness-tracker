import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { sanitizeCsvCell, UTF8_BOM } from '../src/modules/backup/backup.csv.js';
import { ensureCoreExercisesSeeded } from '../src/modules/exercises/exercises.seed.js';
import { ensureCoreFoodsSeeded } from '../src/modules/foods/foods.seed.js';
import { extractSessionToken } from './helpers/authCookie.js';

const app = createApp({
  rateLimit: { apiMax: 1000, backupMax: 1000, authIpMax: 1000, authAccountMax: 1000 },
});

async function registerUser(name: string, email: string) {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
  });
  expect(res.status).toBe(201);
  return {
    id: res.body.user.id as string,
    token: extractSessionToken(res.headers['set-cookie']),
    cookie: res.headers['set-cookie'] as string[],
  };
}

async function cleanUserTables() {
  await prisma.nutritionLog.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.food.deleteMany({ where: { isCore: false } });
  await prisma.workoutSet.deleteMany();
  await prisma.workoutExercise.deleteMany();
  await prisma.workoutEntry.deleteMany();
  await prisma.workoutTemplateExercise.deleteMany();
  await prisma.workoutTemplate.deleteMany();
  await prisma.exercise.deleteMany({ where: { isCore: false } });
  await prisma.cardioEntry.deleteMany();
  await prisma.stepEntry.deleteMany();
  await prisma.calorieEntry.deleteMany();
  await prisma.weightEntry.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
}

describe('Backup Export & Import API (AUTH-13 / v1.4.0)', () => {
  beforeEach(async () => {
    await cleanUserTables();
    await Promise.all([ensureCoreFoodsSeeded(), ensureCoreExercisesSeeded()]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('requires authentication for export and import endpoints', async () => {
    const expJson = await request(app).get('/api/backup/export?format=json');
    const expCsv = await request(app).get('/api/backup/export?format=csv&dataset=weights');
    const imp = await request(app).post('/api/backup/import').send({});

    expect(expJson.status).toBe(401);
    expect(expCsv.status).toBe(401);
    expect(imp.status).toBe(401);
  });

  it('exports full versioned JSON via HttpOnly cookie and restores cleanly in overwrite mode without touching core or other users', async () => {
    const userA = await registerUser('Oğuz', 'oguz-backup@example.com');
    const userB = await registerUser('Diğer Kullanıcı', 'other-backup@example.com');

    // Seed data for User B (must stay isolated & untouched)
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: '2026-11-20', weightKg: 65.4, note: 'User B gizli kilo' });
    await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: '2026-11-20', steps: 12345, note: 'User B adım' });

    const coreFood = await prisma.food.findFirstOrThrow({
      where: { isCore: true, coreKey: { not: null } },
    });
    const coreExercise = await prisma.exercise.findFirstOrThrow({
      where: { isCore: true, coreKey: { not: null } },
    });

    // Populate all entities for User A
    await request(app)
      .put('/api/profile')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Oğuz Yedek',
        dailyCalorieGoal: 2450,
        proteinGoalG: 175,
        carbsGoalG: 260,
        fatGoalG: 75,
        dailyStepGoal: 9500,
        visibleMicronutrients: ['Na', 'K', 'VitD'],
      });

    await request(app)
      .post('/api/weights')
      .set('Cookie', userA.cookie)
      .send({ date: '2026-11-20', weightKg: 81.2, note: 'Sabah aç' });

    await request(app)
      .post('/api/calories')
      .set('Cookie', userA.cookie)
      .send({ date: '2026-11-19', mealName: 'Eski kayıt kahvaltı', calories: 520 });

    const customFoodRes = await request(app)
      .post('/api/foods')
      .set('Cookie', userA.cookie)
      .send({
        barcode: '8690001234567',
        name: 'Ev Yapımı Granola',
        brand: 'Kişisel',
        category: 'Tahıl',
        servingLabel: '1 kase',
        servingGrams: 50,
        caloriesPer100g: 420,
        proteinPer100g: 14,
        carbsPer100g: 56,
        fatPer100g: 15,
        micronutrientsPer100g: { Mg: 85, Fe: 3.2 },
      });
    expect(customFoodRes.status).toBe(201);
    const customFoodId = customFoodRes.body.food.id as string;

    const recipeRes = await request(app)
      .post('/api/recipes')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Protein Kase',
        description: 'Antrenman sonrası',
        servingsCount: 2,
        cookedWeightG: 300,
        items: [
          { foodId: coreFood.id, grams: 150 },
          { foodId: customFoodId, grams: 50 },
        ],
      });
    expect(recipeRes.status).toBe(201);
    const recipeId = recipeRes.body.recipe.id as string;

    await request(app)
      .post('/api/nutrition/logs')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'recipe',
        date: '2026-11-20',
        mealLabel: 'Öğle',
        recipeId,
        mode: 'servings',
        servings: 1,
      });

    const customExRes = await request(app)
      .post('/api/exercises')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Landmine Press',
        muscleGroup: 'Omuz',
        equipment: 'Barbell',
        isBodyweight: false,
        notes: 'Tek kol',
      });
    expect(customExRes.status).toBe(201);
    const customExId = customExRes.body.exercise.id as string;

    const tplRes = await request(app)
      .post('/api/workout-templates')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Üst Vücut A',
        description: 'İtiş odaklı',
        exercises: [
          { exerciseId: coreExercise.id, defaultSets: 3, defaultReps: 8, defaultWeightKg: 70 },
          { exerciseId: customExId, defaultSets: 3, defaultReps: 12, defaultWeightKg: 25 },
        ],
      });
    expect(tplRes.status).toBe(201);
    const templateId = tplRes.body.template.id as string;

    await request(app)
      .post('/api/workouts')
      .set('Cookie', userA.cookie)
      .send({
        date: '2026-11-20',
        name: 'Üst Vücut A',
        durationMinutes: 55,
        note: 'Güçlü geçti',
        templateId,
        exercises: [
          {
            exerciseId: coreExercise.id,
            sets: [
              { reps: 8, weightKg: 70 },
              { reps: 8, weightKg: 72.5 },
            ],
          },
          {
            exerciseId: customExId,
            sets: [{ reps: 12, weightKg: 25 }],
          },
        ],
      });

    await request(app)
      .post('/api/cardio')
      .set('Cookie', userA.cookie)
      .send({
        date: '2026-11-20',
        cardioType: 'Koşu',
        durationMinutes: 30,
        distanceKm: 5.2,
        caloriesBurned: 340,
        note: 'Parkur',
      });

    await request(app)
      .post('/api/steps')
      .set('Cookie', userA.cookie)
      .send({ date: '2026-11-20', steps: 10400, note: 'Hedef geçildi' });

    const coreFoodCountBefore = await prisma.food.count({ where: { isCore: true } });
    const coreExerciseCountBefore = await prisma.exercise.count({ where: { isCore: true } });

    // Export full JSON via HttpOnly cookie
    const exportRes = await request(app)
      .get('/api/backup/export?format=json')
      .set('Cookie', userA.cookie);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['cache-control']).toBe('no-store');
    expect(exportRes.headers['content-disposition']).toMatch(
      /^attachment; filename="fitness-tracker-backup-\d{4}-\d{2}-\d{2}\.json"$/,
    );

    const exported = JSON.parse(exportRes.text);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.app).toBe('fitness-tracker');
    expect(exported.data.profile).toMatchObject({
      name: 'Oğuz Yedek',
      dailyCalorieGoal: 2450,
      dailyStepGoal: 9500,
      visibleMicronutrients: ['Na', 'K', 'VitD'],
    });
    expect(exported.data.weights).toHaveLength(1);
    expect(exported.data.calories).toHaveLength(1);
    expect(exported.data.customFoods).toHaveLength(1);
    expect(exported.data.recipes).toHaveLength(1);
    expect(exported.data.nutritionLogs).toHaveLength(1);
    expect(exported.data.customExercises).toHaveLength(1);
    expect(exported.data.workoutTemplates).toHaveLength(1);
    expect(exported.data.workouts).toHaveLength(1);
    expect(exported.data.cardio).toHaveLength(1);
    expect(exported.data.steps).toHaveLength(1);
    // Strict isolation: no User B data or auth secrets
    expect(exportRes.text).not.toContain('User B gizli kilo');
    expect(exportRes.text).not.toContain('passwordHash');
    expect(exportRes.text).not.toContain('oguz-backup@example.com');

    // Mutate User A's state before overwrite restore
    await request(app)
      .post('/api/weights')
      .set('Cookie', userA.cookie)
      .send({ date: '2026-11-25', weightKg: 99.9, note: 'Silinmeli' });
    await request(app)
      .put('/api/profile')
      .set('Cookie', userA.cookie)
      .send({ name: 'Geçici Ad', dailyCalorieGoal: 1500 });

    // Restore with overwrite
    const importRes = await request(app)
      .post('/api/backup/import')
      .set('Cookie', userA.cookie)
      .send({
        mode: 'overwrite',
        backup: exported,
      });

    expect(importRes.status).toBe(200);
    expect(importRes.body.profileUpdated).toBe(true);
    expect(importRes.body.totals.imported).toBe(10);

    // Verify User A's restored state
    const profileAfter = await request(app).get('/api/profile').set('Cookie', userA.cookie);
    expect(profileAfter.body.profile.name).toBe('Oğuz Yedek');
    expect(profileAfter.body.profile.dailyCalorieGoal).toBe(2450);

    const weightsAfter = await request(app).get('/api/weights').set('Cookie', userA.cookie);
    expect(weightsAfter.body.entries).toHaveLength(1);
    expect(weightsAfter.body.entries[0].date).toBe('2026-11-20');

    const workoutsAfter = await request(app).get('/api/workouts').set('Cookie', userA.cookie);
    expect(workoutsAfter.body.entries).toHaveLength(1);
    expect(workoutsAfter.body.entries[0].exercises).toHaveLength(2);
    expect(workoutsAfter.body.entries[0].exercises[0].sets).toHaveLength(2);

    // Verify core catalogs and User B data are untouched
    expect(await prisma.food.count({ where: { isCore: true } })).toBe(coreFoodCountBefore);
    expect(await prisma.exercise.count({ where: { isCore: true } })).toBe(coreExerciseCountBefore);

    const userBWeights = await request(app)
      .get('/api/weights')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(userBWeights.body.entries).toHaveLength(1);
    expect(userBWeights.body.entries[0].weightKg).toBe(65.4);
  });

  it('supports merge mode with both keep_existing and prefer_backup conflict strategies without duplicating identical entries', async () => {
    const user = await registerUser('Oğuz', 'merge@example.com');

    await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ dailyCalorieGoal: 2200, dailyStepGoal: 8000 });
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-19', weightKg: 80.5, note: 'Eski gün' });
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', weightKg: 80.0, note: 'Mevcut kayıt' });
    await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', steps: 5000, note: 'Mevcut adım' });
    await request(app)
      .post('/api/foods')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        barcode: '8690009998887',
        name: 'Protein Bar',
        caloriesPer100g: 250,
        proteinPer100g: 20,
        carbsPer100g: 25,
        fatPer100g: 8,
      });

    const incomingBackup = {
      schemaVersion: 1,
      app: 'fitness-tracker',
      data: {
        profile: {
          name: 'Yedek Profil',
          dailyCalorieGoal: 2600,
          proteinGoalG: 180,
          carbsGoalG: 250,
          fatGoalG: 80,
          dailyStepGoal: 11000,
          visibleMicronutrients: ['Na', 'K'],
        },
        weights: [
          { date: '2026-11-20', weightKg: 82.5, note: 'Yedek kayıt' },
          { date: '2026-11-21', weightKg: 82.1, note: 'Yeni gün' },
        ],
        steps: [
          { date: '2026-11-20', steps: 9500, note: 'Yedek adım' },
          { date: '2026-11-21', steps: 10200, note: 'Yeni adım' },
        ],
        customFoods: [
          {
            refId: 'f1',
            barcode: '8690009998887',
            name: 'Protein Bar (Yedek)',
            caloriesPer100g: 310,
            proteinPer100g: 24,
            carbsPer100g: 22,
            fatPer100g: 10,
            micronutrientsPer100g: {},
          },
        ],
        cardio: [
          {
            date: '2026-11-21',
            cardioType: 'Bisiklet',
            durationMinutes: 40,
            distanceKm: 15,
            caloriesBurned: 380,
            note: 'Sahil',
          },
        ],
      },
    };

    // 1. Merge with keep_existing
    const keepRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'merge',
        conflictStrategy: 'keep_existing',
        backup: incomingBackup,
      });

    expect(keepRes.status).toBe(200);
    expect(keepRes.body.profileUpdated).toBe(false);
    expect(keepRes.body.summary.imported.weights).toBe(1);
    expect(keepRes.body.summary.skipped.weights).toBe(1);
    expect(keepRes.body.summary.imported.steps).toBe(1);
    expect(keepRes.body.summary.skipped.steps).toBe(1);
    expect(keepRes.body.summary.skipped.customFoods).toBe(1);
    expect(keepRes.body.summary.imported.cardio).toBe(1);

    const w20Keep = await prisma.weightEntry.findUniqueOrThrow({
      where: { userId_date: { userId: user.id, date: '2026-11-20' } },
    });
    expect(w20Keep.weightKg).toBe(80.0);

    // Re-importing same backup with keep_existing is idempotent (0 new rows)
    const repeatRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'merge',
        conflictStrategy: 'keep_existing',
        backup: incomingBackup,
      });
    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.totals.imported).toBe(0);

    // 2. Merge with prefer_backup updates conflicting dates, barcode food & profile while keeping 2026-11-19
    const preferRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'merge',
        conflictStrategy: 'prefer_backup',
        backup: incomingBackup,
      });

    expect(preferRes.status).toBe(200);
    expect(preferRes.body.profileUpdated).toBe(true);
    expect(preferRes.body.summary.updated.weights).toBe(2);
    expect(preferRes.body.summary.updated.steps).toBe(2);
    expect(preferRes.body.summary.updated.customFoods).toBe(1);

    const weights = await prisma.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    });
    expect(weights.map((w) => [w.date, w.weightKg])).toEqual([
      ['2026-11-19', 80.5],
      ['2026-11-20', 82.5],
      ['2026-11-21', 82.1],
    ]);

    const food = await prisma.food.findFirstOrThrow({
      where: { userId: user.id, barcode: '8690009998887' },
    });
    expect(food.caloriesPer100g).toBe(310);

    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.dailyCalorieGoal).toBe(2600);
  });

  it('rolls back atomically when overwrite import fails on broken reference or schema violation', async () => {
    const user = await registerUser('Oğuz', 'rollback@example.com');

    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', weightKg: 78.4, note: 'Korunmalı' });

    // 1. Schema version mismatch -> 400
    const badVersionRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'overwrite',
        backup: { schemaVersion: 99, data: {} },
      });
    expect(badVersionRes.status).toBe(400);

    // 2. Duplicate weight dates -> 400
    const dupDatesRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'overwrite',
        backup: {
          schemaVersion: 1,
          data: {
            weights: [
              { date: '2026-11-20', weightKg: 80 },
              { date: '2026-11-20', weightKg: 81 },
            ],
          },
        },
      });
    expect(dupDatesRes.status).toBe(400);

    // 3. Valid schema shape but broken foodRefId inside recipe during overwrite -> 400 + full rollback
    const brokenRefRes = await request(app)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'overwrite',
        backup: {
          schemaVersion: 1,
          data: {
            weights: [{ date: '2026-11-22', weightKg: 79.0 }],
            recipes: [
              {
                refId: 'r1',
                name: 'Bozuk Tarif',
                servingsCount: 1,
                items: [{ foodRefId: 'olmayan-besin-id', grams: 100 }],
              },
            ],
          },
        },
      });
    expect(brokenRefRes.status).toBe(400);

    // Original weight entry must still exist intact (overwrite deleteMany was rolled back!)
    const remainingWeights = await prisma.weightEntry.findMany({ where: { userId: user.id } });
    expect(remainingWeights).toHaveLength(1);
    expect(remainingWeights[0].date).toBe('2026-11-20');
    expect(remainingWeights[0].weightKg).toBe(78.4);
  });

  it('exports UTF-8 BOM CSV for all 6 datasets and neutralizes spreadsheet formula injection', async () => {
    const user = await registerUser('Oğuz', 'csv@example.com');
    const coreFood = await prisma.food.findFirstOrThrow({ where: { isCore: true } });

    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', weightKg: 79.5, note: '=CMD("calc")' });

    await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', mealName: '+SUM(1,2), "Öğün"', calories: 450 });

    await request(app)
      .post('/api/nutrition/logs')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        kind: 'food',
        date: '2026-11-20',
        mealLabel: '@SUM(A1)',
        foodId: coreFood.id,
        quantityMode: 'grams',
        grams: 100,
      });

    await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        date: '2026-11-20',
        name: '-2+3 Antrenman',
        durationMinutes: 45,
        note: '  =HYPERLINK("http://evil")',
        exercises: [
          {
            exerciseName: 'Bench Press',
            muscleGroup: 'Göğüs',
            sets: [{ reps: 8, weightKg: 80 }],
          },
        ],
      });

    // Legacy workout without exercise rows
    await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        date: '2026-11-19',
        name: 'Serbest Esneme',
        durationMinutes: 20,
      });

    await request(app)
      .post('/api/cardio')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        date: '2026-11-20',
        cardioType: 'Koşu',
        durationMinutes: 25,
        distanceKm: 4.5,
        caloriesBurned: 280,
        note: '\t=1+1',
      });

    await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ date: '2026-11-20', steps: 8800, note: 'Şehir yürüyüşü' });

    // Missing dataset param -> 400
    const missingDataset = await request(app)
      .get('/api/backup/export?format=csv')
      .set('Authorization', `Bearer ${user.token}`);
    expect(missingDataset.status).toBe(400);

    const datasets = ['weights', 'nutrition', 'workouts', 'cardio', 'steps', 'calories'] as const;
    const responses: Record<string, string> = {};

    for (const ds of datasets) {
      const res = await request(app)
        .get(`/api/backup/export?format=csv&dataset=${ds}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toMatch(
        new RegExp(`^attachment; filename="fitness-tracker-${ds}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`),
      );
      expect(res.text.startsWith(UTF8_BOM)).toBe(true);
      responses[ds] = res.text;
    }

    // Formula neutralization & RFC 4180 escaping assertions
    expect(responses.weights).toContain(`"'=CMD(""calc"")"`);
    expect(responses.calories).toContain(`"'+SUM(1,2), ""Öğün"""`);
    expect(responses.nutrition).toContain(`'@SUM(A1)`);
    expect(responses.workouts).toContain(`'-2+3 Antrenman`);
    expect(responses.workouts).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(responses.workouts).toContain('Bench Press');
    expect(responses.workouts).toContain('Serbest Esneme');
    expect(responses.cardio).toContain(`'=1+1`);
    expect(responses.steps).toContain('Şehir yürüyüşü');

    // Direct unit check for untrimmed leading whitespace / tab / CR formula injection
    expect(sanitizeCsvCell('  =HYPERLINK("http://evil")')).toBe(
      `"'  =HYPERLINK(""http://evil"")"`,
    );
    expect(sanitizeCsvCell('\t=1+1')).toBe(`'\t=1+1`);
    expect(sanitizeCsvCell('\r+2')).toBe(`"'\r+2"`);
  });

  it('enforces dedicated import body limit (preserving global 16kb limit) and backup rate limit', async () => {
    const restrictedApp = createApp({
      backupImportLimit: '24kb',
      rateLimit: { windowMs: 60_000, backupMax: 3, apiMax: 100 },
    });

    const reg = await request(restrictedApp).post('/api/auth/register').send({
      name: 'Limit User',
      email: 'limit-backup@example.com',
      password: 'Password123!',
    });
    const token = extractSessionToken(reg.headers['set-cookie']);

    // Global 16kb limit on other endpoints remains strictly enforced
    const globalLarge = await request(restrictedApp).post('/api/auth/login').send({
      email: 'limit-backup@example.com',
      password: 'short',
      extra: 'x'.repeat(20 * 1024),
    });
    expect(globalLarge.status).toBe(413);

    // Import > 16kb but < 24kb succeeds (proves import route has its own larger JSON parser)
    const mediumWeights = Array.from({ length: 240 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, weightKg: 80.1, note: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    });
    const mediumPayload = {
      mode: 'merge',
      conflictStrategy: 'keep_existing',
      backup: { schemaVersion: 1, data: { weights: mediumWeights } },
    };
    expect(Buffer.byteLength(JSON.stringify(mediumPayload))).toBeGreaterThan(16 * 1024);
    expect(Buffer.byteLength(JSON.stringify(mediumPayload))).toBeLessThan(24 * 1024);

    const mediumRes = await request(restrictedApp)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${token}`)
      .send(mediumPayload);
    expect(mediumRes.status).toBe(200);
    expect(mediumRes.body.summary.imported.weights).toBe(240);

    // Payload exceeding import limit -> 413
    const tooLargeImport = await request(restrictedApp)
      .post('/api/backup/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'merge',
        backup: { schemaVersion: 1, data: { weights: [] } },
        padding: 'x'.repeat(30 * 1024),
      });
    expect(tooLargeImport.status).toBe(413);

    // 3rd backup request succeeds, 4th hits backupMax=3 -> 429
    const thirdRes = await request(restrictedApp)
      .get('/api/backup/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(thirdRes.status).toBe(200);

    const fourthRes = await request(restrictedApp)
      .get('/api/backup/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(fourthRes.status).toBe(429);
  });
});
