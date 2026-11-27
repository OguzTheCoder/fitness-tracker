import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env, parseEnv } from '../src/config/env.js';
import {
  ConsoleMailProvider,
  getMailProvider,
  MemoryMailProvider,
  setMailProvider,
} from '../src/config/mail.js';
import { prisma } from '../src/config/prisma.js';
import { PERSONAL_PIN_ATTEMPT_SCOPE } from '../src/modules/access/access.constants.js';
import { extractSessionCookieHeader, extractSessionToken } from './helpers/authCookie.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const app = createApp();
const mailProvider = new MemoryMailProvider();

const STRONG_PROD_SECRET = '9f3c7e1a5b8d2f406c9e1a3b7d5f8024c6e8a0b2d4f6081a3c5e7b9d0f2a4c6e';
const BASE_PROD_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/fitness',
  JWT_SECRET: STRONG_PROD_SECRET,
  APP_PIN: '83947261',
};

describe('Security Hardening Suite (v1.0.1 & v2.0.1)', () => {
  beforeEach(async () => {
    setMailProvider(mailProvider);
    mailProvider.clear();
    await prisma.accessAttemptState.deleteMany();
    await prisma.workoutEntry.deleteMany();
    await prisma.calorieEntry.deleteMany();
    await prisma.weightEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sets Helmet security headers, Referrer-Policy: no-referrer, and hides X-Powered-By', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('enforces account-based, IP-based, and general API rate limits with 429', async () => {
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

  it('invalidates existing JWTs immediately when password is reset (tokenVersion)', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      name: 'Oğuz',
      email: 'oguz@example.com',
      password: 'InitialPassword123!',
    });
    expect(registerRes.body.token).toBeUndefined();
    const oldToken = extractSessionToken(registerRes.headers['set-cookie']);

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
    expect(newLogin.body.token).toBeUndefined();

    const activeMe = await request(app)
      .get('/api/auth/me')
      .set('Cookie', extractSessionCookieHeader(newLogin.headers['set-cookie']));
    expect(activeMe.status).toBe(200);
  });

  it('blocks ConsoleMailProvider in production environment', () => {
    expect(() => new ConsoleMailProvider('production')).toThrow(/ConsoleMailProvider/);

    setMailProvider(null);
    expect(() => getMailProvider('production')).toThrow(/ConsoleMailProvider/);
    setMailProvider(mailProvider);
  });

  it('prevents TOCTOU race condition on concurrent password reset requests', async () => {
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

  it('enforces 16kb JSON body limit (413), 72-char login password max (400), and list pagination', async () => {
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
    const token = extractSessionToken(reg.headers['set-cookie']);

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

  it('runs bcrypt.compare even when login email does not exist', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare');

    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent-user@example.com',
      password: 'SomePassword123!',
    });

    expect(res.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });

  it('pins JWT algorithm to HS256, enforces >=32-char secret, and ignores key/sqlite patterns', async () => {
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

  it('fails fast when APP_PIN is empty in production, disables /local-session in production, and rate-limits /local-session locally', async () => {
    expect(() =>
      parseEnv({
        ...BASE_PROD_ENV,
        APP_PIN: '',
      }),
    ).toThrow(/APP_PIN zorunludur/);

    expect(() =>
      parseEnv({
        ...BASE_PROD_ENV,
        APP_PIN: undefined,
      }),
    ).toThrow(/APP_PIN zorunludur/);

    // Production runtime always blocks /api/access/local-session even if appPin override is null
    const prodApp = createApp({ appPin: null, nodeEnv: 'production' });
    const prodLocalRes = await request(prodApp).post('/api/access/local-session');
    expect(prodLocalRes.status).toBe(403);

    // Local development still allows /local-session, but enforces AUTH_WRITE_PATHS rate limit
    const localLimitedApp = createApp({
      appPin: null,
      nodeEnv: 'development',
      rateLimit: { windowMs: 60_000, authIpMax: 2, authAccountMax: 2, apiMax: 20 },
    });
    const setupRes = await request(localLimitedApp)
      .post('/api/access/setup')
      .send({ name: 'Yerel Kullanıcı' });
    expect(setupRes.status).toBe(201);

    const resume1 = await request(localLimitedApp).post('/api/access/local-session');
    expect(resume1.status).toBe(200);

    // 3rd auth write request (setup + resume1 + resume2) hits authIpMax=2 -> 429
    const resume2 = await request(localLimitedApp).post('/api/access/local-session');
    expect(resume2.status).toBe(429);
  });

  it('blocks public auth endpoints in PIN mode by default, reserves personal@local.fitness, and omits raw token from JSON', async () => {
    const pinApp = createApp({ appPin: '83947261' });

    const setupRes = await request(pinApp)
      .post('/api/access/setup')
      .send({ name: 'Oğuz', pin: '83947261' });
    expect(setupRes.status).toBe(201);
    const pinCookie = extractSessionCookieHeader(setupRes.headers['set-cookie']);

    // Classic public auth endpoints are disabled (403) when APP_PIN is active
    const regBlocked = await request(pinApp).post('/api/auth/register').send({
      name: 'Saldırgan',
      email: 'spam@example.com',
      password: 'Password123!',
    });
    const loginBlocked = await request(pinApp).post('/api/auth/login').send({
      email: 'spam@example.com',
      password: 'Password123!',
    });
    const forgotBlocked = await request(pinApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'spam@example.com' });
    const resetBlocked = await request(pinApp).post('/api/auth/reset-password').send({
      token: 'some-token',
      password: 'NewPassword123!',
    });

    expect(regBlocked.status).toBe(403);
    expect(loginBlocked.status).toBe(403);
    expect(forgotBlocked.status).toBe(403);
    expect(resetBlocked.status).toBe(403);

    // Session lifecycle endpoints remain functional for PIN users
    const meOk = await request(pinApp).get('/api/auth/me').set('Cookie', pinCookie);
    expect(meOk.status).toBe(200);
    const logoutOk = await request(pinApp).post('/api/auth/logout').set('Cookie', pinCookie);
    expect(logoutOk.status).toBe(200);

    // Even when public auth is explicitly enabled, personal@local.fitness cannot be registered, logged in, or reset
    const publicEnabledApp = createApp({ appPin: '83947261', allowPublicAuth: true });
    const reservedReg = await request(publicEnabledApp).post('/api/auth/register').send({
      name: 'Sahte Sahip',
      email: 'PERSONAL@local.fitness',
      password: 'Password123!',
    });
    expect(reservedReg.status).toBe(403);

    const compareSpy = vi.spyOn(bcrypt, 'compare');
    const reservedLogin = await request(publicEnabledApp).post('/api/auth/login').send({
      email: 'personal@local.fitness',
      password: 'Password123!',
    });
    expect(reservedLogin.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();

    const reservedForgot = await request(publicEnabledApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'personal@local.fitness' });
    expect(reservedForgot.status).toBe(200);
    expect(mailProvider.sent).toHaveLength(0);

    // Public register & login never expose raw token in JSON body
    const normalReg = await request(publicEnabledApp).post('/api/auth/register').send({
      name: 'Normal Kullanıcı',
      email: 'normal@example.com',
      password: 'Password123!',
    });
    expect(normalReg.status).toBe(201);
    expect(normalReg.body.token).toBeUndefined();
    expect(normalReg.headers['set-cookie']).toBeDefined();

    const normalLogin = await request(publicEnabledApp).post('/api/auth/login').send({
      email: 'normal@example.com',
      password: 'Password123!',
    });
    expect(normalLogin.status).toBe(200);
    expect(normalLogin.body.token).toBeUndefined();
    expect(normalLogin.headers['set-cookie']).toBeDefined();
  });

  it('enforces production PIN strength, IP-independent global PIN rate limit, and persistent DB lockout/backoff', async () => {
    // Production PIN policy: min 8 chars, reject repetitive/sequential/common pins
    for (const weakPin of ['1234', '246810', '11111111', '12121212', '12345678', '87654321', 'password1', 'changeme1']) {
      expect(() => parseEnv({ ...BASE_PROD_ENV, APP_PIN: weakPin })).toThrow(/APP_PIN/);
    }
    expect(parseEnv({ ...BASE_PROD_ENV, APP_PIN: '83947261' }).APP_PIN).toBe('83947261');
    expect(parseEnv({ ...BASE_PROD_ENV, APP_PIN: 'Oguz!9482' }).APP_PIN).toBe('Oguz!9482');

    // Global PIN limiter blocks distributed IP brute-force across distinct X-Forwarded-For IPs
    const distributedApp = createApp({
      appPin: '83947261',
      trustProxy: 1,
      rateLimit: {
        windowMs: 60_000,
        authIpMax: 100,
        authAccountMax: 100,
        pinGlobalMax: 3,
        apiMax: 100,
      },
    });

    for (let i = 1; i <= 3; i += 1) {
      const attempt = await request(distributedApp)
        .post('/api/access/unlock')
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send({ pin: `0000000${i}` });
      expect(attempt.status).toBe(401);
    }

    const distributedBlocked = await request(distributedApp)
      .post('/api/access/unlock')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ pin: '83947261' });
    expect(distributedBlocked.status).toBe(429);

    // Reset state and verify DB-backed persistent lockout survives app restart (fresh createApp instance)
    await prisma.accessAttemptState.deleteMany();
    const highLimitOpts = {
      appPin: '83947261',
      rateLimit: { windowMs: 60_000, authIpMax: 100, authAccountMax: 100, pinGlobalMax: 100, apiMax: 200 },
    };
    const instanceBeforeRestart = createApp(highLimitOpts);

    // Failed /setup attempts also increment the shared DB attempt counter and reset on valid setup
    const badSetup1 = await request(instanceBeforeRestart)
      .post('/api/access/setup')
      .send({ name: 'Oğuz', pin: '00000001' });
    const badSetup2 = await request(instanceBeforeRestart)
      .post('/api/access/setup')
      .send({ name: 'Oğuz', pin: '00000002' });
    expect(badSetup1.status).toBe(401);
    expect(badSetup2.status).toBe(401);
    const afterBadSetups = await prisma.accessAttemptState.findUnique({
      where: { scope: PERSONAL_PIN_ATTEMPT_SCOPE },
    });
    expect(afterBadSetups?.failedCount).toBe(2);

    const setupRes = await request(instanceBeforeRestart)
      .post('/api/access/setup')
      .send({ name: 'Oğuz', pin: '83947261' });
    expect(setupRes.status).toBe(201);
    expect(
      await prisma.accessAttemptState.findUnique({ where: { scope: PERSONAL_PIN_ATTEMPT_SCOPE } }),
    ).toBeNull();

    for (let i = 1; i <= 5; i += 1) {
      const failRes = await request(instanceBeforeRestart)
        .post('/api/access/unlock')
        .send({ pin: `9999999${i}` });
      expect(failRes.status).toBe(401);
    }

    // Fresh Express app simulates server restart (in-memory limiters reset, DB lockout still active)
    const instanceAfterRestart = createApp(highLimitOpts);
    const lockedRes = await request(instanceAfterRestart)
      .post('/api/access/unlock')
      .send({ pin: '83947261' });
    expect(lockedRes.status).toBe(429);
    expect(Number(lockedRes.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(lockedRes.headers['retry-after'])).toBeLessThanOrEqual(30);

    // Simulate lock window expiration, 6th failed attempt escalates backoff to 60s
    await prisma.accessAttemptState.update({
      where: { scope: PERSONAL_PIN_ATTEMPT_SCOPE },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    const sixthFail = await request(instanceAfterRestart)
      .post('/api/access/unlock')
      .send({ pin: '00000000' });
    expect(sixthFail.status).toBe(401);

    const escalatedLock = await request(instanceAfterRestart)
      .post('/api/access/unlock')
      .send({ pin: '83947261' });
    expect(escalatedLock.status).toBe(429);
    expect(Number(escalatedLock.headers['retry-after'])).toBeGreaterThan(30);

    // Once lock expires, correct PIN succeeds and resets DB lockout counter
    await prisma.accessAttemptState.update({
      where: { scope: PERSONAL_PIN_ATTEMPT_SCOPE },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    const unlockedRes = await request(instanceAfterRestart)
      .post('/api/access/unlock')
      .send({ pin: '83947261' });
    expect(unlockedRes.status).toBe(200);

    const clearedState = await prisma.accessAttemptState.findUnique({
      where: { scope: PERSONAL_PIN_ATTEMPT_SCOPE },
    });
    expect(clearedState).toBeNull();
  });

  it('rejects placeholder and low-entropy JWT_SECRET values in production', () => {
    const weakSecrets = [
      'change-this-to-a-long-random-secret-in-production',
      'my-default-secret-value-for-production-use',
      'example-secret-key-that-is-over-32-chars-long',
      'a'.repeat(48),
      'ab'.repeat(24),
    ];

    for (const secret of weakSecrets) {
      expect(() => parseEnv({ ...BASE_PROD_ENV, JWT_SECRET: secret })).toThrow(/JWT_SECRET/);
    }

    const validEnv = parseEnv(BASE_PROD_ENV);
    expect(validEnv.JWT_SECRET).toBe(STRONG_PROD_SECRET);
  });
});
