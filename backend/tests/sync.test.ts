import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

async function resetUserData() {
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
  await prisma.weightEntry.deleteMany();
  await prisma.calorieEntry.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
}

async function registerCookieUser(
  app: ReturnType<typeof createApp>,
  name: string,
  email: string,
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
  });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.user.id as string };
}

describe('Delta Sync, Last-Write-Wins & Model B Readiness (AUTH-14 / v1.5.0)', () => {
  beforeEach(async () => {
    await resetUserData();
  });

  it('exposes /api/ready DB check, multi-origin CORS allowlist, and validates generated PostgreSQL schema', async () => {
    const app = createApp({
      corsOrigins: ['https://app.example.com', 'http://localhost:5173'],
    });

    const ready = await request(app).get('/api/ready').set('Origin', 'https://app.example.com');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ok');
    expect(ready.body.database).toBe('up');
    expect(ready.body.version).toBe('1.5.0');
    expect(ready.headers['access-control-allow-origin']).toBe('https://app.example.com');

    const blockedCors = await request(app).get('/api/ready').set('Origin', 'https://evil.example.com');
    expect(blockedCors.status).toBe(200);
    expect(blockedCors.headers['access-control-allow-origin']).toBeUndefined();

    // Verify PostgreSQL schema generation & validation from single source of truth
    const pgOutput = execSync('npm run prisma:pg:validate', {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/fitness_test',
      },
      encoding: 'utf8',
    });
    expect(pgOutput).toContain('is valid');
  });

  it('requires authentication on /api/sync and rejects invalid payloads with 400', async () => {
    const app = createApp();

    const unauthGet = await request(app).get('/api/sync');
    expect(unauthGet.status).toBe(401);

    const unauthPost = await request(app).post('/api/sync').send({ mutations: [] });
    expect(unauthPost.status).toBe(401);

    const { agent } = await registerCookieUser(app, 'Sync Test', 'sync-val@example.com');

    const badSince = await agent.get('/api/sync?since=not-a-date');
    expect(badSince.status).toBe(400);

    const badMutation = await agent.post('/api/sync').send({
      mutations: [
        {
          clientMutationId: 'm1',
          entity: 'weight',
          operation: 'upsert',
          recordId: 'bad id with spaces!!',
          clientUpdatedAt: new Date().toISOString(),
          data: { date: '2026-11-26', weightKg: 80 },
        },
      ],
    });
    expect(badMutation.status).toBe(400);
  });

  it('supports full pull, atomic offline push, delta pull since cursor, and soft-delete tombstones across entities', async () => {
    const app = createApp();
    const { agent } = await registerCookieUser(app, 'Oguz', 'sync-flow@example.com');

    // 1. Initial full pull includes seeded core catalogs
    const fullPull = await agent.get('/api/sync');
    expect(fullPull.status).toBe(200);
    expect(fullPull.body.isFullSync).toBe(true);
    expect(fullPull.body.core.foods.length).toBeGreaterThanOrEqual(40);
    expect(fullPull.body.core.exercises.length).toBeGreaterThanOrEqual(40);
    const cursor1 = fullPull.body.serverTime as string;

    // 2. Push offline mutations (profile, weight, food, nutritionLog, workout, cardio, step)
    const nowIso = new Date(Date.now() + 1000).toISOString();
    const pushRes = await agent.post('/api/sync').send({
      since: cursor1,
      mutations: [
        {
          clientMutationId: 'mut-profile',
          entity: 'profile',
          operation: 'upsert',
          recordId: 'profile',
          clientUpdatedAt: nowIso,
          data: {
            name: 'Oguz Sync',
            dailyCalorieGoal: 2300,
            proteinGoalG: 170,
            carbsGoalG: 230,
            fatGoalG: 70,
            dailyStepGoal: 10000,
            visibleMicronutrients: ['Na', 'K', 'Mg'],
          },
        },
        {
          clientMutationId: 'mut-weight',
          entity: 'weight',
          operation: 'upsert',
          recordId: 'loc_weight_01',
          clientUpdatedAt: nowIso,
          data: { date: '2026-11-26', weightKg: 81.4, note: 'Sabah offline' },
        },
        {
          clientMutationId: 'mut-food',
          entity: 'food',
          operation: 'upsert',
          recordId: 'loc_food_01',
          clientUpdatedAt: nowIso,
          data: {
            barcode: '8690001122334',
            name: 'Ev Yapimi Granola',
            caloriesPer100g: 420,
            proteinPer100g: 12,
            carbsPer100g: 58,
            fatPer100g: 15,
            micronutrientsPer100g: { Mg: 80 },
          },
        },
        {
          clientMutationId: 'mut-log',
          entity: 'nutritionLog',
          operation: 'upsert',
          recordId: 'loc_nlog_01',
          clientUpdatedAt: nowIso,
          data: {
            date: '2026-11-26',
            mealLabel: 'Kahvaltı',
            sourceType: 'food',
            foodId: 'loc_food_01',
            entryName: 'Ev Yapimi Granola',
            quantityMode: 'grams',
            grams: 50,
            calories: 210,
            proteinG: 6,
            carbsG: 29,
            fatG: 7.5,
            micronutrients: { Mg: 40 },
          },
        },
        {
          clientMutationId: 'mut-workout',
          entity: 'workout',
          operation: 'upsert',
          recordId: 'loc_work_01',
          clientUpdatedAt: nowIso,
          data: {
            date: '2026-11-26',
            name: 'Offline Push',
            durationMinutes: 50,
            exercises: [
              {
                exerciseName: 'Bench Press',
                muscleGroup: 'Göğüs',
                sets: [{ setNumber: 1, reps: 8, weightKg: 80 }],
              },
            ],
          },
        },
        {
          clientMutationId: 'mut-cardio',
          entity: 'cardio',
          operation: 'upsert',
          recordId: 'loc_cardio_01',
          clientUpdatedAt: nowIso,
          data: {
            date: '2026-11-26',
            cardioType: 'Koşu',
            durationMinutes: 25,
            distanceKm: 4.5,
            caloriesBurned: 300,
          },
        },
        {
          clientMutationId: 'mut-step',
          entity: 'step',
          operation: 'upsert',
          recordId: 'loc_step_01',
          clientUpdatedAt: nowIso,
          data: { date: '2026-11-26', steps: 9500, note: 'Aksam yuruyusu' },
        },
      ],
    });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.results.every((r: { status: string }) => r.status === 'applied')).toBe(true);
    expect(pushRes.body.pull.changes.weights).toHaveLength(1);
    expect(pushRes.body.pull.changes.foods).toHaveLength(1);
    expect(pushRes.body.pull.changes.nutritionLogs).toHaveLength(1);
    expect(pushRes.body.pull.changes.workouts).toHaveLength(1);
    expect(pushRes.body.pull.changes.cardio).toHaveLength(1);
    expect(pushRes.body.pull.changes.steps).toHaveLength(1);
    expect(pushRes.body.pull.profile.dailyCalorieGoal).toBe(2300);

    const cursor2 = pushRes.body.serverTime as string;

    // 3. Delete via standard REST API creates a tombstone visible in delta pull
    const delRes = await agent.delete('/api/weights/loc_weight_01');
    expect(delRes.status).toBe(200);

    // Active list hides soft-deleted row
    const activeWeights = await agent.get('/api/weights');
    expect(activeWeights.status).toBe(200);
    expect(activeWeights.body.entries).toHaveLength(0);

    // Delta pull since cursor2 returns the tombstone!
    const deltaAfterDelete = await agent.get(`/api/sync?since=${encodeURIComponent(cursor2)}`);
    expect(deltaAfterDelete.status).toBe(200);
    expect(deltaAfterDelete.body.isFullSync).toBe(false);
    expect(deltaAfterDelete.body.changes.weights).toHaveLength(1);
    expect(deltaAfterDelete.body.changes.weights[0].id).toBe('loc_weight_01');
    expect(deltaAfterDelete.body.changes.weights[0].deletedAt).not.toBeNull();
  });

  it('resolves concurrent edits via Last-Write-Wins (stale client loses, newer client wins)', async () => {
    const app = createApp();
    const { agent } = await registerCookieUser(app, 'LWW User', 'lww@example.com');

    // Device A creates record on server at T_server
    const created = await agent.post('/api/weights').send({
      date: '2026-11-25',
      weightKg: 82.0,
      note: 'Sunucu guncel',
    });
    expect(created.status).toBe(201);
    const recordId = created.body.entry.id as string;
    const serverUpdatedAt = new Date(created.body.entry.updatedAt as string);

    // Device B sends stale offline edit (10 seconds OLDER than server)
    const staleTime = new Date(serverUpdatedAt.getTime() - 10_000).toISOString();
    const stalePush = await agent.post('/api/sync').send({
      mutations: [
        {
          clientMutationId: 'stale-1',
          entity: 'weight',
          operation: 'upsert',
          recordId,
          clientUpdatedAt: staleTime,
          data: { date: '2026-11-25', weightKg: 79.0, note: 'Eski offline' },
        },
      ],
    });
    expect(stalePush.status).toBe(200);
    expect(stalePush.body.results[0].status).toBe('conflict_server_wins');

    // Verify server value remained intact
    const afterStale = await agent.get('/api/weights');
    expect(afterStale.body.entries[0].weightKg).toBe(82.0);
    expect(afterStale.body.entries[0].note).toBe('Sunucu guncel');

    // Device C sends NEWER offline edit (10 seconds NEWER than server) -> wins!
    const newerTime = new Date(serverUpdatedAt.getTime() + 10_000).toISOString();
    const newerPush = await agent.post('/api/sync').send({
      mutations: [
        {
          clientMutationId: 'newer-1',
          entity: 'weight',
          operation: 'upsert',
          recordId,
          clientUpdatedAt: newerTime,
          data: { date: '2026-11-25', weightKg: 81.2, note: 'Yeni offline' },
        },
      ],
    });
    expect(newerPush.status).toBe(200);
    expect(newerPush.body.results[0].status).toBe('applied');

    const afterNewer = await agent.get('/api/weights');
    expect(afterNewer.body.entries[0].weightKg).toBe(81.2);
    expect(afterNewer.body.entries[0].note).toBe('Yeni offline');
  });

  it('enforces strict user isolation and core food/exercise immutability in /api/sync', async () => {
    const app = createApp();
    const alice = await registerCookieUser(app, 'Alice', 'alice-sync@example.com');
    const bob = await registerCookieUser(app, 'Bob', 'bob-sync@example.com');

    const aliceWeight = await alice.agent.post('/api/weights').send({
      date: '2026-11-26',
      weightKg: 65.5,
    });
    const aliceWeightId = aliceWeight.body.entry.id as string;

    const fullPull = await bob.agent.get('/api/sync');
    const coreFoodId = fullPull.body.core.foods[0].id as string;
    const coreExerciseId = fullPull.body.core.exercises[0].id as string;

    const futureIso = new Date(Date.now() + 60_000).toISOString();
    const attackPush = await bob.agent.post('/api/sync').send({
      mutations: [
        {
          clientMutationId: 'hijack-weight',
          entity: 'weight',
          operation: 'upsert',
          recordId: aliceWeightId,
          clientUpdatedAt: futureIso,
          data: { date: '2026-11-26', weightKg: 99.9 },
        },
        {
          clientMutationId: 'delete-alice-weight',
          entity: 'weight',
          operation: 'delete',
          recordId: aliceWeightId,
          clientUpdatedAt: futureIso,
        },
        {
          clientMutationId: 'mutate-core-food',
          entity: 'food',
          operation: 'upsert',
          recordId: coreFoodId,
          clientUpdatedAt: futureIso,
          data: {
            name: 'Hacked Food',
            caloriesPer100g: 1,
            proteinPer100g: 1,
            carbsPer100g: 1,
            fatPer100g: 1,
          },
        },
        {
          clientMutationId: 'delete-core-exercise',
          entity: 'exercise',
          operation: 'delete',
          recordId: coreExerciseId,
          clientUpdatedAt: futureIso,
        },
      ],
    });

    expect(attackPush.status).toBe(200);
    expect(attackPush.body.results.every((r: { status: string }) => r.status === 'rejected')).toBe(
      true,
    );

    // Alice's weight is completely untouched
    const aliceCheck = await alice.agent.get('/api/weights');
    expect(aliceCheck.body.entries).toHaveLength(1);
    expect(aliceCheck.body.entries[0].weightKg).toBe(65.5);

    // Core food & exercise are completely untouched
    const coreFood = await prisma.food.findUnique({ where: { id: coreFoodId } });
    expect(coreFood?.name).not.toBe('Hacked Food');
    const coreExercise = await prisma.exercise.findUnique({ where: { id: coreExerciseId } });
    expect(coreExercise?.deletedAt).toBeNull();
  });

  it('enforces dedicated /api/sync body limit (preserving global 16kb limit) and sync rate limit', async () => {
    const app = createApp({
      syncPushLimit: '8kb',
      rateLimit: { syncMax: 3, apiMax: 100 },
    });
    const { agent } = await registerCookieUser(app, 'Limit User', 'sync-limit@example.com');

    // Global 16kb limit still rejects oversized body on regular endpoints
    const oversizedWeight = await agent.post('/api/weights').send({
      date: '2026-11-26',
      weightKg: 75,
      note: 'x'.repeat(20_000),
    });
    expect(oversizedWeight.status).toBe(413);

    // Dedicated /api/sync limit rejects payloads larger than configured syncPushLimit (8kb here)
    const oversizedSync = await agent.post('/api/sync').send({
      mutations: [],
      padding: 'y'.repeat(10_000),
    });
    expect(oversizedSync.status).toBe(413);

    // Sync rate limit triggers 429 after syncMax (3) requests
    const r1 = await agent.get('/api/sync');
    const r2 = await agent.get('/api/sync');
    // Note: oversizedSync already counted as 1 request against /api/sync, so r1=2, r2=3, r3=4 -> 429
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const r3 = await agent.get('/api/sync');
    expect(r3.status).toBe(429);
  });
});
