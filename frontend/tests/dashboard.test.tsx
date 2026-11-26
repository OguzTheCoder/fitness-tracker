import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { TOKEN_STORAGE_KEY } from '../src/context/AuthContext';

const mockUser = {
  id: 'u1',
  name: 'Oğuz Yılmaz',
  email: 'oguz@example.com',
  createdAt: '2026-11-25T10:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard() {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'test-jwt-token');
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Stats Dashboard (AUTH-11)', () => {
  it('renders 4 summary cards, both SVG trend charts, and switches 7/30/90 day periods', async () => {
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
      },
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(200, stats7))
      .mockResolvedValueOnce(jsonResponse(200, stats30));

    renderDashboard();

    expect(await screen.findByText('78.5 kg')).toBeInTheDocument();
    expect(screen.getByText('1200 kcal')).toBeInTheDocument();
    expect(screen.getByText('135 dk')).toBeInTheDocument();
    expect(screen.getByText(/Dönem değişimi: -1 kg/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kilo Trendi grafiği' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Günlük Kalori Trendi grafiği' })).toBeInTheDocument();

    // Switch to 30 days
    await user.click(screen.getByRole('button', { name: 'Son 30 Gün' }));

    expect(await screen.findByText('510 dk')).toBeInTheDocument();
    expect(screen.getByText(/Dönem değişimi: -2.5 kg/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/stats/summary?days=30');
  });

  it('shows clean empty states when user has no entries yet', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
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
          },
          trends: { weights: [], calories: [] },
        }),
      );

    renderDashboard();

    expect(await screen.findByText('Kayıt yok')).toBeInTheDocument();
    expect(
      screen.getByText(/Bu dönem için kilo ölçümü bulunmuyor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bu dönem için kalori kaydı bulunmuyor/i),
    ).toBeInTheDocument();
  });

  it('shows error banner gracefully when stats request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(500, { error: 'Sunucu hatası oluştu.' }));

    renderDashboard();

    expect(await screen.findByText('Sunucu hatası oluştu.')).toBeInTheDocument();
    expect(screen.getByText('Hoş geldin, Oğuz Yılmaz')).toBeInTheDocument();
  });
});
