export function resolveSafeRedirectPath(candidate: unknown, fallback = '/dashboard'): string {
  if (typeof candidate !== 'string') return fallback;
  const trimmed = candidate.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /[\r\n]/.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}
