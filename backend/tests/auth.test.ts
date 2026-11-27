import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryMailProvider, setMailProvider } from '../src/config/mail.js';
import { prisma } from '../src/config/prisma.js';
import { hashResetToken } from '../src/modules/auth/auth.utils.js';
import { extractSessionCookieHeader, getSessionSetCookie } from './helpers/authCookie.js';

const app = createApp();
const mailProvider = new MemoryMailProvider();

describe('Auth API Integration (Isolated SQLite DB)', () => {
  beforeEach(async () => {
    setMailProvider(mailProvider);
    mailProvider.clear();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'fitness-tracker-backend' });
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user, sets HttpOnly cookie without body token, and returns public profile', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Oğuz Yılmaz',
        email: 'Oguz@Example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeUndefined();
      expect(getSessionSetCookie(res.headers['set-cookie'])).toContain('HttpOnly');
      expect(res.body.user).toMatchObject({
        name: 'Oğuz Yılmaz',
        email: 'oguz@example.com',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects invalid input with 400 and field errors', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'A',
        email: 'gecersiz',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.details.name).toBeDefined();
      expect(res.body.details.email).toBeDefined();
      expect(res.body.details.password).toBeDefined();
    });

    it('rejects duplicate email case-insensitively with 409', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Oğuz',
        email: 'oguz@example.com',
        password: 'Password123!',
      });

      const dup = await request(app).post('/api/auth/register').send({
        name: 'Başka Biri',
        email: 'OGUZ@example.com',
        password: 'Password123!',
      });

      expect(dup.status).toBe(409);
    });
  });

  describe('POST /api/auth/login & GET /api/auth/me', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Oğuz',
        email: 'oguz@example.com',
        password: 'Password123!',
      });
    });

    it('logs in with valid credentials and resolves /api/auth/me via HttpOnly cookie', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'OGUZ@example.com',
        password: 'Password123!',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeUndefined();
      const cookieHeader = extractSessionCookieHeader(loginRes.headers['set-cookie']);

      const meRes = await request(app).get('/api/auth/me').set('Cookie', cookieHeader);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('oguz@example.com');
      expect(meRes.body.user.passwordHash).toBeUndefined();
    });

    it('rejects wrong password and unknown email with 401', async () => {
      const wrongPw = await request(app).post('/api/auth/login').send({
        email: 'oguz@example.com',
        password: 'WrongPassword!',
      });
      const unknown = await request(app).post('/api/auth/login').send({
        email: 'unknown@example.com',
        password: 'Password123!',
      });

      expect(wrongPw.status).toBe(401);
      expect(unknown.status).toBe(401);
    });

    it('rejects /api/auth/me without or with invalid Bearer token', async () => {
      const noToken = await request(app).get('/api/auth/me');
      const badToken = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(noToken.status).toBe(401);
      expect(badToken.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password & /api/auth/reset-password', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Oğuz',
        email: 'oguz@example.com',
        password: 'OldPassword123!',
      });
    });

    it('returns generic 200 without sending mail for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'missing@example.com' });

      expect(res.status).toBe(200);
      expect(mailProvider.sent).toHaveLength(0);
    });

    it('completes full password reset flow and enforces single-use token', async () => {
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oguz@example.com' });

      expect(forgotRes.status).toBe(200);
      expect(mailProvider.sent).toHaveLength(1);
      const { resetToken } = mailProvider.sent[0];

      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'NewPassword456!',
      });
      expect(resetRes.status).toBe(200);

      // Token cannot be reused
      const reuseRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'ThirdPassword789!',
      });
      expect(reuseRes.status).toBe(400);

      // Old password fails, new password succeeds
      const oldLogin = await request(app).post('/api/auth/login').send({
        email: 'oguz@example.com',
        password: 'OldPassword123!',
      });
      const newLogin = await request(app).post('/api/auth/login').send({
        email: 'oguz@example.com',
        password: 'NewPassword456!',
      });
      expect(oldLogin.status).toBe(401);
      expect(newLogin.status).toBe(200);
    });

    it('rejects expired reset token with 400', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'oguz@example.com' } });
      const expiredToken = 'expired-test-token-value';
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(expiredToken),
          expiresAt: new Date(Date.now() - 60_000),
        },
      });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: expiredToken,
        password: 'NewPassword456!',
      });
      expect(res.status).toBe(400);
    });
  });
});
