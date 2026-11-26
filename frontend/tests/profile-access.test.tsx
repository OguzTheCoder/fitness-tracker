import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const emptyStats = {
  period: { days: 7, from: '2026-11-20', to: '2026-11-26' },
  summary: {
    latestWeightKg: null,
    latestWeightDate: null,
    weightChangeKg: null,
    todayCalories: 0,
    averageDailyCalories: 0,
    calorieDaysLogged: 0,
    workoutCount: 0,
    workoutDurationMinutes: 0,
  },
  trends: { weights: [], calories: [] },
};

const sampleCatalog = [
  { key: 'Na', label: 'Sodyum (Na)', unit: 'mg', category: 'mineral' },
  { key: 'K', label: 'Potasyum (K)', unit: 'mg', category: 'mineral' },
  { key: 'Mg', label: 'Magnezyum (Mg)', unit: 'mg', category: 'mineral' },
  { key: 'Ca', label: 'Kalsiyum (Ca)', unit: 'mg', category: 'mineral' },
  { key: 'Fe', label: 'Demir (Fe)', unit: 'mg', category: 'mineral' },
  { key: 'Zn', label: 'Çinko (Zn)', unit: 'mg', category: 'mineral' },
  { key: 'VitD', label: 'D Vitamini', unit: 'µg', category: 'vitamin' },
  { key: 'VitB12', label: 'B12 Vitamini', unit: 'µg', category: 'vitamin' },
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Personal Access, PIN Lock & Profile Page (AUTH-9 / v1.0.2)', () => {
  it('completes local mode first setup with name only and lands on dashboard without localStorage', async () => {
    const user = userEvent.setup();
    const ownerUser = {
      id: 'p1',
      name: 'Oğuz',
      email: 'personal@local.fitness',
      createdAt: '2026-11-26T10:00:00.000Z',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'local',
          isConfigured: false,
          isAuthenticated: false,
          user: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { mode: 'local', user: ownerUser }))
      .mockResolvedValueOnce(jsonResponse(200, emptyStats));

    renderAt('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Hoş Geldin' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Başla' }));
    expect(screen.getByText('Adınız en az 2 karakter olmalıdır.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Adın'), 'Oğuz');
    await user.click(screen.getByRole('button', { name: 'Başla' }));

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(screen.getByText('Kişisel Profil')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/access/setup');
  });

  it('resumes existing local session with one click when configured', async () => {
    const user = userEvent.setup();
    const ownerUser = {
      id: 'p1',
      name: 'Oğuz',
      email: 'personal@local.fitness',
      createdAt: '2026-11-26T10:00:00.000Z',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'local',
          isConfigured: true,
          isAuthenticated: false,
          user: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { mode: 'local', user: ownerUser }))
      .mockResolvedValueOnce(jsonResponse(200, emptyStats));

    renderAt('/access');

    expect(await screen.findByRole('heading', { name: 'Tekrar Hoş Geldin' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Devam Et' }));

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/access/local-session');
  });

  it('shows PIN lock screen in pin mode, handles wrong PIN error, and unlocks on valid PIN', async () => {
    const user = userEvent.setup();
    const ownerUser = {
      id: 'p1',
      name: 'Oğuz',
      email: 'personal@local.fitness',
      createdAt: '2026-11-26T10:00:00.000Z',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'pin',
          isConfigured: true,
          isAuthenticated: false,
          user: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: 'PIN hatalı.' }))
      .mockResolvedValueOnce(jsonResponse(200, { mode: 'pin', user: ownerUser }))
      .mockResolvedValueOnce(jsonResponse(200, emptyStats));

    renderAt('/dashboard');

    expect(await screen.findByRole('heading', { name: 'PIN Kilidi' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Kişisel PIN'), '12');
    await user.click(screen.getByRole('button', { name: 'Kilidi Aç' }));
    expect(screen.getByText('PIN en az 4 karakter olmalıdır.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Kişisel PIN'));
    await user.type(screen.getByLabelText('Kişisel PIN'), '0000');
    await user.click(screen.getByRole('button', { name: 'Kilidi Aç' }));
    expect(await screen.findByText('PIN hatalı.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Kişisel PIN'));
    await user.type(screen.getByLabelText('Kişisel PIN'), '246810');
    await user.click(screen.getByRole('button', { name: 'Kilidi Aç' }));

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(String(fetchSpy.mock.calls[2]?.[0])).toContain('/access/unlock');
    expect(localStorage.length).toBe(0);
  });

  it('loads default profile goals & 6 minerals, updates settings, and revokes all sessions', async () => {
    const user = userEvent.setup();
    const ownerUser = {
      id: 'p1',
      name: 'Oğuz',
      email: 'personal@local.fitness',
      createdAt: '2026-11-26T10:00:00.000Z',
    };
    const initialProfile = {
      id: 'prof1',
      userId: 'p1',
      name: 'Oğuz',
      email: 'personal@local.fitness',
      dailyCalorieGoal: 2000,
      proteinGoalG: 150,
      carbsGoalG: 200,
      fatGoalG: 65,
      dailyStepGoal: 8000,
      visibleMicronutrients: ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'],
      updatedAt: '2026-11-26T10:00:00.000Z',
    };
    const updatedProfile = {
      ...initialProfile,
      name: 'Oğuzhan',
      dailyCalorieGoal: 2300,
      dailyStepGoal: 10000,
      visibleMicronutrients: ['K', 'Mg', 'Ca', 'Fe', 'Zn', 'VitD'],
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          mode: 'pin',
          isConfigured: true,
          isAuthenticated: true,
          user: ownerUser,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          profile: initialProfile,
          availableMicronutrients: sampleCatalog,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          profile: updatedProfile,
          availableMicronutrients: sampleCatalog,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { message: 'Tüm cihazlardaki oturumlar sonlandırıldı.' }),
      );

    renderAt('/profile');

    expect(
      await screen.findByRole('heading', { name: 'Profil ve Günlük Hedefler' }),
    ).toBeInTheDocument();
    expect((screen.getByLabelText('Günlük Kalori Hedefi (kcal)') as HTMLInputElement).value).toBe(
      '2000',
    );
    expect((screen.getByLabelText('Protein Hedefi (g)') as HTMLInputElement).value).toBe('150');
    expect((screen.getByLabelText('Karbonhidrat Hedefi (g)') as HTMLInputElement).value).toBe('200');
    expect((screen.getByLabelText('Yağ Hedefi (g)') as HTMLInputElement).value).toBe('65');
    expect((screen.getByLabelText('Günlük Adım Hedefi') as HTMLInputElement).value).toBe('8000');
    expect(screen.getByText('Seçili: 6 mikro besin')).toBeInTheDocument();

    // Update name, calorie goal, step goal, and toggle Na off + VitD on
    await user.clear(screen.getByLabelText('Ad'));
    await user.type(screen.getByLabelText('Ad'), 'Oğuzhan');
    await user.clear(screen.getByLabelText('Günlük Kalori Hedefi (kcal)'));
    await user.type(screen.getByLabelText('Günlük Kalori Hedefi (kcal)'), '2300');
    await user.clear(screen.getByLabelText('Günlük Adım Hedefi'));
    await user.type(screen.getByLabelText('Günlük Adım Hedefi'), '10000');

    await user.click(screen.getByLabelText(/Sodyum \(Na\)/i));
    await user.click(screen.getByLabelText(/D Vitamini/i));
    await user.click(screen.getByRole('button', { name: 'Profili Kaydet' }));

    expect(await screen.findByText('Profil ve hedeflerin kaydedildi.')).toBeInTheDocument();
    expect(screen.getByText('Oğuzhan')).toBeInTheDocument();

    const putCall = fetchSpy.mock.calls[2];
    expect(String(putCall?.[0])).toContain('/profile');
    expect(putCall?.[1]?.method).toBe('PUT');
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
      name: 'Oğuzhan',
      dailyCalorieGoal: 2300,
      dailyStepGoal: 10000,
      visibleMicronutrients: ['K', 'Mg', 'Ca', 'Fe', 'Zn', 'VitD'],
    });

    // Revoke all device sessions
    await user.click(screen.getByRole('button', { name: 'Tüm Cihazlardan Çıkış Yap' }));
    expect(await screen.findByRole('heading', { name: 'PIN Kilidi' })).toBeInTheDocument();
    await waitFor(() => {
      expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/auth/logout-all');
    });
  });
});
