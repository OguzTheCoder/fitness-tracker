import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import {
  countQueuedMutations,
  getQueuedMutations,
  resetOfflineDbForTests,
  saveCachedSessionMeta,
  saveUserLocalData,
  createEmptyUserLocalData,
} from '../src/offline/offlineDb';
import { setActiveOfflineUserId } from '../src/offline/offlineHelpers';
import { syncUserNow } from '../src/offline/syncEngine';
import { nutritionService } from '../src/services/nutritionService';
import { statsService } from '../src/services/statsService';
import { workoutService } from '../src/services/workoutService';

const DEMO_USER = {
  id: 'usr_offline_1',
  name: 'Oğuz',
  email: 'oguz@example.com',
  createdAt: '2026-11-26T00:00:00.000Z',
};

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

function mockJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Offline-First Queue, Auto-Sync & PWA Security (AUTH-14 / v1.5.0)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetOfflineDbForTests();
    setActiveOfflineUserId(null);
    setOnline(true);
  });

  afterEach(async () => {
    setOnline(true);
    setActiveOfflineUserId(null);
    await resetOfflineDbForTests();
  });

  it('opens offline using non-sensitive cached metadata, queues weight CRUD offline, and auto-syncs when online', async () => {
    const user = userEvent.setup();

    // Seed non-sensitive session shell & existing cached weight entry
    await saveCachedSessionMeta({
      user: DEMO_USER,
      accessMode: 'local',
      isConfigured: true,
      updatedAt: '2026-11-26T10:00:00.000Z',
    });

    const localData = createEmptyUserLocalData(DEMO_USER.id);
    localData.lastSyncedAt = '2026-11-26T10:00:00.000Z';
    localData.weights = [
      {
        id: 'w_existing_1',
        userId: DEMO_USER.id,
        date: '2026-11-25',
        weightKg: 82.5,
        note: 'Önbellekten kilo',
        createdAt: '2026-11-25T08:00:00.000Z',
        updatedAt: '2026-11-25T08:00:00.000Z',
      },
    ];
    await saveUserLocalData(localData);

    // Start offline!
    setOnline(false);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!navigator.onLine) {
        throw new TypeError('Failed to fetch');
      }
      if (url.includes('/api/sync')) {
        return mockJsonResponse({
          serverTime: '2026-11-26T12:00:00.000Z',
          results: [
            {
              clientMutationId: 'placeholder',
              entity: 'weight',
              recordId: 'placeholder',
              status: 'applied',
            },
          ],
          pull: {
            serverTime: '2026-11-26T12:00:00.000Z',
            isFullSync: false,
            profile: null,
            core: {},
            changes: {
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
            },
          },
        });
      }
      return mockJsonResponse({ entries: [] });
    });

    render(
      <MemoryRouter initialEntries={['/weights']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    // Cached entry renders offline & top bar shows offline status
    expect(await screen.findByText('Önbellekten kilo')).toBeInTheDocument();
    expect(screen.getByText(/Çevrimdışı/)).toBeInTheDocument();

    // Open New Weight Drawer & add a new weight entry while offline
    await user.click(screen.getByRole('button', { name: 'Yeni Kilo Kaydı' }));
    const dateInput = screen.getByLabelText(/^Tarih/i);
    const weightInput = screen.getByLabelText(/Kilo \(kg\)/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-26');
    await user.clear(weightInput);
    await user.type(weightInput, '81.8');
    await user.click(screen.getByRole('button', { name: /Kaydet/i }));

    // New offline weight renders immediately & badge shows 1 pending mutation
    expect((await screen.findAllByText(/81\.8 kg/)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Çevrimdışı · 1 bekleyen/)).toBeInTheDocument();

    const queued = await getQueuedMutations(DEMO_USER.id);
    expect(queued).toHaveLength(1);
    expect(queued[0].entity).toBe('weight');
    expect(queued[0].operation).toBe('upsert');

    // Update fetch mock to echo back exact clientMutationId when online sync fires
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/sync') && init?.method === 'POST') {
        expect(init.credentials).toBe('include');
        const body = JSON.parse(String(init.body)) as {
          mutations: Array<{ clientMutationId: string; entity: string; recordId: string }>;
        };
        return mockJsonResponse({
          serverTime: '2026-11-26T12:05:00.000Z',
          results: body.mutations.map((m) => ({
            clientMutationId: m.clientMutationId,
            entity: m.entity,
            recordId: m.recordId,
            serverRecordId: m.recordId,
            status: 'applied',
          })),
          pull: {
            serverTime: '2026-11-26T12:05:00.000Z',
            isFullSync: false,
            profile: null,
            core: {},
            changes: {
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
            },
          },
        });
      }
      return mockJsonResponse({ entries: [] });
    });

    // Simulate coming back online -> automatic sync triggers!
    act(() => {
      setOnline(true);
      fireEvent(window, new Event('online'));
    });

    await waitFor(async () => {
      expect(await countQueuedMutations(DEMO_USER.id)).toBe(0);
    });
    expect(await screen.findByText('Çevrimiçi')).toBeInTheDocument();
  });

  it('preserves pending offline queue when server returns 401 on sync (Option 2-A)', async () => {
    setActiveOfflineUserId(DEMO_USER.id);
    setOnline(false);

    // Queue a workout offline
    await workoutService.create({
      date: '2026-11-26',
      name: 'Çevrimdışı Antrenman',
      durationMinutes: 45,
      exercises: [
        {
          exerciseName: 'Squat',
          muscleGroup: 'Bacak',
          sets: [{ reps: 8, weightKg: 100 }],
        },
      ],
    });
    expect(await countQueuedMutations(DEMO_USER.id)).toBe(1);

    // Back online, but session cookie expired (401)
    setOnline(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockJsonResponse({ error: 'Oturum doğrulaması gerekli.' }, 401),
    );

    const outcome = await syncUserNow(DEMO_USER.id);
    expect(outcome.status).toBe('auth_required');
    expect(outcome.remainingPending).toBe(1);
    // Queue is strictly preserved so no user work is lost!
    expect(await countQueuedMutations(DEMO_USER.id)).toBe(1);
  });

  it('computes dashboard stats, nutrition logs, and workout summaries offline from IndexedDB', async () => {
    setActiveOfflineUserId(DEMO_USER.id);
    const localData = createEmptyUserLocalData(DEMO_USER.id);
    localData.coreFoods = [
      {
        id: 'core_oat',
        isCore: true,
        barcode: null,
        name: 'Yulaf Ezmesi',
        brand: null,
        category: 'Tahıl',
        servingLabel: '1 kase',
        servingGrams: 50,
        caloriesPer100g: 380,
        proteinPer100g: 13,
        carbsPer100g: 66,
        fatPer100g: 7,
        micronutrientsPer100g: { Mg: 140 },
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    await saveUserLocalData(localData);

    setOnline(false);
    const today = new Date().toISOString().slice(0, 10);

    await nutritionService.createLog({
      kind: 'food',
      date: today,
      mealLabel: 'Kahvaltı',
      foodId: 'core_oat',
      quantityMode: 'grams',
      grams: 100,
    });

    const logsRes = await nutritionService.listLogs({ date: today });
    expect(logsRes.logs).toHaveLength(1);
    expect(logsRes.totals.calories).toBe(380);
    expect(logsRes.totals.proteinG).toBe(13);

    const stats = await statsService.getSummary(7);
    expect(stats.summary.todayCalories).toBe(380);
  });

  it('ships valid PWA manifest, meta tags, and a secure Service Worker that never caches /api/*', () => {
    const frontendRoot = path.resolve(__dirname, '..');

    const manifestRaw = fs.readFileSync(
      path.join(frontendRoot, 'public', 'manifest.webmanifest'),
      'utf8',
    );
    const manifest = JSON.parse(manifestRaw) as {
      name: string;
      display: string;
      lang: string;
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.name).toBe('Fitness Tracker');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('tr');
    expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);

    // Verify generated icon files exist
    for (const iconFile of ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
      expect(fs.existsSync(path.join(frontendRoot, 'public', 'icons', iconFile))).toBe(true);
    }

    // Verify index.html PWA & security meta tags
    const html = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="referrer" content="no-referrer"');

    // Verify Service Worker strictly excludes /api/*, non-GET, cross-origin, and Set-Cookie
    const swSource = fs.readFileSync(path.join(frontendRoot, 'public', 'sw.js'), 'utf8');
    expect(swSource).toContain("url.pathname.startsWith('/api/')");
    expect(swSource).toContain("request.method !== 'GET'");
    expect(swSource).toContain('url.origin !== self.location.origin');
    expect(swSource).toContain("response.headers.has('Set-Cookie')");
  });
});
