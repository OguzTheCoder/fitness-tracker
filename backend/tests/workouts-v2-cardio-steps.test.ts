import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { CORE_EXERCISES } from '../src/modules/exercises/coreExercises.data.js';
import { getRollingDateRange } from '../src/utils/dateRange.js';
import { extractSessionToken } from './helpers/authCookie.js';

const app = createApp();

async function createAuthedUser(email: string, name = 'Test Kullanıcı') {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
  });
  return {
    token: extractSessionToken(res.headers['set-cookie']),
    userId: res.body.user.id as string,
  };
}

describe('Workouts v2, Templates, Exercises, Cardio & Steps (AUTH-12)', () => {
  beforeEach(async () => {
    await prisma.workoutSet.deleteMany();
    await prisma.workoutExercise.deleteMany();
    await prisma.workoutEntry.deleteMany();
    await prisma.workoutTemplateExercise.deleteMany();
    await prisma.workoutTemplate.deleteMany();
    await prisma.cardioEntry.deleteMany();
    await prisma.stepEntry.deleteMany();
    await prisma.exercise.deleteMany({ where: { isCore: false } });
    await prisma.calorieEntry.deleteMany();
    await prisma.nutritionLog.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('auto-seeds core exercises with muscle groups, filters properly, and isolates custom exercise CRUD', async () => {
    const userA = await createAuthedUser('ex-a@example.com', 'Kullanıcı A');
    const userB = await createAuthedUser('ex-b@example.com', 'Kullanıcı B');

    const unauth = await request(app).get('/api/exercises');
    expect(unauth.status).toBe(401);

    const coreList = await request(app)
      .get('/api/exercises?scope=core&limit=200')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(coreList.status).toBe(200);
    expect(coreList.body.exercises.length).toBe(CORE_EXERCISES.length);
    expect(coreList.body.muscleGroups).toContain('Göğüs');
    expect(coreList.body.muscleGroups).toContain('Bacak');

    const chestOnly = await request(app)
      .get('/api/exercises?muscleGroup=G%C3%B6%C4%9F%C3%BCs&q=bench')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(chestOnly.status).toBe(200);
    expect(chestOnly.body.exercises.length).toBeGreaterThanOrEqual(2);
    expect(chestOnly.body.exercises.every((e: { muscleGroup: string }) => e.muscleGroup === 'Göğüs')).toBe(
      true,
    );

    // Core exercises cannot be edited or deleted
    const coreId = coreList.body.exercises[0].id as string;
    const editCore = await request(app)
      .put(`/api/exercises/${coreId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Hack', muscleGroup: 'Göğüs' });
    expect(editCore.status).toBe(404);

    const deleteCore = await request(app)
      .delete(`/api/exercises/${coreId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(deleteCore.status).toBe(404);

    // Create custom exercise for A
    const created = await request(app)
      .post('/api/exercises')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Landmine Press',
        muscleGroup: 'Omuz',
        equipment: 'Barbell',
        isBodyweight: false,
      });
    expect(created.status).toBe(201);
    const customId = created.body.exercise.id as string;

    // User B cannot see, update, or delete User A's custom exercise
    const customListB = await request(app)
      .get('/api/exercises?scope=custom')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(customListB.body.exercises).toHaveLength(0);

    const updateByB = await request(app)
      .put(`/api/exercises/${customId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'B Hack', muscleGroup: 'Omuz' });
    expect(updateByB.status).toBe(404);

    const deleteByB = await request(app)
      .delete(`/api/exercises/${customId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteByB.status).toBe(404);

    // User A updates and deletes their custom exercise
    const updated = await request(app)
      .put(`/api/exercises/${customId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Single-Arm Landmine Press',
        muscleGroup: 'Omuz',
        equipment: 'Barbell',
        isBodyweight: false,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.exercise.name).toBe('Single-Arm Landmine Press');

    const deleted = await request(app)
      .delete(`/api/exercises/${customId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(deleted.status).toBe(200);
  });

  it('manages workout templates, detailed set/rep/weight workouts, and previous exercise performance reminders', async () => {
    const userA = await createAuthedUser('wk-a@example.com', 'Oğuz');
    const userB = await createAuthedUser('wk-b@example.com', 'Diğer');

    const exRes = await request(app)
      .get('/api/exercises?q=Bench%20Press')
      .set('Authorization', `Bearer ${userA.token}`);
    const benchId = exRes.body.exercises[0].id as string;

    // Create workout template with 1 catalog exercise + 1 free-text exercise
    const tplCreate = await request(app)
      .post('/api/workout-templates')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'İtiş Günü (Push)',
        description: 'Göğüs ve omuz odaklı',
        exercises: [
          { exerciseId: benchId, defaultSets: 3, defaultReps: 10, defaultWeightKg: 60 },
          { exerciseName: 'Band Pull-Apart', muscleGroup: 'Omuz', defaultSets: 2, defaultReps: 15 },
        ],
      });
    expect(tplCreate.status).toBe(201);
    const templateId = tplCreate.body.template.id as string;
    expect(tplCreate.body.template.exercises).toHaveLength(2);
    expect(tplCreate.body.template.exercises[0].exerciseName).toBe('Bench Press (Barbell)');

    // User B cannot access or use User A's template
    const getTplB = await request(app)
      .get(`/api/workout-templates/${templateId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getTplB.status).toBe(404);

    const workoutUsingOtherTpl = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        date: '2026-11-24',
        name: 'Kopya',
        durationMinutes: 40,
        templateId,
      });
    expect(workoutUsingOtherTpl.status).toBe(404);

    // User A logs first detailed workout from template
    const firstWk = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-11-20',
        name: 'İtiş Günü (Push)',
        durationMinutes: 50,
        templateId,
        exercises: [
          {
            exerciseId: benchId,
            sets: [
              { reps: 10, weightKg: 60 },
              { reps: 10, weightKg: 60 },
              { reps: 8, weightKg: 62.5 },
            ],
          },
          {
            exerciseName: 'Band Pull-Apart',
            muscleGroup: 'Omuz',
            sets: [
              { reps: 15, weightKg: null },
              { reps: 15 },
            ],
          },
        ],
      });
    expect(firstWk.status).toBe(201);
    expect(firstWk.body.entry.exercises).toHaveLength(2);
    expect(firstWk.body.entry.exercises[0].sets).toHaveLength(3);
    expect(firstWk.body.entry.exercises[1].sets[0].weightKg).toBeNull();

    // User A logs a newer workout on 2026-11-24 with higher weight
    const secondWk = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-11-24',
        name: 'İtiş Günü #2',
        durationMinutes: 55,
        exercises: [
          {
            exerciseId: benchId,
            sets: [
              { reps: 10, weightKg: 65 },
              { reps: 9, weightKg: 65 },
            ],
          },
        ],
      });
    expect(secondWk.status).toBe(201);
    const secondWkId = secondWk.body.entry.id as string;

    // User B logs a workout with 120 kg on Bench Press — must NOT leak to User A!
    await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        date: '2026-11-25',
        name: 'B İtiş',
        durationMinutes: 45,
        exercises: [{ exerciseId: benchId, sets: [{ reps: 5, weightKg: 120 }] }],
      });

    // Previous performance query returns User A's latest (2026-11-24 for bench, 2026-11-20 for Band Pull-Apart)
    const prevLatest = await request(app)
      .get(
        `/api/workouts/previous?exerciseIds=${encodeURIComponent(benchId)}&exerciseNames=${encodeURIComponent('band pull-apart')}`,
      )
      .set('Authorization', `Bearer ${userA.token}`);
    expect(prevLatest.status).toBe(200);
    expect(prevLatest.body.byExerciseId[benchId]).toMatchObject({
      date: '2026-11-24',
      sets: [
        { setNumber: 1, reps: 10, weightKg: 65 },
        { setNumber: 2, reps: 9, weightKg: 65 },
      ],
    });
    expect(prevLatest.body.byExerciseName['band pull-apart']).toMatchObject({
      date: '2026-11-20',
      sets: [
        { setNumber: 1, reps: 15, weightKg: null },
        { setNumber: 2, reps: 15, weightKg: null },
      ],
    });

    // Excluding secondWkId or using beforeDate=2026-11-24 returns 2026-11-20
    const prevBefore = await request(app)
      .get(
        `/api/workouts/previous?exerciseIds=${encodeURIComponent(benchId)}&beforeDate=2026-11-24&excludeWorkoutId=${secondWkId}`,
      )
      .set('Authorization', `Bearer ${userA.token}`);
    expect(prevBefore.status).toBe(200);
    expect(prevBefore.body.byExerciseId[benchId].date).toBe('2026-11-20');

    // Update template and delete template
    const tplUpdate = await request(app)
      .put(`/api/workout-templates/${templateId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'İtiş Günü v2',
        exercises: [{ exerciseId: benchId, defaultSets: 4, defaultReps: 8, defaultWeightKg: 65 }],
      });
    expect(tplUpdate.status).toBe(200);
    expect(tplUpdate.body.template.exercises).toHaveLength(1);

    const tplDelete = await request(app)
      .delete(`/api/workout-templates/${templateId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(tplDelete.status).toBe(200);
  });

  it('tracks cardio independently of nutrition calories and supports daily step upsert with profile goal', async () => {
    const userA = await createAuthedUser('cardio-a@example.com', 'Oğuz');
    const userB = await createAuthedUser('cardio-b@example.com', 'Diğer');
    const today = getRollingDateRange(1).to;
    const yesterday = getRollingDateRange(2).from;

    // Update User A's step goal to 10000
    const profRes = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ dailyStepGoal: 10000 });
    expect(profRes.status).toBe(200);

    // Log nutrition meal for today (1500 kcal)
    await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: today, mealName: 'Öğle', calories: 1500 });

    // Log cardio with 400 caloriesBurned
    const cardioCreate = await request(app)
      .post('/api/cardio')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: today,
        cardioType: 'Koşu',
        durationMinutes: 35,
        distanceKm: 5.2,
        caloriesBurned: 400,
        note: 'Parkur',
      });
    expect(cardioCreate.status).toBe(201);
    const cardioId = cardioCreate.body.entry.id as string;

    // User B cannot update/delete User A's cardio
    const cardioDelB = await request(app)
      .delete(`/api/cardio/${cardioId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(cardioDelB.status).toBe(404);

    // Upsert steps: first create (201), second same date updates (200)
    const stepCreate = await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: today, steps: 6500, note: 'Sabah' });
    expect(stepCreate.status).toBe(201);
    expect(stepCreate.body.updated).toBe(false);

    const stepUpsert = await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: today, steps: 10500, note: 'Akşam eklendi' });
    expect(stepUpsert.status).toBe(200);
    expect(stepUpsert.body.updated).toBe(true);
    expect(stepUpsert.body.entry.steps).toBe(10500);

    await request(app)
      .post('/api/steps')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: yesterday, steps: 7500 });

    // Verify /api/steps summary respects custom dailyStepGoal (10000)
    const stepsList = await request(app)
      .get('/api/steps')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(stepsList.status).toBe(200);
    expect(stepsList.body.entries).toHaveLength(2);
    expect(stepsList.body.summary).toMatchObject({
      dailyStepGoal: 10000,
      todaySteps: 10500,
      todayProgressPercent: 105,
      totalSteps: 18000,
      averageDailySteps: 9000,
      daysLogged: 2,
      goalMetDays: 1,
    });

    // User B defaults to 8000 step goal and sees zero entries from User A
    const stepsListB = await request(app)
      .get('/api/steps')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(stepsListB.body.entries).toHaveLength(0);
    expect(stepsListB.body.summary.dailyStepGoal).toBe(8000);

    // Verify /api/stats/summary reflects cardio & steps while keeping nutrition calories independent of cardio caloriesBurned
    const statsRes = await request(app)
      .get('/api/stats/summary?days=7')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.summary).toMatchObject({
      todayCalories: 1500,
      averageDailyCalories: 1500,
      cardioCount: 1,
      cardioDurationMinutes: 35,
      cardioDistanceKm: 5.2,
      cardioCaloriesBurned: 400,
      todaySteps: 10500,
      dailyStepGoal: 10000,
      averageDailySteps: 9000,
      stepDaysLogged: 2,
    });
    expect(statsRes.body.trends.steps).toEqual([
      { date: yesterday, value: 7500 },
      { date: today, value: 10500 },
    ]);
  });

  it('enforces pagination upper bounds across all new list endpoints', async () => {
    const { token } = await createAuthedUser('limits@example.com');

    const badExerciseLimit = await request(app)
      .get('/api/exercises?limit=201')
      .set('Authorization', `Bearer ${token}`);
    expect(badExerciseLimit.status).toBe(400);

    const badTemplateLimit = await request(app)
      .get('/api/workout-templates?limit=101')
      .set('Authorization', `Bearer ${token}`);
    expect(badTemplateLimit.status).toBe(400);

    const badCardioLimit = await request(app)
      .get('/api/cardio?limit=367')
      .set('Authorization', `Bearer ${token}`);
    expect(badCardioLimit.status).toBe(400);

    const badStepsLimit = await request(app)
      .get('/api/steps?limit=367')
      .set('Authorization', `Bearer ${token}`);
    expect(badStepsLimit.status).toBe(400);

    const badNegativeOffset = await request(app)
      .get('/api/cardio?offset=-1')
      .set('Authorization', `Bearer ${token}`);
    expect(badNegativeOffset.status).toBe(400);
  });
});
