import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

const mockUser = {
  id: 'u1',
  name: 'Oğuz Yılmaz',
  email: 'oguz@example.com',
  createdAt: '2026-11-25T10:00:00.000Z',
};

const authStatusOk = {
  mode: 'local',
  isConfigured: true,
  isAuthenticated: true,
  user: mockUser,
};

const unauthStatus = {
  mode: 'local',
  isConfigured: false,
  isAuthenticated: false,
  user: null,
};

const sampleExercises = [
  {
    id: 'ex1',
    userId: null,
    isCore: true,
    coreKey: 'chest_bench_press',
    name: 'Bench Press (Barbell)',
    muscleGroup: 'Göğüs',
    equipment: 'Barbell',
    isBodyweight: false,
    notes: null,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'ex2',
    userId: null,
    isCore: true,
    coreKey: 'chest_push_up',
    name: 'Şınav (Push-Up)',
    muscleGroup: 'Göğüs',
    equipment: 'Vücut Ağırlığı',
    isBodyweight: true,
    notes: null,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
];

const sampleTemplate = {
  id: 'tpl1',
  userId: 'u1',
  name: 'İtiş Günü (Push)',
  description: 'Göğüs odaklı',
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
  exercises: [
    {
      id: 'te1',
      templateId: 'tpl1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press (Barbell)',
      muscleGroup: 'Göğüs',
      defaultSets: 2,
      defaultReps: 10,
      defaultWeightKg: 60,
      sortOrder: 0,
    },
  ],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderWorkouts() {
  return render(
    <MemoryRouter initialEntries={['/workouts']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Workouts, Templates, Cardio & Steps Page (AUTH-12)', () => {
  it('redirects unauthenticated users from /workouts to /access', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, unauthStatus));
    renderWorkouts();
    expect(await screen.findByRole('heading', { name: 'Hoş Geldin' })).toBeInTheDocument();
  });

  it('lists workouts with summary, validates form, and creates/edits/deletes a workout', async () => {
    const user = userEvent.setup();
    let entries = [
      {
        id: 'wk1',
        userId: 'u1',
        date: '2026-11-25',
        name: 'Tempolu Koşu',
        durationMinutes: 35,
        note: '5 km parkur',
        exercises: [],
        createdAt: '2026-11-25T18:00:00.000Z',
        updatedAt: '2026-11-25T18:00:00.000Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/exercises')) {
        return jsonResponse(200, {
          exercises: sampleExercises,
          total: sampleExercises.length,
          muscleGroups: ['Göğüs', 'Sırt', 'Bacak'],
        });
      }
      if (url.includes('/workout-templates')) {
        return jsonResponse(200, { templates: [sampleTemplate], total: 1 });
      }
      if (url.includes('/workouts') && method === 'GET') {
        const totalDurationMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        return jsonResponse(200, {
          entries,
          summary: { totalCount: entries.length, totalDurationMinutes },
        });
      }
      if (url.includes('/workouts') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const created = {
          id: 'wk2',
          userId: 'u1',
          ...body,
          exercises: body.exercises ?? [],
          createdAt: '2026-11-26T18:00:00.000Z',
          updatedAt: '2026-11-26T18:00:00.000Z',
        };
        entries = [created, ...entries];
        return jsonResponse(201, { entry: created });
      }
      if (url.includes('/workouts/wk2') && method === 'PUT') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        entries = entries.map((e) => (e.id === 'wk2' ? { ...e, ...body } : e));
        return jsonResponse(200, { entry: entries.find((e) => e.id === 'wk2') });
      }
      if (url.includes('/workouts/wk2') && method === 'DELETE') {
        entries = entries.filter((e) => e.id !== 'wk2');
        return jsonResponse(200, { message: 'Antrenman kaydı silindi.' });
      }
      return jsonResponse(404, { error: 'Not found' });
    });

    renderWorkouts();

    expect(await screen.findByText('Tempolu Koşu')).toBeInTheDocument();
    expect(screen.getByText('5 km parkur')).toBeInTheDocument();

    // Client validation blocks empty form
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText('Antrenman adı giriniz.')).toBeInTheDocument();
    expect(screen.getByText('Süre tam sayı olmalıdır.')).toBeInTheDocument();

    // Valid submit creates workout
    const dateInput = screen.getByLabelText('Tarih');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-26');
    await user.type(screen.getByLabelText('Antrenman Adı'), 'Üst Vücut Ağırlık');
    await user.type(screen.getByLabelText('Süre (dk)'), '50');
    await user.type(screen.getByLabelText('Not (Opsiyonel)'), 'Bench 3x10');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Antrenman kaydı eklendi.')).toBeInTheDocument();
    expect(await screen.findByText('Üst Vücut Ağırlık')).toBeInTheDocument();
    expect(screen.getByText('85 dk')).toBeInTheDocument();

    // Edit newly created workout
    const editButtons = screen.getAllByRole('button', { name: 'Düzenle' });
    await user.click(editButtons[0]);
    expect(screen.getByText('Antrenman Kaydını Düzenle')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Antrenman Adı'));
    await user.type(screen.getByLabelText('Antrenman Adı'), 'Üst Vücut Revize');
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));
    expect(await screen.findByText('Antrenman kaydı güncellendi.')).toBeInTheDocument();
    expect(await screen.findByText('Üst Vücut Revize')).toBeInTheDocument();

    // Delete it
    const deleteButtons = screen.getAllByRole('button', { name: 'Sil' });
    await user.click(deleteButtons[0]);
    expect(await screen.findByText('Antrenman kaydı silindi.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('loads a template, shows previous exercise performance reminder, and fills previous sets in one click', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/exercises')) {
        return jsonResponse(200, {
          exercises: sampleExercises,
          total: sampleExercises.length,
          muscleGroups: ['Göğüs'],
        });
      }
      if (url.includes('/workout-templates')) {
        return jsonResponse(200, { templates: [sampleTemplate], total: 1 });
      }
      if (url.includes('/workouts/previous')) {
        return jsonResponse(200, {
          byExerciseId: {
            ex1: {
              workoutId: 'old1',
              date: '2026-11-22',
              workoutName: 'Eski İtiş',
              exerciseId: 'ex1',
              exerciseName: 'Bench Press (Barbell)',
              sets: [
                { setNumber: 1, reps: 8, weightKg: 67.5 },
                { setNumber: 2, reps: 8, weightKg: 67.5 },
              ],
            },
          },
          byExerciseName: {},
        });
      }
      if (url.includes('/workouts') && method === 'GET') {
        return jsonResponse(200, { entries: [], summary: { totalCount: 0, totalDurationMinutes: 0 } });
      }
      if (url.includes('/workouts') && method === 'POST') {
        capturedBody = JSON.parse(String(init?.body ?? '{}'));
        return jsonResponse(201, {
          entry: { id: 'wk_new', userId: 'u1', ...capturedBody, createdAt: '', updatedAt: '' },
        });
      }
      return jsonResponse(404, { error: 'Not found' });
    });

    renderWorkouts();

    const tplSelect = await screen.findByLabelText('Şablondan yükle:');
    await user.selectOptions(tplSelect, 'tpl1');

    expect(await screen.findByText(/8×67.5kg · 8×67.5kg/i)).toBeInTheDocument();

    // One-click fill previous sets
    await user.click(screen.getByRole('button', { name: 'Önceki setleri doldur' }));
    expect(screen.getByLabelText('Bench Press (Barbell) set 1 ağırlık')).toHaveValue(67.5);

    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Antrenman kaydı eklendi.')).toBeInTheDocument();

    expect(capturedBody).toMatchObject({
      name: 'İtiş Günü (Push)',
      templateId: 'tpl1',
      exercises: [
        {
          exerciseId: 'ex1',
          sets: [
            { reps: 8, weightKg: 67.5 },
            { reps: 8, weightKg: 67.5 },
          ],
        },
      ],
    });
  });

  it('switches to Cardio and Daily Steps tabs and performs cardio creation and step upsert', async () => {
    const user = userEvent.setup();
    let cardioEntries: unknown[] = [];
    let stepEntries: { id: string; userId: string; date: string; steps: number; note: string | null; createdAt: string; updatedAt: string }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/access/status')) return jsonResponse(200, authStatusOk);
      if (url.includes('/exercises')) {
        return jsonResponse(200, { exercises: sampleExercises, total: 2, muscleGroups: ['Göğüs'] });
      }
      if (url.includes('/workout-templates')) {
        return jsonResponse(200, { templates: [], total: 0 });
      }
      if (url.includes('/workouts')) {
        return jsonResponse(200, { entries: [], summary: { totalCount: 0, totalDurationMinutes: 0 } });
      }
      if (url.includes('/cardio') && method === 'GET') {
        return jsonResponse(200, {
          entries: cardioEntries,
          cardioTypes: ['Yürüyüş', 'Koşu', 'Bisiklet'],
          summary: {
            totalCount: cardioEntries.length,
            totalDurationMinutes: cardioEntries.length ? 30 : 0,
            totalDistanceKm: cardioEntries.length ? 4.5 : 0,
            totalCaloriesBurned: cardioEntries.length ? 280 : 0,
          },
        });
      }
      if (url.includes('/cardio') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const entry = { id: 'c1', userId: 'u1', ...body, createdAt: '', updatedAt: '' };
        cardioEntries = [entry];
        return jsonResponse(201, { entry });
      }
      if (url.includes('/steps') && method === 'GET') {
        const todaySteps = stepEntries[0]?.steps ?? 0;
        return jsonResponse(200, {
          entries: stepEntries,
          summary: {
            dailyStepGoal: 8000,
            todayDate: '2026-11-26',
            todaySteps,
            todayProgressPercent: Math.round((todaySteps / 8000) * 100),
            totalSteps: todaySteps,
            averageDailySteps: todaySteps,
            daysLogged: stepEntries.length,
            goalMetDays: todaySteps >= 8000 ? 1 : 0,
          },
        });
      }
      if (url.includes('/steps') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const updated = stepEntries.some((s) => s.date === body.date);
        const entry = { id: 's1', userId: 'u1', ...body, createdAt: '', updatedAt: '' };
        stepEntries = [entry];
        return jsonResponse(updated ? 200 : 201, { entry, updated });
      }
      return jsonResponse(404, { error: 'Not found' });
    });

    renderWorkouts();

    // Switch to Cardio tab
    await user.click(await screen.findByRole('tab', { name: 'Kardiyo' }));
    expect(await screen.findByText(/günlük beslenme hedefine eklenmez/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Koşu' }));
    await user.type(screen.getByLabelText('Süre (dk)'), '30');
    await user.type(screen.getByLabelText('Mesafe (km, Opsiyonel)'), '4.5');
    await user.type(screen.getByLabelText('Yakılan Kalori (kcal, Opsiyonel)'), '280');
    await user.click(screen.getByRole('button', { name: 'Kardiyo Kaydet' }));

    expect(await screen.findByText('Kardiyo kaydı eklendi.')).toBeInTheDocument();
    expect((await screen.findAllByText('4.5 km')).length).toBeGreaterThanOrEqual(1);

    // Switch to Daily Steps tab
    await user.click(screen.getByRole('tab', { name: 'Günlük Adım' }));
    expect(await screen.findByText(/Bugünkü Adım İlerlemesi/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Adım Sayısı'), '9200');
    await user.click(screen.getByRole('button', { name: 'Adım Kaydet' }));

    expect(await screen.findByText('Günlük adım kaydı eklendi.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Hedef Tamam')).toBeInTheDocument();
    });
  });
});
