import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import {
  ConsoleMailProvider,
  getMailProvider,
  MemoryMailProvider,
  setMailProvider,
} from '../src/config/mail.js';
import { prisma } from '../src/config/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const app = createApp();
const mailProvider = new MemoryMailProvider();

describe('Security Hardening Suite (AUTH-8 / v1.0.1)', () => {
  beforeEach(async () => {
    setMailProvider(mailProvider);
    mailProvider.clear();
    await prisma.workoutEntry.deleteMany();
    await prisma.calorieEntry.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('G-004 & G-008: sets Helmet security headers, Referrer-Policy: no-referrer, and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('G-001: enforces account-based, IP-based, and general API rate limits with 429', async () => {
    const strictApp = createApp({
      rateLimit: {
        windowMs: 60_000,
        authAccountMax: 2,
        authIpMax: 4,
        apiMax: 6,
      },
    });

    // 2 attempts for target@example.com pass limiter (401 auth failure), 3rd is rate-limited (429)
    for (let i = 0; i < 2; i += 1) {
      const attempt = await request(strictApp).post('/api/auth/login').send({
        email: 'Target@Example.com',
        password: 'WrongPassword1!',
      });
      expect(attempt.status).toBe(401);
    }

    const blockedAccount = await request(strictApp).post('/api/auth/login').send({
      email: 'target@example.com',
      password: 'WrongPassword1!',
    });
    expect(blockedAccount.status).toBe(429);
    expect(blockedAccount.headers['ratelimit']).toBeDefined();

    // Different email still works on 4th IP hit, then 5th IP hit triggers authIpLimiter (429)
    const fourthIpAttempt = await request(strictApp).post('/api/auth/login').send({
      email: 'other1@example.com',
      password: 'WrongPassword1!',
    });
    expect(fourthIpAttempt.status).toBe(401);

    const fifthIpBlocked = await request(strictApp).post('/api/auth/login').send({
      email: 'other2@example.com',
      password: 'WrongPassword1!',
    });
    expect(fifthIpBlocked.status).toBe(429);

    // 6th general API request (/api/health) succeeds, 7th hits apiMax=6 -> 429
    const sixthApi = await request(strictApp).get('/api/health');
    expect(sixthApi.status).toBe(200);

    const seventhApi = await request(strictApp).get('/api/health');
    expect(seventhApi.status).toBe(429);
  });

  it('G-002: invalidates existing JWTs immediately when password is reset (tokenVersion)', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Oğuz',
      email: 'oguz@example.com',
      password: 'InitialPassword123!',
    });
    const oldToken = registerRes.body.token as string;

    const beforeResetMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(beforeResetMe.status).toBe(200);

    await request(app).post('/api/auth/forgot-password').send({ email: 'oguz@example.com' });
    const { resetToken } = mailProvider.sent[0];

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      password: 'UpdatedPassword456!',
    });
    expect(resetRes.status).toBe(200);

    const revokedMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    const revokedWeights = await request(app)
      .get('/api/weights')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(revokedMe.status).toBe(401);
    expect(revokedWeights.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({
      email: 'oguz@example.com',
      password: 'UpdatedPassword456!',
    });
    expect(newLogin.status).toBe(200);

    const activeMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newLogin.body.token}`);
    expect(activeMe.status).toBe(200);
  });

  it('G-003: blocks ConsoleMailProvider in production environment', () => {
    expect(() => new ConsoleMailProvider('production')).toThrow(/ConsoleMailProvider/);

    setMailProvider(null);
    expect(() => getMailProvider('production')).toThrow(/ConsoleMailProvider/);
    setMailProvider(mailProvider);
  });

  it('G-006: prevents TOCTOU race condition on concurrent password reset requests', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Oğuz',
      email: 'race@example.com',
      password: 'OldPassword123!',
    });

    await request(app).post('/api/auth/forgot-password').send({ email: 'race@example.com' });
    const { resetToken } = mailProvider.sent[0];

    const [first, second] = await Promise.all([
      request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'ConcurrentPasswordA1!',
      }),
      request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'ConcurrentPasswordB2!',
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { email: 'race@example.com' } });
    expect(updatedUser.tokenVersion).toBe(1);
  });

  it('G-007: enforces 16kb JSON body limit (413), 72-char login password max (400), and list pagination', async () => {
    const oversizedNote = 'x'.repeat(20 * 1024);
    const largeRes = await request(app).post('/api/auth/login').send({
      email: 'oguz@example.com',
      password: 'short',
      extra: oversizedNote,
    });
    expect(largeRes.status).toBe(413);

    const longPasswordRes = await request(app).post('/api/auth/login').send({
      email: 'oguz@example.com',
      password: 'A'.repeat(73),
    });
    expect(longPasswordRes.status).toBe(400);

    const reg = await request(app).post('/api/auth/register').send({
      name: 'Oğuz',
      email: 'paging@example.com',
      password: 'Password123!',
    });
    const token = reg.body.token as string;

    for (const day of ['2026-11-20', '2026-11-21', '2026-11-22']) {
      await request(app)
        .post('/api/weights')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: day, weightKg: 80 });
    }

    const pagedWeights = await request(app)
      .get('/api/weights?limit=2&offset=1')
      .set('Authorization', `Bearer ${token}`);
    expect(pagedWeights.status).toBe(200);
    expect(pagedWeights.body.entries).toHaveLength(2);
    expect(pagedWeights.body.entries.map((e: { date: string }) => e.date)).toEqual([
      '2026-11-21',
      '2026-11-20',
    ]);

    const excessiveLimit = await request(app)
      .get('/api/calories?limit=500')
      .set('Authorization', `Bearer ${token}`);
    expect(excessiveLimit.status).toBe(400);
  });

  it('G-009: runs bcrypt.compare even when login email does not exist', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare');

    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent-user@example.com',
      password: 'SomePassword123!',
    });

    expect(res.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });

  it('G-010 & R-003: pins JWT algorithm to HS256, enforces >=32-char secret, and ignores key/sqlite patterns', async () => {
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);

    const reg = await request(app).post('/api/auth/register').send({
      name: 'Oğuz',
      email: 'jwt@example.com',
      password: 'Password123!',
    });
    const userId = reg.body.user.id as string;

    const hs384Token = jwt.sign(
      { email: 'jwt@example.com', tv: 0 },
      env.JWT_SECRET,
      { algorithm: 'HS384', subject: userId, expiresIn: '1h' },
    );
    const missingTvToken = jwt.sign(
      { email: 'jwt@example.com' },
      env.JWT_SECRET,
      { algorithm: 'HS256', subject: userId, expiresIn: '1h' },
    );

    const hs384Res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${hs384Token}`);
    const missingTvRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${missingTvToken}`);

    expect(hs384Res.status).toBe(401);
    expect(missingTvRes.status).toBe(401);

    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    for (const pattern of ['*.pem', '*.key', '*.sqlite', '*.sqlite3']) {
      expect(gitignore).toContain(pattern);
    }
  });
});
