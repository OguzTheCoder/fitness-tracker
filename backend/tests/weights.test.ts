import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const app = createApp();

async function createAuthedUser(email: string, name = 'Test Kullanıcı') {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
  });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

describe('Weights API Integration (/api/weights)', () => {
  beforeEach(async () => {
    await prisma.weightEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const getRes = await request(app).get('/api/weights');
    const postRes = await request(app)
      .post('/api/weights')
      .send({ date: '2026-11-26', weightKg: 78.5 });

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
  });

  it('creates a new weight entry (201) and upserts same-day entry (200)', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    const createRes = await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-11-26', weightKg: 78.46, note: 'Sabah aç karnına' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.updated).toBe(false);
    expect(createRes.body.entry).toMatchObject({
      date: '2026-11-26',
      weightKg: 78.5,
      note: 'Sabah aç karnına',
    });

    const upsertRes = await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-11-26', weightKg: 78.1, note: 'Akşam güncelleme' });

    expect(upsertRes.status).toBe(200);
    expect(upsertRes.body.updated).toBe(true);
    expect(upsertRes.body.entry.id).toBe(createRes.body.entry.id);
    expect(upsertRes.body.entry).toMatchObject({
      date: '2026-11-26',
      weightKg: 78.1,
      note: 'Akşam güncelleme',
    });

    const listRes = await request(app)
      .get('/api/weights')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.entries).toHaveLength(1);
  });

  it('lists entries newest-first and supports from/to date range filtering', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    for (const item of [
      { date: '2026-11-20', weightKg: 80 },
      { date: '2026-11-24', weightKg: 79.2 },
      { date: '2026-11-26', weightKg: 78.6 },
    ]) {
      await request(app)
        .post('/api/weights')
        .set('Authorization', `Bearer ${token}`)
        .send(item);
    }

    const allRes = await request(app)
      .get('/api/weights')
      .set('Authorization', `Bearer ${token}`);
    expect(allRes.status).toBe(200);
    expect(allRes.body.entries.map((e: { date: string }) => e.date)).toEqual([
      '2026-11-26',
      '2026-11-24',
      '2026-11-20',
    ]);

    const filteredRes = await request(app)
      .get('/api/weights?from=2026-11-21&to=2026-11-25')
      .set('Authorization', `Bearer ${token}`);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.entries.map((e: { date: string }) => e.date)).toEqual(['2026-11-24']);
  });

  it('rejects invalid dates, out-of-range weights, and reversed date range with 400', async () => {
    const { token } = await createAuthedUser('oguz@example.com');

    const badPayload = await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-02-30', weightKg: 10 });
    expect(badPayload.status).toBe(400);
    expect(badPayload.body.details.date).toBeDefined();
    expect(badPayload.body.details.weightKg).toBeDefined();

    const badRange = await request(app)
      .get('/api/weights?from=2026-11-26&to=2026-11-20')
      .set('Authorization', `Bearer ${token}`);
    expect(badRange.status).toBe(400);
  });

  it('updates and deletes entries while enforcing ownership isolation and date uniqueness', async () => {
    const userA = await createAuthedUser('a@example.com', 'Kullanıcı A');
    const userB = await createAuthedUser('b@example.com', 'Kullanıcı B');

    const first = await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-25', weightKg: 79.0 });
    const second = await request(app)
      .post('/api/weights')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-26', weightKg: 78.5 });

    const entryId = second.body.entry.id as string;

    // User B cannot see, update, or delete User A's entries
    const listB = await request(app)
      .get('/api/weights')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(listB.body.entries).toHaveLength(0);

    const updateByB = await request(app)
      .put(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ date: '2026-11-26', weightKg: 70 });
    expect(updateByB.status).toBe(404);

    const deleteByB = await request(app)
      .delete(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteByB.status).toBe(404);

    // Updating to an existing date of same user returns 409
    const conflictRes = await request(app)
      .put(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: first.body.entry.date, weightKg: 78.0 });
    expect(conflictRes.status).toBe(409);

    // Valid update succeeds
    const updateRes = await request(app)
      .put(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ date: '2026-11-27', weightKg: 78.2, note: 'Düzenlendi' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.entry).toMatchObject({
      date: '2026-11-27',
      weightKg: 78.2,
      note: 'Düzenlendi',
    });

    // Valid delete succeeds, second delete returns 404
    const deleteRes = await request(app)
      .delete(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(deleteRes.status).toBe(200);

    const repeatDelete = await request(app)
      .delete(`/api/weights/${entryId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(repeatDelete.status).toBe(404);
  });
});
