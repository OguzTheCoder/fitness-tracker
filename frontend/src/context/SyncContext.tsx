import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { countQueuedMutations, getUserLocalData } from '../offline/offlineDb';
import { isBrowserOnline, subscribeOfflineEvents } from '../offline/offlineHelpers';
import { syncUserNow } from '../offline/syncEngine';
import { useAuth } from './AuthContext';

export type SyncUiState = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncContextValue {
  isOnline: boolean;
  syncState: SyncUiState;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncVersion: number;
  triggerSync: (forceFull?: boolean) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() => isBrowserOnline());
  const [syncState, setSyncState] = useState<SyncUiState>(() =>
    isBrowserOnline() ? 'idle' : 'offline',
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);

  const refreshQueueCount = useCallback(async (userId: string) => {
    try {
      const count = await countQueuedMutations(userId);
      setPendingCount(count);
    } catch {
      // ignore read errors
    }
  }, []);

  const triggerSync = useCallback(
    async (forceFull = false) => {
      if (!user) return;
      if (!isBrowserOnline()) {
        setIsOnline(false);
        setSyncState('offline');
        await refreshQueueCount(user.id);
        return;
      }

      setSyncState('syncing');
      setSyncError(null);
      const outcome = await syncUserNow(user.id, { forceFull });

      setPendingCount(outcome.remainingPending);
      if (outcome.lastSyncedAt) {
        setLastSyncedAt(outcome.lastSyncedAt);
      }

      if (outcome.status === 'synced') {
        setIsOnline(true);
        setSyncState('idle');
        setSyncVersion((v) => v + 1);
      } else if (outcome.status === 'offline') {
        setIsOnline(false);
        setSyncState('offline');
      } else if (outcome.status === 'auth_required') {
        setSyncState('idle');
      } else {
        setSyncState('error');
        setSyncError(outcome.errorMessage ?? 'Eşitleme başarısız oldu.');
      }
    },
    [refreshQueueCount, user],
  );

  // Initialize queue counter + lastSyncedAt; flush immediately if offline mutations are queued,
  // and warm local IndexedDB cache in background for offline readiness in browser sessions.
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      setLastSyncedAt(null);
      setSyncError(null);
      setSyncState(isBrowserOnline() ? 'idle' : 'offline');
      return;
    }

    let cancelled = false;
    let warmUpTimer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      try {
        const [local, count] = await Promise.all([
          getUserLocalData(user.id),
          countQueuedMutations(user.id),
        ]);
        if (cancelled) return;
        setLastSyncedAt(local.lastSyncedAt);
        setPendingCount(count);
        if (!isBrowserOnline()) {
          setSyncState('offline');
          return;
        }
        if (count > 0) {
          await triggerSync(false);
          return;
        }
        if (import.meta.env.MODE !== 'test') {
          warmUpTimer = setTimeout(() => {
            if (!cancelled && isBrowserOnline()) {
              void triggerSync(false);
            }
          }, 1200);
        }
      } catch {
        // ignore startup error
      }
    })();

    return () => {
      cancelled = true;
      if (warmUpTimer) clearTimeout(warmUpTimer);
    };
  }, [user, triggerSync]);

  // Listen to local queue mutations
  useEffect(() => {
    if (!user) return;
    return subscribeOfflineEvents((event) => {
      if (event === 'queue-changed') {
        void refreshQueueCount(user.id);
      }
    });
  }, [refreshQueueCount, user]);

  // Listen to browser online/offline & visibility changes for automatic background sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncState('idle');
      if (user) {
        void triggerSync(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isBrowserOnline() && user) {
        void triggerSync(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [triggerSync, user]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncState,
        pendingCount,
        lastSyncedAt,
        syncError,
        syncVersion,
        triggerSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync yalnızca SyncProvider içinde kullanılabilir.');
  }
  return ctx;
}
