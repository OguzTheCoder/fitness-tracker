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

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Stats Dashboard (AUTH-12)', () => {
  it('renders summary cards including cardio & steps, SVG trend charts, and switches 7/30/90 day periods', async () => {
    const user = userEvent.setup();

    const stats7 = {
      period: { days: 7, from: '2026-11-20', to: '2026-11-26' },
      summary: {
        latestWeightKg: 78.5,
        latestWeightDate: '2026-11-26',
        weightChangeKg: -1.0,
        todayCalories: 1200,
        averageDailyCalories: 1500,
        calorieDaysLogged: 2,
        workoutCount: 3,
        workoutDurationMinutes: 135,
        cardioCount: 2,
        cardioDurationMinutes: 65,
        cardioDistanceKm: 9.2,
        cardioCaloriesBurned: 520,
        todaySteps: 9400,
        dailyStepGoal: 8000,
        averageDailySteps: 8600,
        stepDaysLogged: 2,
      },
      trends: {
        weights: [
          { date: '2026-11-24', value: 79.5 },
          { date: '2026-11-26', value: 78.5 },
        ],
        calories: [
          { date: '2026-11-24', value: 1800 },
          { date: '2026-11-26', value: 1200 },
        ],
        steps: [
          { date: '2026-11-25', value: 7800 },
          { date: '2026-11-26', value: 9400 },
        ],
      },
    };

    const stats30 = {
      ...stats7,
      period: { days: 30, from: '2026-10-28', to: '2026-11-26' },
      summary: {
        ...stats7.summary,
        weightChangeKg: -2.5,
        workoutCount: 11,
        workoutDurationMinutes: 510,
        cardioCount: 7,
        cardioDurationMinutes: 240,
      },
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(200, stats7))
      .mockResolvedValueOnce(jsonResponse(200, stats30));

    renderDashboard();

    expect(await screen.findByText('78.5 kg')).toBeInTheDocument();
    expect(screen.getByText('1200 kcal')).toBeInTheDocument();
    expect(screen.getByText('135 dk')).toBeInTheDocument();
    expect(screen.getByText('65 dk')).toBeInTheDocument();
    expect(screen.getByText(/2 seans · 9.2 km/i)).toBeInTheDocument();
    expect(screen.getByText(/%118/i)).toBeInTheDocument();
    expect(screen.getByText(/Dönem değişimi: -1 kg/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kilo Trendi grafiği' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Günlük Kalori Trendi grafiği' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Günlük Adım Trendi grafiği' })).toBeInTheDocument();

    // Switch to 30 days
    await user.click(screen.getByRole('button', { name: 'Son 30 Gün' }));

    expect(await screen.findByText('510 dk')).toBeInTheDocument();
    expect(screen.getByText('240 dk')).toBeInTheDocument();
    expect(screen.getByText(/Dönem değişimi: -2.5 kg/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/stats/summary?days=30');
  });

  it('shows clean empty states when user has no entries yet', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(
        jsonResponse(200, {
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
            cardioCount: 0,
            cardioDurationMinutes: 0,
            cardioDistanceKm: 0,
            cardioCaloriesBurned: 0,
            todaySteps: 0,
            dailyStepGoal: 8000,
            averageDailySteps: 0,
            stepDaysLogged: 0,
          },
          trends: { weights: [], calories: [], steps: [] },
        }),
      );

    renderDashboard();

    expect(await screen.findByText('Kayıt yok')).toBeInTheDocument();
    expect(screen.getByText(/Bu dönem için kilo ölçümü bulunmuyor/i)).toBeInTheDocument();
    expect(screen.getByText(/Bu dönem için kalori kaydı bulunmuyor/i)).toBeInTheDocument();
  });

  it('shows error banner gracefully when stats request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, authStatusOk))
      .mockResolvedValueOnce(jsonResponse(500, { error: 'Sunucu hatası oluştu.' }));

    renderDashboard();

    expect(await screen.findByText('Sunucu hatası oluştu.')).toBeInTheDocument();
    expect(screen.getByText('Hoş geldin, Oğuz Yılmaz')).toBeInTheDocument();
  });
});
