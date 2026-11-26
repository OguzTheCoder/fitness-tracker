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

function renderWorkouts(authenticated = true) {
  if (authenticated) {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-jwt-token');
  }
  return render(
    <MemoryRouter initialEntries={['/workouts']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Workouts Page (AUTH-10)', () => {
  it('redirects unauthenticated users from /workouts to /login', async () => {
    renderWorkouts(false);
    expect(await screen.findByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
  });

  it('lists workouts with summary, validates form, and creates a new workout', async () => {
    const user = userEvent.setup();
    const initial = [
      {
        id: 'wk1',
        userId: 'u1',
        date: '2026-11-25',
        name: 'Tempolu Koşu',
        durationMinutes: 35,
        note: '5 km parkur',
        createdAt: '2026-11-25T18:00:00.000Z',
        updatedAt: '2026-11-25T18:00:00.000Z',
      },
    ];
    const created = {
      id: 'wk2',
      userId: 'u1',
      date: '2026-11-26',
      name: 'Üst Vücut Ağırlık',
      durationMinutes: 50,
      note: 'Bench 3x10',
      createdAt: '2026-11-26T18:00:00.000Z',
      updatedAt: '2026-11-26T18:00:00.000Z',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: initial,
          summary: { totalCount: 1, totalDurationMinutes: 35 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { entry: created }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [created, ...initial],
          summary: { totalCount: 2, totalDurationMinutes: 85 },
        }),
      );

    renderWorkouts(true);

    expect(await screen.findByText('Tempolu Koşu')).toBeInTheDocument();
    expect(screen.getByText('5 km parkur')).toBeInTheDocument();

    // Client validation blocks empty form
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText('Antrenman adı giriniz.')).toBeInTheDocument();
    expect(screen.getByText('Süre tam sayı olmalıdır.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

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
  });

  it('edits and deletes an existing workout entry', async () => {
    const user = userEvent.setup();
    const entry = {
      id: 'wk1',
      userId: 'u1',
      date: '2026-11-26',
      name: 'Bacak',
      durationMinutes: 45,
      note: 'Squat',
      createdAt: '2026-11-26T17:00:00.000Z',
      updatedAt: '2026-11-26T17:00:00.000Z',
    };
    const edited = { ...entry, name: 'Bacak & Core', durationMinutes: 60, note: 'Squat + Plank' };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [entry],
          summary: { totalCount: 1, totalDurationMinutes: 45 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { entry: edited }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [edited],
          summary: { totalCount: 1, totalDurationMinutes: 60 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Antrenman kaydı silindi.' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [],
          summary: { totalCount: 0, totalDurationMinutes: 0 },
        }),
      );

    renderWorkouts(true);
    expect(await screen.findByText('Bacak')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    expect(screen.getByText('Antrenman Kaydını Düzenle')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Antrenman Adı'));
    await user.type(screen.getByLabelText('Antrenman Adı'), 'Bacak & Core');
    await user.clear(screen.getByLabelText('Süre (dk)'));
    await user.type(screen.getByLabelText('Süre (dk)'), '60');
    await user.clear(screen.getByLabelText('Not (Opsiyonel)'));
    await user.type(screen.getByLabelText('Not (Opsiyonel)'), 'Squat + Plank');
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));

    expect(await screen.findByText('Antrenman kaydı güncellendi.')).toBeInTheDocument();
    expect(await screen.findByText('Bacak & Core')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Antrenman kaydı silindi.')).toBeInTheDocument();

    const putCall = fetchSpy.mock.calls[2];
    expect(String(putCall[0])).toContain('/workouts/wk1');
    expect(putCall[1]?.method).toBe('PUT');

    const deleteCall = fetchSpy.mock.calls[4];
    expect(String(deleteCall[0])).toContain('/workouts/wk1');
    expect(deleteCall[1]?.method).toBe('DELETE');
  });

  it('applies from/to date range filters on /workouts', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [],
          summary: { totalCount: 0, totalDurationMinutes: 0 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [],
          summary: { totalCount: 0, totalDurationMinutes: 0 },
        }),
      );

    renderWorkouts(true);
    await screen.findByText(/Henüz antrenman kaydı eklenmemiş/i);

    await user.type(screen.getByLabelText('Başlangıç Tarihi'), '2026-11-20');
    await user.type(screen.getByLabelText('Bitiş Tarihi'), '2026-11-26');
    await user.click(screen.getByRole('button', { name: 'Filtrele' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/workouts?from=2026-11-20&to=2026-11-26');
  });
});
