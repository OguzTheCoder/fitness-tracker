import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'ft_session';
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDurationToMs(duration: string, fallbackMs = DAY_MS): number {
  const trimmed = duration.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const match = /^(\d+)([smhd])$/i.exec(trimmed);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: DAY_MS,
  };
  return amount * (multipliers[unit] ?? DAY_MS);
}

export function getPersistentSessionTtlMs(): number {
  return env.SESSION_TTL_DAYS * DAY_MS;
}

export function getPersistentSessionExpiresIn(): `${number}d` {
  return `${env.SESSION_TTL_DAYS}d`;
}

export function getClassicSessionTtlMs(): number {
  return parseDurationToMs(env.JWT_EXPIRES_IN, DAY_MS);
}

function resolveCookieSecurity(req?: Request): {
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
} {
  const sameSite = env.COOKIE_SAME_SITE;
  const secureOverride = req?.app.locals.cookieSecure as boolean | undefined;
  const secure = secureOverride ?? (env.NODE_ENV === 'production' || sameSite === 'none');
  return { sameSite, secure };
}

export function buildSessionCookieOptions(req: Request, maxAgeMs?: number): CookieOptions {
  const { sameSite, secure } = resolveCookieSecurity(req);
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export function setSessionCookie(req: Request, res: Response, token: string, maxAgeMs: number) {
  res.cookie(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(req, maxAgeMs));
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, buildSessionCookieOptions(req));
}

export function extractRequestToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const bearer = header.slice('Bearer '.length).trim();
    if (bearer.length > 0) return bearer;
  }

  return null;
}
