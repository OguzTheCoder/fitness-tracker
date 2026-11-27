import { ApiError } from '../services/api';

let activeOfflineUserId: string | null = null;

export function setActiveOfflineUserId(userId: string | null): void {
  activeOfflineUserId = userId;
}

export function getActiveOfflineUserId(): string | null {
  return activeOfflineUserId;
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Distinguishes true network/offline errors from HTTP API errors (4xx/5xx).
 * Server errors (400/401/403/404/409/429/500) are NEVER treated as offline.
 */
export function isNetworkOfflineError(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (!isBrowserOnline()) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (
    err instanceof Error &&
    /network|failed to fetch|load failed|offline|networkerror/i.test(err.message)
  ) {
    return true;
  }
  return false;
}

export function generateOfflineId(prefix = 'loc'): string {
  const timePart = Date.now().toString(36);
  const randPart =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${timePart}_${randPart}`;
}

export type OfflineEventType = 'queue-changed' | 'sync-completed' | 'auth-required';
type OfflineEventListener = (type: OfflineEventType) => void;

const listeners = new Set<OfflineEventListener>();

export function subscribeOfflineEvents(listener: OfflineEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitOfflineEvent(type: OfflineEventType): void {
  for (const listener of listeners) {
    try {
      listener(type);
    } catch {
      // keep listener errors isolated
    }
  }
}
