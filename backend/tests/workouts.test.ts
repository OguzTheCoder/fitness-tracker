import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
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

describe('Workouts API Integration (/api/workouts)', () => {
  beforeEach(async () => {
    await prisma.workoutEntry.deleteMany();
    await prisma.calorieEntry.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const getRes = await request(app).get('/api/workouts');
    const postRes = await request(app)
      .post('/api/workouts')
      .send({ date: '2026-11-26', name: 'Koşu', durationMinutes: 30 });

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
  });

  it('creates workout entries, returns summary totals, and supports from/to filtering', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    for (const item of [
      { date: '2026-11-22', name: 'Tempolu Koşu', durationMinutes: 35, note: '5 km parkur' },
      { date: '2026-11-26', name: 'Üst Vücut Ağırlık', durationMinutes: 50, note: 'Bench 3x10' },
      { date: '2026-11-26', name: 'Esneme', durationMinutes: 15 },
    ]) {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send(item);
      expect(res.status).toBe(201);
    }

    const allRes = await request(app)
      .get('/api/workouts')
      .set('Authorization', `Bearer ${token}`);

    expect(allRes.status).toBe(200);
    expect(allRes.body.entries).toHaveLength(3);
    expect(allRes.body.summary).toEqual({
      totalCount: 3,
      totalDurationMinutes: 100,
    });

    const filteredRes = await request(app)
      .get('/api/workouts?from=2026-11-25&to=2026-11-26')
      .set('Authorization', `Bearer ${token}`);

    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.entries).toHaveLength(2);
    expect(filteredRes.body.summary).toEqual({
      totalCount: 2,
      totalDurationMinutes: 65,
    });
  });

  it('rejects invalid input and reversed date range with 400', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    const badPayload = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-02-30', name: '   ', durationMinutes: 0 });

    expect(badPayload.status).toBe(400);
    expect(badPayload.body.details.date).toBeDefined();
    expect(badPayload.body.details.name).toBeDefined();
    expect(badPayload.body.details.durationMinutes).toBeDefined();

    const decimalDuration = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-11-26', name: 'Koşu', durationMinutes: 25.5 });
    expect(decimalDuration.status).toBe(400);

    const badRange = await request(app)
      .get('/api/workouts?from=2026-11-26&to=2026-11-20')
      .set('Authorization', `Bearer ${token}`);
    expect(badRange.status).toBe(400);
  });

  it('updates and deletes entries while enforcing user ownership isolation', async () => {
    const userA = await createAuthedUser('a@example.com', 'Kullanıcı A');
    const userB = await createAuthedUser('b@example.com', 'Kullanıcı B');

    const created = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-26', name: 'Bacak Antrenmanı', durationMinutes: 45, note: 'Squat' });

    const entryId = created.body.entry.id as string;

    const listB = await request(app)
      .get('/api/workouts')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(listB.body.entries).toHaveLength(0);

    const updateByB = await request(app)
      .put(`/api/workouts/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: '2026-11-26', name: 'Hack', durationMinutes: 10 });
    expect(updateByB.status).toBe(404);

    const deleteByB = await request(app)
      .delete(`/api/workouts/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteByB.status).toBe(404);

    const updateRes = await request(app)
      .put(`/api/workouts/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-11-26',
        name: 'Bacak & Core',
        durationMinutes: 60,
        note: 'Squat + Plank',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.entry).toMatchObject({
      name: 'Bacak & Core',
      durationMinutes: 60,
      note: 'Squat + Plank',
    });

    const deleteRes = await request(app)
      .delete(`/api/workouts/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(deleteRes.status).toBe(200);

    const repeatDelete = await request(app)
      .delete(`/api/workouts/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(repeatDelete.status).toBe(404);
  });
});
