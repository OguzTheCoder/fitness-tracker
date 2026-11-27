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

describe('Calories API Integration (/api/calories)', () => {
  beforeEach(async () => {
    await prisma.calorieEntry.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const getRes = await request(app).get('/api/calories');
    const postRes = await request(app)
      .post('/api/calories')
      .send({ date: '2026-11-26', mealName: 'Kahvaltı', calories: 450 });

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
  });

  it('creates multiple same-day meals and returns grouped dailyTotals with from/to filtering', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    for (const item of [
      { date: '2026-11-24', mealName: 'Akşam - Izgara tavuk', calories: 620 },
      { date: '2026-11-26', mealName: 'Kahvaltı - Yulaf & yumurta', calories: 450 },
      { date: '2026-11-26', mealName: 'Öğle - Mercimek çorbası', calories: 380 },
    ]) {
      const res = await request(app)
        .post('/api/calories')
        .set('Authorization', `Bearer ${token}`)
        .send(item);
      expect(res.status).toBe(201);
    }

    const listRes = await request(app)
      .get('/api/calories')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.entries).toHaveLength(3);
    expect(listRes.body.dailyTotals).toEqual([
      { date: '2026-11-26', totalCalories: 830, count: 2 },
      { date: '2026-11-24', totalCalories: 620, count: 1 },
    ]);

    const filteredRes = await request(app)
      .get('/api/calories?from=2026-11-25&to=2026-11-26')
      .set('Authorization', `Bearer ${token}`);

    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.entries).toHaveLength(2);
    expect(filteredRes.body.dailyTotals).toEqual([
      { date: '2026-11-26', totalCalories: 830, count: 2 },
    ]);
  });

  it('rejects invalid input and reversed date range with 400', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    const badPayload = await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-02-30', mealName: '   ', calories: 0 });

    expect(badPayload.status).toBe(400);
    expect(badPayload.body.details.date).toBeDefined();
    expect(badPayload.body.details.mealName).toBeDefined();
    expect(badPayload.body.details.calories).toBeDefined();

    const decimalCalories = await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-11-26', mealName: 'Kahve', calories: 12.5 });
    expect(decimalCalories.status).toBe(400);

    const badRange = await request(app)
      .get('/api/calories?from=2026-11-26&to=2026-11-20')
      .set('Authorization', `Bearer ${token}`);
    expect(badRange.status).toBe(400);
  });

  it('updates and deletes entries while enforcing user ownership isolation', async () => {
    const userA = await createAuthedUser('a@example.com', 'Kullanıcı A');
    const userB = await createAuthedUser('b@example.com', 'Kullanıcı B');

    const created = await request(app)
      .post('/api/calories')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-26', mealName: 'Ara öğün - Muz', calories: 110 });

    const entryId = created.body.entry.id as string;

    // User B cannot view, edit, or delete User A's entry
    const listB = await request(app)
      .get('/api/calories')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(listB.body.entries).toHaveLength(0);

    const updateByB = await request(app)
      .put(`/api/calories/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: '2026-11-26', mealName: 'Hack', calories: 500 });
    expect(updateByB.status).toBe(404);

    const deleteByB = await request(app)
      .delete(`/api/calories/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteByB.status).toBe(404);

    // User A updates entry
    const updateRes = await request(app)
      .put(`/api/calories/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-26', mealName: 'Ara öğün - Muz ve badem', calories: 220 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.entry).toMatchObject({
      mealName: 'Ara öğün - Muz ve badem',
      calories: 220,
    });

    // User A deletes entry, second delete returns 404
    const deleteRes = await request(app)
      .delete(`/api/calories/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(deleteRes.status).toBe(200);

    const repeatDelete = await request(app)
      .delete(`/api/calories/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(repeatDelete.status).toBe(404);
  });
});
