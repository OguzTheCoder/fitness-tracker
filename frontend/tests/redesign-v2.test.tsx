import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

const mockUser = {
  id: 'u1',
  name: 'Oğuz',
  email: 'personal@local.fitness',
  createdAt: '2026-11-26T10:00:00.000Z',
};

const authStatusOk = {
  mode: 'local',
  isConfigured: true,
  isAuthenticated: true,
  user: mockUser,
};

const sampleStats = {
  period: { days: 7, from: '2026-11-20', to: '2026-11-26' },
  summary: {
    latestWeightKg: 78.4,
    latestWeightDate: '2026-11-26',
    weightChangeKg: -0.6,
    todayCalories: 1450,
    averageDailyCalories: 1900,
    calorieDaysLogged: 4,
    workoutCount: 3,
    workoutDurationMinutes: 140,
    cardioCount: 2,
    cardioDurationMinutes: 60,
    cardioDistanceKm: 8.5,
    cardioCaloriesBurned: 420,
    todaySteps: 6400,
    dailyStepGoal: 8000,
    averageDailySteps: 7200,
    stepDaysLogged: 5,
  },
  trends: {
    weights: [
      { date: '2026-11-24', value: 79.0 },
      { date: '2026-11-26', value: 78.4 },
    ],
    calories: [
      { date: '2026-11-24', value: 1950 },
      { date: '2026-11-26', value: 1450 },
    ],
    steps: [
      { date: '2026-11-25', value: 8200 },
      { date: '2026-11-26', value: 6400 },
    ],
  },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockMatchMedia(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: desktop,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('Frontend v2.0.0 Redesign — Theme, Responsive Navigation, Bento & Accessibility (AUTH-15)', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.add('dark');
    vi.restoreAllMocks();
  });

  it('defaults to dark mode without writing localStorage and switches cleanly to light theme', async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(200, sampleStats));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.length).toBe(0);

    // Toggle to light mode
    await user.click(screen.getByRole('button', { name: 'Açık temaya geç' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('ft_theme')).toBe('light');

    // Toggle back to dark mode
    await user.click(screen.getByRole('button', { name: 'Koyu temaya geç' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('ft_theme')).toBe('dark');
  });

  it('renders Sidebar on desktop and Bottom Navigation Bar on mobile viewports without duplicate nav landmarks', async () => {
    // 1. Desktop viewport -> Sidebar present
    mockMatchMedia(true);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(200, sampleStats));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Kenar çubuğu')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Ana menü' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Beslenme' })).toBeInTheDocument();
    unmount();

    // 2. Mobile viewport -> No Sidebar, Bottom Bar nav present with all 5 items
    mockMatchMedia(false);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(200, sampleStats));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(screen.queryByLabelText('Kenar çubuğu')).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Ana menü' })).toHaveLength(1);
    for (const label of ['Özet', 'Beslenme', 'Antrenman', 'Kilo', 'Profil']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('supports Dashboard ProgressRings, interactive chart point readout, and Quick Add Weight Drawer', async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(200, sampleStats))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          entry: { id: 'w-q1', date: '2026-11-26', weightKg: 78.1, note: null },
          updated: false,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...sampleStats,
          summary: { ...sampleStats.summary, latestWeightKg: 78.1 },
        }),
      );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('78.4 kg')).toBeInTheDocument();
    // Accessible progress rings
    expect(screen.getByRole('progressbar', { name: 'Bugünkü kalori ilerlemesi' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Bugünkü adım hedefi ilerlemesi' })).toBeInTheDocument();

    // Open Quick Add Weight Drawer
    await user.click(screen.getByRole('button', { name: '+ Hızlı Kilo' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hızlı Kilo Kaydı' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Kilo (kg)'), '78.1');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Hızlı kilo kaydı kaydedildi.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('78.1 kg')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('filters and selects foods via live-search Combobox inside the Nutrition Drawer', async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/foods')) {
        return jsonResponse(200, {
          foods: [
            {
              id: 'f1',
              isCore: true,
              name: 'Tavuk Göğsü',
              brand: null,
              category: 'Protein',
              servingLabel: '1 porsiyon',
              servingGrams: 150,
              caloriesPer100g: 165,
              proteinPer100g: 31,
              carbsPer100g: 0,
              fatPer100g: 3.6,
              micronutrientsPer100g: {},
              createdAt: '',
              updatedAt: '',
            },
            {
              id: 'f2',
              isCore: true,
              name: 'Yulaf Ezmesi',
              brand: null,
              category: 'Tahıl',
              servingLabel: '1 kase',
              servingGrams: 50,
              caloriesPer100g: 379,
              proteinPer100g: 13.2,
              carbsPer100g: 67.7,
              fatPer100g: 6.5,
              micronutrientsPer100g: {},
              createdAt: '',
              updatedAt: '',
            },
          ],
          total: 2,
        });
      }
      if (url.includes('/recipes')) return jsonResponse(200, { recipes: [], total: 0 });
      if (url.includes('/profile')) {
        return jsonResponse(200, {
          profile: {
            id: 'p1',
            userId: 'u1',
            name: 'Oğuz',
            email: 'personal@local.fitness',
            dailyCalorieGoal: 2000,
            proteinGoalG: 150,
            carbsGoalG: 200,
            fatGoalG: 65,
            dailyStepGoal: 8000,
            visibleMicronutrients: [],
          },
          availableMicronutrients: [],
        });
      }
      if (url.includes('/nutrition/logs')) {
        return jsonResponse(200, {
          date: '2026-11-26',
          logs: [],
          totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, micronutrients: {} },
          goals: { dailyCalorieGoal: 2000, proteinGoalG: 150, carbsGoalG: 200, fatGoalG: 65 },
          visibleMicronutrients: [],
          dailyTotals: [],
        });
      }
      return jsonResponse(404, { error: 'Not mocked' });
    });

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Besin / Tarif Ekle' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Besin Ara');
    await user.type(searchInput, 'Yulaf');

    const listbox = screen.getByRole('listbox', { name: 'Besin seçimi' });
    expect(listbox).toHaveTextContent('Yulaf Ezmesi');
    expect(listbox).not.toHaveTextContent('Tavuk Göğsü');

    // Escape closes drawer cleanly
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('ships synchronized v2.0.0 versions across backend, frontend, and Service Worker cache', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const backendPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'backend', 'package.json'), 'utf8'),
    ) as { version: string };
    const frontendPkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'frontend', 'package.json'), 'utf8'),
    ) as { version: string };
    const swSrc = fs.readFileSync(
      path.join(repoRoot, 'frontend', 'public', 'sw.js'),
      'utf8',
    );

    expect(backendPkg.version).toBe('2.0.0');
    expect(frontendPkg.version).toBe('2.0.0');
    expect(swSrc).toContain("const CACHE_NAME = 'ft-shell-v2.0.0'");
  });
});
