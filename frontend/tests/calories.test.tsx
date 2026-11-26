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

function renderCalories(authenticated = true) {
  if (authenticated) {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-jwt-token');
  }
  return render(
    <MemoryRouter initialEntries={['/calories']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Calories Page (AUTH-9)', () => {
  it('redirects unauthenticated users from /calories to /login', async () => {
    renderCalories(false);
    expect(await screen.findByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
  });

  it('shows daily grouped totals, validates form, and creates a new meal entry', async () => {
    const user = userEvent.setup();
    const initialEntries = [
      {
        id: 'c1',
        userId: 'u1',
        date: '2026-11-26',
        mealName: 'Kahvaltı - 2 yumurta',
        calories: 450,
        createdAt: '2026-11-26T08:00:00.000Z',
        updatedAt: '2026-11-26T08:00:00.000Z',
      },
      {
        id: 'c2',
        userId: 'u1',
        date: '2026-11-26',
        mealName: 'Öğle - Tavuk salata',
        calories: 380,
        createdAt: '2026-11-26T12:00:00.000Z',
        updatedAt: '2026-11-26T12:00:00.000Z',
      },
    ];
    const newEntry = {
      id: 'c3',
      userId: 'u1',
      date: '2026-11-26',
      mealName: 'Akşam - Somon',
      calories: 520,
      createdAt: '2026-11-26T19:00:00.000Z',
      updatedAt: '2026-11-26T19:00:00.000Z',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: initialEntries,
          dailyTotals: [{ date: '2026-11-26', totalCalories: 830, count: 2 }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { entry: newEntry }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [newEntry, ...initialEntries],
          dailyTotals: [{ date: '2026-11-26', totalCalories: 1350, count: 3 }],
        }),
      );

    renderCalories(true);

    expect(await screen.findByText('Günlük Toplam: 830 kcal')).toBeInTheDocument();
    expect(screen.getByText('Kahvaltı - 2 yumurta')).toBeInTheDocument();
    expect(screen.getByText('Öğle - Tavuk salata')).toBeInTheDocument();

    // Client validation blocks empty meal & invalid kcal
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText('Öğün açıklaması giriniz.')).toBeInTheDocument();
    expect(screen.getByText('Kalori tam sayı olmalıdır.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Valid submit creates entry and updates daily total
    const dateInput = screen.getByLabelText('Tarih');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-26');
    await user.type(screen.getByLabelText('Öğün'), 'Akşam - Somon');
    await user.type(screen.getByLabelText('Kalori (kcal)'), '520');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Kalori kaydı eklendi.')).toBeInTheDocument();
    expect(await screen.findByText('Günlük Toplam: 1350 kcal')).toBeInTheDocument();
    expect(screen.getByText('Akşam - Somon')).toBeInTheDocument();
  });

  it('edits and deletes an existing calorie entry', async () => {
    const user = userEvent.setup();
    const entry = {
      id: 'c1',
      userId: 'u1',
      date: '2026-11-26',
      mealName: 'Ara öğün - Elma',
      calories: 95,
      createdAt: '2026-11-26T15:00:00.000Z',
      updatedAt: '2026-11-26T15:00:00.000Z',
    };
    const edited = { ...entry, mealName: 'Ara öğün - Elma ve yoğurt', calories: 210 };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [entry],
          dailyTotals: [{ date: '2026-11-26', totalCalories: 95, count: 1 }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { entry: edited }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entries: [edited],
          dailyTotals: [{ date: '2026-11-26', totalCalories: 210, count: 1 }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Kalori kaydı silindi.' }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [], dailyTotals: [] }));

    renderCalories(true);
    expect(await screen.findByText('Ara öğün - Elma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    expect(screen.getByText('Kalori Kaydını Düzenle')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Öğün'));
    await user.type(screen.getByLabelText('Öğün'), 'Ara öğün - Elma ve yoğurt');
    await user.clear(screen.getByLabelText('Kalori (kcal)'));
    await user.type(screen.getByLabelText('Kalori (kcal)'), '210');
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));

    expect(await screen.findByText('Kalori kaydı güncellendi.')).toBeInTheDocument();
    expect(await screen.findByText('Günlük Toplam: 210 kcal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Kalori kaydı silindi.')).toBeInTheDocument();

    const putCall = fetchSpy.mock.calls[2];
    expect(String(putCall[0])).toContain('/calories/c1');
    expect(putCall[1]?.method).toBe('PUT');

    const deleteCall = fetchSpy.mock.calls[4];
    expect(String(deleteCall[0])).toContain('/calories/c1');
    expect(deleteCall[1]?.method).toBe('DELETE');
  });

  it('applies from/to date range filters on /calories', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [], dailyTotals: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [], dailyTotals: [] }));

    renderCalories(true);
    await screen.findByText(/Henüz kalori kaydı eklenmemiş/i);

    await user.type(screen.getByLabelText('Başlangıç Tarihi'), '2026-11-20');
    await user.type(screen.getByLabelText('Bitiş Tarihi'), '2026-11-26');
    await user.click(screen.getByRole('button', { name: 'Filtrele' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/calories?from=2026-11-20&to=2026-11-26');
  });
});
