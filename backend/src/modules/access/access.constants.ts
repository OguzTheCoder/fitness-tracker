export const PERSONAL_OWNER_EMAIL = 'personal@local.fitness';

export const PERSONAL_PIN_ATTEMPT_SCOPE = 'personal-pin';

export const PIN_LOCKOUT_FREE_ATTEMPTS = 5;

export const PIN_LOCKOUT_BACKOFF_MS = [
  30 * 1000, // 5. başarısız deneme -> 30 sn
  60 * 1000, // 6. başarısız deneme -> 1 dk
  2 * 60 * 1000, // 7. başarısız deneme -> 2 dk
  5 * 60 * 1000, // 8. başarısız deneme -> 5 dk
  15 * 60 * 1000, // 9. başarısız deneme -> 15 dk
  30 * 60 * 1000, // 10+ başarısız deneme -> 30 dk tavan
] as const;

export function computePinLockoutDurationMs(failedCount: number): number {
  if (failedCount < PIN_LOCKOUT_FREE_ATTEMPTS) {
    return 0;
  }
  const idx = Math.min(failedCount - PIN_LOCKOUT_FREE_ATTEMPTS, PIN_LOCKOUT_BACKOFF_MS.length - 1);
  return PIN_LOCKOUT_BACKOFF_MS[idx];
}
