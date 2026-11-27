import { DEFAULT_MICRONUTRIENT_CATALOG } from './offlineMath';
import type { CachedSessionMeta, QueuedMutation, UserLocalData } from './offlineTypes';

const DB_NAME = 'fitness-tracker-offline-v1';
const DB_VERSION = 1;
const STORE_USER_DATA = 'userData';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_SESSION_META = 'sessionMeta';
const SESSION_META_KEY = 'lastSession';

// In-memory fallback for environments without IndexedDB (e.g. restricted private mode or jsdom)
const memoryUserData = new Map<string, UserLocalData>();
const memoryQueue = new Map<string, QueuedMutation>();
let memorySessionMeta: CachedSessionMeta | null = null;

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_USER_DATA)) {
        db.createObjectStore(STORE_USER_DATA, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_SYNC_QUEUE, {
          keyPath: 'clientMutationId',
        });
        queueStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSION_META)) {
        db.createObjectStore(STORE_SESSION_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB açılamadı.'));
    };
  });
  return dbPromise;
}

function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = executor(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function createEmptyUserLocalData(userId: string): UserLocalData {
  return {
    userId,
    lastSyncedAt: null,
    profile: null,
    availableMicronutrients: [...DEFAULT_MICRONUTRIENT_CATALOG],
    coreFoods: [],
    coreExercises: [],
    weights: [],
    calories: [],
    foods: [],
    recipes: [],
    nutritionLogs: [],
    exercises: [],
    workoutTemplates: [],
    workouts: [],
    cardio: [],
    steps: [],
  };
}

export async function getUserLocalData(userId: string): Promise<UserLocalData> {
  if (!hasIndexedDb()) {
    const existing = memoryUserData.get(userId);
    return existing ? structuredClone(existing) : createEmptyUserLocalData(userId);
  }
  const existing = await runTx<UserLocalData | undefined>(STORE_USER_DATA, 'readonly', (store) =>
    store.get(userId),
  );
  return existing ?? createEmptyUserLocalData(userId);
}

export async function saveUserLocalData(data: UserLocalData): Promise<void> {
  if (!hasIndexedDb()) {
    memoryUserData.set(data.userId, structuredClone(data));
    return;
  }
  await runTx(STORE_USER_DATA, 'readwrite', (store) => store.put(data));
}

export async function getQueuedMutations(userId: string): Promise<QueuedMutation[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryQueue.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => structuredClone(m));
  }

  const db = await openDb();
  return new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const index = tx.objectStore(STORE_SYNC_QUEUE).index('userId');
    const req = index.getAll(userId);
    req.onsuccess = () => {
      const rows = (req.result as QueuedMutation[]) ?? [];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
  if (!hasIndexedDb()) {
    memoryQueue.set(mutation.clientMutationId, structuredClone(mutation));
    return;
  }
  await runTx(STORE_SYNC_QUEUE, 'readwrite', (store) => store.put(mutation));
}

export async function removeQueuedMutations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!hasIndexedDb()) {
    for (const id of ids) memoryQueue.delete(id);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_SYNC_QUEUE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countQueuedMutations(userId: string): Promise<number> {
  const rows = await getQueuedMutations(userId);
  return rows.length;
}

export async function getCachedSessionMeta(): Promise<CachedSessionMeta | null> {
  if (!hasIndexedDb()) {
    return memorySessionMeta ? structuredClone(memorySessionMeta) : null;
  }
  const value = await runTx<CachedSessionMeta | undefined>(STORE_SESSION_META, 'readonly', (s) =>
    s.get(SESSION_META_KEY),
  );
  return value ?? null;
}

export async function saveCachedSessionMeta(meta: CachedSessionMeta): Promise<void> {
  if (!hasIndexedDb()) {
    memorySessionMeta = structuredClone(meta);
    return;
  }
  await runTx(STORE_SESSION_META, 'readwrite', (s) => s.put(meta, SESSION_META_KEY));
}

export async function clearCachedSessionMeta(): Promise<void> {
  if (!hasIndexedDb()) {
    memorySessionMeta = null;
    return;
  }
  await runTx(STORE_SESSION_META, 'readwrite', (s) => s.delete(SESSION_META_KEY));
}

export async function resetOfflineDbForTests(): Promise<void> {
  memoryUserData.clear();
  memoryQueue.clear();
  memorySessionMeta = null;
  if (!hasIndexedDb()) return;

  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
    dbPromise = null;
  }

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
