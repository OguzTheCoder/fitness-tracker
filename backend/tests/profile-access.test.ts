import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/session.utils.js';

function getSessionCookieHeader(setCookieHeader: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const match = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) {
    throw new Error(`Expected ${SESSION_COOKIE_NAME} cookie in Set-Cookie header`);
  }
  return match;
}

function toCookieRequestHeader(setCookieValue: string): string {
  return setCookieValue.split(';')[0];
}

describe('Profile, Environment Access & HttpOnly Cookie Session (AUTH-9 / v1.0.2)', () => {
  beforeEach(async () => {
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

  describe('Local Mode (APP_PIN unset) & Profile API (/api/profile)', () => {
    const localApp = createApp({ appPin: null });

    it('reports unconfigured local mode, sets up owner with name only, and uses HttpOnly cookie session', async () => {
      const initialStatus = await request(localApp).get('/api/access/status');
      expect(initialStatus.status).toBe(200);
      expect(initialStatus.body).toEqual({
        mode: 'local',
        isConfigured: false,
        isAuthenticated: false,
        user: null,
      });

      const setupRes = await request(localApp)
        .post('/api/access/setup')
        .send({ name: 'Oğuz' });
      expect(setupRes.status).toBe(201);
      expect(setupRes.body.mode).toBe('local');
      expect(setupRes.body.user.name).toBe('Oğuz');
      expect(setupRes.body.token).toBeUndefined();

      const setCookie = getSessionCookieHeader(setupRes.headers['set-cookie']);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      const cookieHeader = toCookieRequestHeader(setCookie);

      // Authenticated status and /api/auth/me work via HttpOnly cookie without Authorization header
      const authedStatus = await request(localApp)
        .get('/api/access/status')
        .set('Cookie', cookieHeader);
      expect(authedStatus.status).toBe(200);
      expect(authedStatus.body.isConfigured).toBe(true);
      expect(authedStatus.body.isAuthenticated).toBe(true);
      expect(authedStatus.body.user.name).toBe('Oğuz');

      const meRes = await request(localApp)
        .get('/api/auth/me')
        .set('Cookie', cookieHeader);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.name).toBe('Oğuz');

      // Duplicate setup is rejected with 409
      const dupRes = await request(localApp)
        .post('/api/access/setup')
        .send({ name: 'Başka İsim' });
      expect(dupRes.status).toBe(409);

      // Logout clears cookie; local-session resumes cleanly in local mode
      const logoutRes = await request(localApp)
        .post('/api/auth/logout')
        .set('Cookie', cookieHeader);
      expect(logoutRes.status).toBe(200);
      const clearedCookie = getSessionCookieHeader(logoutRes.headers['set-cookie']);
      expect(clearedCookie).toContain(`${SESSION_COOKIE_NAME}=;`);

      const resumedRes = await request(localApp).post('/api/access/local-session');
      expect(resumedRes.status).toBe(200);
      expect(resumedRes.body.user.name).toBe('Oğuz');
      const resumedCookie = toCookieRequestHeader(
        getSessionCookieHeader(resumedRes.headers['set-cookie']),
      );
      const meAfterResume = await request(localApp)
        .get('/api/auth/me')
        .set('Cookie', resumedCookie);
      expect(meAfterResume.status).toBe(200);
    });

    it('returns default profile goals & 6 default minerals, updates profile, and rejects invalid keys', async () => {
      const unauthProfile = await request(localApp).get('/api/profile');
      expect(unauthProfile.status).toBe(401);

      const setupRes = await request(localApp)
        .post('/api/access/setup')
        .send({ name: 'Oğuz' });
      const cookieHeader = toCookieRequestHeader(
        getSessionCookieHeader(setupRes.headers['set-cookie']),
      );

      const getRes = await request(localApp)
        .get('/api/profile')
        .set('Cookie', cookieHeader);
      expect(getRes.status).toBe(200);
      expect(getRes.body.profile).toMatchObject({
        name: 'Oğuz',
        dailyCalorieGoal: 2000,
        proteinGoalG: 150,
        carbsGoalG: 200,
        fatGoalG: 65,
        dailyStepGoal: 8000,
        visibleMicronutrients: ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'],
      });
      expect(Array.isArray(getRes.body.availableMicronutrients)).toBe(true);
      expect(getRes.body.availableMicronutrients.length).toBeGreaterThanOrEqual(20);

      const updateRes = await request(localApp)
        .put('/api/profile')
        .set('Cookie', cookieHeader)
        .send({
          name: 'Oğuzhan',
          dailyCalorieGoal: 2400,
          proteinGoalG: 180,
          carbsGoalG: 240,
          fatGoalG: 75,
          dailyStepGoal: 10000,
          visibleMicronutrients: ['Na', 'K', 'VitD', 'VitB12', 'VitD'],
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.profile).toMatchObject({
        name: 'Oğuzhan',
        dailyCalorieGoal: 2400,
        proteinGoalG: 180,
        carbsGoalG: 240,
        fatGoalG: 75,
        dailyStepGoal: 10000,
        visibleMicronutrients: ['Na', 'K', 'VitD', 'VitB12'],
      });

      const invalidMicro = await request(localApp)
        .patch('/api/profile')
        .set('Cookie', cookieHeader)
        .send({ visibleMicronutrients: ['Na', 'INVALID_KEY'] });
      expect(invalidMicro.status).toBe(400);

      const invalidGoal = await request(localApp)
        .patch('/api/profile')
        .set('Cookie', cookieHeader)
        .send({ dailyCalorieGoal: 100 });
      expect(invalidGoal.status).toBe(400);
    });
  });

  describe('PIN Mode (APP_PIN set), Rate Limit, tokenVersion & G-005 Cookie Flags', () => {
    it('enforces PIN on setup/unlock, blocks local-session, sets Secure HttpOnly cookie, and revokes sessions on PIN change & logout-all', async () => {
      const pinApp = createApp({ appPin: '246810', cookieSecure: true });

      const statusRes = await request(pinApp).get('/api/access/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.mode).toBe('pin');
      expect(statusRes.body.isConfigured).toBe(false);

      // Setup without or with wrong PIN fails with 401
      const badSetup = await request(pinApp)
        .post('/api/access/setup')
        .send({ name: 'Oğuz', pin: '000000' });
      expect(badSetup.status).toBe(401);

      // Setup with valid PIN succeeds and sets HttpOnly; Secure; SameSite=Strict persistent cookie
      const goodSetup = await request(pinApp)
        .post('/api/access/setup')
        .send({ name: 'Oğuz', pin: '246810' });
      expect(goodSetup.status).toBe(201);
      const rawCookie = getSessionCookieHeader(goodSetup.headers['set-cookie']);
      expect(rawCookie).toContain('HttpOnly');
      expect(rawCookie).toContain('Secure');
      expect(rawCookie).toContain('SameSite=Strict');
      expect(rawCookie).toContain('Max-Age=2592000');

      const deviceACookie = toCookieRequestHeader(rawCookie);

      // local-session is strictly forbidden when PIN is active
      const blockedLocal = await request(pinApp).post('/api/access/local-session');
      expect(blockedLocal.status).toBe(403);

      // Unlock with wrong PIN fails, unlock with valid PIN issues a second device cookie
      const badUnlock = await request(pinApp)
        .post('/api/access/unlock')
        .send({ pin: '111111' });
      expect(badUnlock.status).toBe(401);

      const goodUnlock = await request(pinApp)
        .post('/api/access/unlock')
        .send({ pin: '246810' });
      expect(goodUnlock.status).toBe(200);
      const deviceBCookie = toCookieRequestHeader(
        getSessionCookieHeader(goodUnlock.headers['set-cookie']),
      );

      // Both devices work
      expect(
        (await request(pinApp).get('/api/profile').set('Cookie', deviceACookie)).status,
      ).toBe(200);
      expect(
        (await request(pinApp).get('/api/profile').set('Cookie', deviceBCookie)).status,
      ).toBe(200);

      // Changing APP_PIN immediately invalidates all old cookies via tokenVersion (G-002)
      const rotatedPinApp = createApp({ appPin: '998877', cookieSecure: true });
      const oldDeviceCheck = await request(rotatedPinApp)
        .get('/api/profile')
        .set('Cookie', deviceACookie);
      expect(oldDeviceCheck.status).toBe(401);

      const oldDeviceBCheck = await request(rotatedPinApp)
        .get('/api/profile')
        .set('Cookie', deviceBCookie);
      expect(oldDeviceBCheck.status).toBe(401);

      // Unlocking with the new PIN issues a valid cookie
      const newUnlock = await request(rotatedPinApp)
        .post('/api/access/unlock')
        .send({ pin: '998877' });
      expect(newUnlock.status).toBe(200);
      const freshCookie1 = toCookieRequestHeader(
        getSessionCookieHeader(newUnlock.headers['set-cookie']),
      );
      const newUnlock2 = await request(rotatedPinApp)
        .post('/api/access/unlock')
        .send({ pin: '998877' });
      const freshCookie2 = toCookieRequestHeader(
        getSessionCookieHeader(newUnlock2.headers['set-cookie']),
      );

      // logout-all revokes all devices via tokenVersion
      const logoutAllRes = await request(rotatedPinApp)
        .post('/api/auth/logout-all')
        .set('Cookie', freshCookie1);
      expect(logoutAllRes.status).toBe(200);

      expect(
        (await request(rotatedPinApp).get('/api/profile').set('Cookie', freshCookie1)).status,
      ).toBe(401);
      expect(
        (await request(rotatedPinApp).get('/api/profile').set('Cookie', freshCookie2)).status,
      ).toBe(401);
    });

    it('G-001: rate-limits PIN unlock brute-force attempts with 429', async () => {
      const strictPinApp = createApp({
        appPin: '246810',
        rateLimit: { windowMs: 60_000, authIpMax: 2, authAccountMax: 2, apiMax: 20 },
      });

      const attempt1 = await request(strictPinApp)
        .post('/api/access/unlock')
        .send({ pin: '000001' });
      expect(attempt1.status).toBe(401);

      const attempt2 = await request(strictPinApp)
        .post('/api/access/unlock')
        .send({ pin: '000002' });
      expect(attempt2.status).toBe(401);

      const attempt3 = await request(strictPinApp)
        .post('/api/access/unlock')
        .send({ pin: '246810' });
      expect(attempt3.status).toBe(429);
    });

    it('G-005: classic /api/auth/login and /api/auth/register set HttpOnly cookie and authenticate /api/auth/me without Bearer header', async () => {
      const app = createApp({ cookieSecure: true });

      const registerRes = await request(app).post('/api/auth/register').send({
        name: 'Klasik Kullanıcı',
        email: 'classic@example.com',
        password: 'Password123!',
      });
      expect(registerRes.status).toBe(201);
      const regCookieRaw = getSessionCookieHeader(registerRes.headers['set-cookie']);
      expect(regCookieRaw).toContain('HttpOnly');
      expect(regCookieRaw).toContain('Secure');
      expect(regCookieRaw).toContain('SameSite=Strict');

      const meFromCookie = await request(app)
        .get('/api/auth/me')
        .set('Cookie', toCookieRequestHeader(regCookieRaw));
      expect(meFromCookie.status).toBe(200);
      expect(meFromCookie.body.user.email).toBe('classic@example.com');
    });
  });
});
