import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { getRollingDateRange } from '../src/utils/dateRange.js';

const app = createApp();

async function createAuthedUser(email: string, name = 'Test Kullanıcı') {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
  });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

function isoDaysAgo(daysAgo: number): string {
  return getRollingDateRange(daysAgo + 1).from;
}

describe('Stats Summary & Faz 2 E2E Integration (/api/stats/summary)', () => {
  beforeEach(async () => {
    await prisma.workoutSet.deleteMany();
    await prisma.workoutExercise.deleteMany();
    await prisma.workoutEntry.deleteMany();
    await prisma.cardioEntry.deleteMany();
    await prisma.stepEntry.deleteMany();
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

  it('rejects unauthenticated requests (401) and invalid days param (400)', async () => {
    const unauth = await request(app).get('/api/stats/summary');
    expect(unauth.status).toBe(401);

    const { token } = await createAuthedUser('oguz@example.com');
    const badDays = await request(app)
      .get('/api/stats/summary?days=14')
      .set('Authorization', `Bearer ${token}`);
    expect(badDays.status).toBe(400);
  });

  it('returns clean empty summary for a user with no fitness entries', async () => {
    const { token } = await createAuthedUser('empty@example.com');
    const res = await request(app)
      .get('/api/stats/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.period.days).toBe(7);
    expect(res.body.summary).toEqual({
      latestWeightKg: null,
      latestWeightDate: null,
      weightChangeKg: null,
      todayCalories: 0,
      averageDailyCalories: 0,
      calorieDaysLogged: 0,
      workoutCount: 0,
      workoutDurationMinutes: 0,
      cardioCount: 0,
      cardioDurationMinutes: 0,
      cardioDistanceKm: 0,
      cardioCaloriesBurned: 0,
      todaySteps: 0,
      dailyStepGoal: 8000,
      averageDailySteps: 0,
      stepDaysLogged: 0,
    });
    expect(res.body.trends).toEqual({ weights: [], calories: [], steps: [] });
  });

  it('aggregates full Faz 2 user flow across 7d and 30d windows with strict user isolation', async () => {
    const userA = await createAuthedUser('a@example.com', 'Oğuz');
    const userB = await createAuthedUser('b@example.com', 'Diğer Kullanıcı');

    const today = isoDaysAgo(0);
    const twoDaysAgo = isoDaysAgo(2);
    const fifteenDaysAgo = isoDaysAgo(15);

    // Weights: 15 days ago (81.0), 2 days ago (79.5), today (78.8 -> upserted to 78.5)
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: fifteenDaysAgo, weightKg: 81.0 });
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: twoDaysAgo, weightKg: 79.5 });
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: today, weightKg: 78.8 });
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: today, weightKg: 78.5 });

    // Calories: 15 days ago (2200), 2 days ago (1800), today (500 + 700 = 1200)
    for (const meal of [
      { date: fifteenDaysAgo, mealName: 'Eski gün', calories: 2200 },
      { date: twoDaysAgo, mealName: 'Öğün', calories: 1800 },
      { date: today, mealName: 'Kahvaltı', calories: 500 },
      { date: today, mealName: 'Öğle', calories: 700 },
    ]) {
      await request(app)
        .post('/api/calories')
        .set('Authorization', `Bearer ${userA.token}`)
        .send(meal);
    }

    // Workouts: 15 days ago (60 dk), 2 days ago (45 dk), today (30 dk)
    for (const workout of [
      { date: fifteenDaysAgo, name: 'Eski koşu', durationMinutes: 60 },
      { date: twoDaysAgo, name: 'Ağırlık', durationMinutes: 45 },
      { date: today, name: 'Koşu', durationMinutes: 30 },
    ]) {
      await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${userA.token}`)
        .send(workout);
    }

    // Noise from User B must not affect User A
    await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: today, weightKg: 110 });
    await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: today, mealName: 'B öğünü', calories: 4000 });
    await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: today, name: 'B antrenmanı', durationMinutes: 120 });

    // 7-day window excludes 15-days-ago entries
    const res7 = await request(app)
      .get('/api/stats/summary?days=7')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res7.status).toBe(200);
    expect(res7.body.summary).toEqual({
      latestWeightKg: 78.5,
      latestWeightDate: today,
      weightChangeKg: -1,
      todayCalories: 1200,
      averageDailyCalories: 1500,
      calorieDaysLogged: 2,
      workoutCount: 2,
      workoutDurationMinutes: 75,
      cardioCount: 0,
      cardioDurationMinutes: 0,
      cardioDistanceKm: 0,
      cardioCaloriesBurned: 0,
      todaySteps: 0,
      dailyStepGoal: 8000,
      averageDailySteps: 0,
      stepDaysLogged: 0,
    });
    expect(res7.body.trends.weights).toEqual([
      { date: twoDaysAgo, value: 79.5 },
      { date: today, value: 78.5 },
    ]);
    expect(res7.body.trends.calories).toEqual([
      { date: twoDaysAgo, value: 1800 },
      { date: today, value: 1200 },
    ]);

    // 30-day window includes 15-days-ago entries
    const res30 = await request(app)
      .get('/api/stats/summary?days=30')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res30.status).toBe(200);
    expect(res30.body.summary).toEqual({
      latestWeightKg: 78.5,
      latestWeightDate: today,
      weightChangeKg: -2.5,
      todayCalories: 1200,
      averageDailyCalories: 1733,
      calorieDaysLogged: 3,
      workoutCount: 3,
      workoutDurationMinutes: 135,
      cardioCount: 0,
      cardioDurationMinutes: 0,
      cardioDistanceKm: 0,
      cardioCaloriesBurned: 0,
      todaySteps: 0,
      dailyStepGoal: 8000,
      averageDailySteps: 0,
      stepDaysLogged: 0,
    });
    expect(res30.body.trends.weights).toHaveLength(3);
    expect(res30.body.trends.calories).toHaveLength(3);
  });
});
