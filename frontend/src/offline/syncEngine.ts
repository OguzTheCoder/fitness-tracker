import { ApiError, apiRequest } from '../services/api';
import { applySyncPullToLocal } from './localStore';
import {
  getQueuedMutations,
  getUserLocalData,
  removeQueuedMutations,
  saveUserLocalData,
} from './offlineDb';
import { emitOfflineEvent, isBrowserOnline, isNetworkOfflineError } from './offlineHelpers';
import type { SyncPullResponse, SyncPushResponse } from './offlineTypes';

export interface SyncRunOutcome {
  status: 'synced' | 'offline' | 'auth_required' | 'error';
  pushedCount: number;
  remainingPending: number;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

const inFlightByUser = new Map<string, Promise<SyncRunOutcome>>();

export async function syncUserNow(
  userId: string,
  options?: { forceFull?: boolean },
): Promise<SyncRunOutcome> {
  const existing = inFlightByUser.get(userId);
  if (existing) return existing;

  const task = runSyncInternal(userId, options).finally(() => {
    inFlightByUser.delete(userId);
  });
  inFlightByUser.set(userId, task);
  return task;
}

async function runSyncInternal(
  userId: string,
  options?: { forceFull?: boolean },
): Promise<SyncRunOutcome> {
  const localBefore = await getUserLocalData(userId);
  const queued = await getQueuedMutations(userId);

  if (!isBrowserOnline()) {
    return {
      status: 'offline',
      pushedCount: 0,
      remainingPending: queued.length,
      lastSyncedAt: localBefore.lastSyncedAt,
    };
  }

  try {
    let pushedCount = 0;
    let appliedPull = false;

    if (queued.length > 0) {
      const payload = {
        ...(localBefore.lastSyncedAt && !options?.forceFull
          ? { since: localBefore.lastSyncedAt }
          : {}),
        mutations: queued.map((m) => ({
          clientMutationId: m.clientMutationId,
          entity: m.entity,
          operation: m.operation,
          recordId: m.recordId,
          clientUpdatedAt: m.clientUpdatedAt,
          ...(m.operation === 'upsert' ? { data: m.data } : {}),
        })),
      };

      const pushRes = await apiRequest<SyncPushResponse>('/sync', {
        method: 'POST',
        body: payload,
      });

      const resolvedIds: string[] = [];
      const remappedWeightIds = new Map<string, string>();
      const remappedStepIds = new Map<string, string>();

      for (const r of pushRes.results) {
        resolvedIds.push(r.clientMutationId);
        if (r.status === 'applied') pushedCount += 1;
        if (r.serverRecordId && r.serverRecordId !== r.recordId) {
          if (r.entity === 'weight') remappedWeightIds.set(r.recordId, r.serverRecordId);
          if (r.entity === 'step') remappedStepIds.set(r.recordId, r.serverRecordId);
        }
      }

      if (remappedWeightIds.size > 0 || remappedStepIds.size > 0) {
        const current = await getUserLocalData(userId);
        current.weights = current.weights.filter((w) => !remappedWeightIds.has(w.id));
        current.steps = current.steps.filter((s) => !remappedStepIds.has(s.id));
        await saveUserLocalData(current);
      }

      await removeQueuedMutations(resolvedIds);
      emitOfflineEvent('queue-changed');

      if (pushRes.pull) {
        await applySyncPullToLocal(userId, pushRes.pull);
        appliedPull = true;
      }
    }

    if (!appliedPull) {
      const current = await getUserLocalData(userId);
      const needsCore =
        options?.forceFull ||
        !current.lastSyncedAt ||
        current.coreFoods.length === 0 ||
        current.coreExercises.length === 0;
      const qs = new URLSearchParams();
      if (current.lastSyncedAt && !options?.forceFull) {
        qs.set('since', current.lastSyncedAt);
      }
      if (needsCore) {
        qs.set('includeCore', 'true');
      }
      const queryStr = qs.toString();
      const pullRes = await apiRequest<SyncPullResponse>(
        `/sync${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' },
      );
      await applySyncPullToLocal(userId, pullRes);
    }

    const [updatedLocal, remaining] = await Promise.all([
      getUserLocalData(userId),
      getQueuedMutations(userId),
    ]);
    emitOfflineEvent('sync-completed');
    return {
      status: 'synced',
      pushedCount,
      remainingPending: remaining.length,
      lastSyncedAt: updatedLocal.lastSyncedAt,
    };
  } catch (err) {
    const remaining = await getQueuedMutations(userId);
    if (err instanceof ApiError && err.status === 401) {
      // Option 2-A: NEVER drop pending offline mutations on expired session; request re-auth!
      emitOfflineEvent('auth-required');
      return {
        status: 'auth_required',
        pushedCount: 0,
        remainingPending: remaining.length,
        lastSyncedAt: localBefore.lastSyncedAt,
        errorMessage: 'Oturum süresi doldu. Bekleyen kayıtlarınız korundu; lütfen tekrar giriş yapın.',
      };
    }

    if (isNetworkOfflineError(err)) {
      return {
        status: 'offline',
        pushedCount: 0,
        remainingPending: remaining.length,
        lastSyncedAt: localBefore.lastSyncedAt,
      };
    }

    return {
      status: 'error',
      pushedCount: 0,
      remainingPending: remaining.length,
      lastSyncedAt: localBefore.lastSyncedAt,
      errorMessage: err instanceof Error ? err.message : 'Eşitleme sırasında hata oluştu.',
    };
  }
}
