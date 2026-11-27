import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.utils.js';

export function getSessionSetCookie(setCookieHeader: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) {
    throw new Error(`Expected ${SESSION_COOKIE_NAME} cookie in Set-Cookie header`);
  }
  return match;
}

export function extractSessionCookieHeader(setCookieHeader: string | string[] | undefined): string {
  return getSessionSetCookie(setCookieHeader).split(';')[0];
}

export function extractSessionToken(setCookieHeader: string | string[] | undefined): string {
  const pair = extractSessionCookieHeader(setCookieHeader);
  return decodeURIComponent(pair.slice(`${SESSION_COOKIE_NAME}=`.length));
}
