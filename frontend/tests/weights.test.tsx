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

function renderWeights(authenticated = true) {
  if (authenticated) {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-jwt-token');
  }
  return render(
    <MemoryRouter initialEntries={['/weights']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Frontend Weights Page (AUTH-8)', () => {
  it('redirects unauthenticated users from /weights to /login', async () => {
    renderWeights(false);
    expect(await screen.findByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
  });

  it('lists entries, validates form, and handles create + same-day upsert', async () => {
    const user = userEvent.setup();
    const initialEntries = [
      {
        id: 'w1',
        userId: 'u1',
        date: '2026-11-25',
        weightKg: 79.4,
        note: 'Sabah ölçümü',
        createdAt: '2026-11-25T07:00:00.000Z',
        updatedAt: '2026-11-25T07:00:00.000Z',
      },
    ];
    const upsertedEntry = {
      ...initialEntries[0],
      weightKg: 78.8,
      note: 'Güncel ölçüm',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: initialEntries }))
      .mockResolvedValueOnce(jsonResponse(200, { entry: upsertedEntry, updated: true }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [upsertedEntry] }));

    renderWeights(true);

    expect(await screen.findByText('Sabah ölçümü')).toBeInTheDocument();
    expect(screen.getAllByText('79.4 kg').length).toBeGreaterThanOrEqual(1);

    // Client validation blocks invalid weight
    await user.type(screen.getByLabelText('Kilo (kg)'), '10');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText('Kilo 20 ile 350 kg arasında olmalıdır.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Valid submit triggers same-day upsert feedback
    const dateInput = screen.getByLabelText('Tarih');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-25');
    await user.clear(screen.getByLabelText('Kilo (kg)'));
    await user.type(screen.getByLabelText('Kilo (kg)'), '78.8');
    await user.type(screen.getByLabelText('Not (Opsiyonel)'), 'Güncel ölçüm');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Bu tarihteki kilo kaydı güncellendi.')).toBeInTheDocument();
    expect(await screen.findByText('Güncel ölçüm')).toBeInTheDocument();
    expect(screen.getAllByText('78.8 kg').length).toBeGreaterThanOrEqual(1);
  });

  it('edits and deletes an existing weight entry', async () => {
    const user = userEvent.setup();
    const entry = {
      id: 'w1',
      userId: 'u1',
      date: '2026-11-26',
      weightKg: 78.5,
      note: 'İlk not',
      createdAt: '2026-11-26T07:00:00.000Z',
      updatedAt: '2026-11-26T07:00:00.000Z',
    };
    const edited = { ...entry, weightKg: 78.2, note: 'Düzenlenen not' };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [entry] }))
      .mockResolvedValueOnce(jsonResponse(200, { entry: edited }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [edited] }))
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Kilo kaydı silindi.' }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [] }));

    renderWeights(true);
    expect(await screen.findByText('İlk not')).toBeInTheDocument();
    expect(screen.getAllByText('78.5 kg').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    expect(screen.getByText('Kilo Kaydını Düzenle')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Kilo (kg)'));
    await user.type(screen.getByLabelText('Kilo (kg)'), '78.2');
    await user.clear(screen.getByLabelText('Not (Opsiyonel)'));
    await user.type(screen.getByLabelText('Not (Opsiyonel)'), 'Düzenlenen not');
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));

    expect(await screen.findByText('Kilo kaydı güncellendi.')).toBeInTheDocument();
    expect(await screen.findByText('Düzenlenen not')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Kilo kaydı silindi.')).toBeInTheDocument();

    const putCall = fetchSpy.mock.calls[2];
    expect(String(putCall[0])).toContain('/weights/w1');
    expect(putCall[1]?.method).toBe('PUT');

    const deleteCall = fetchSpy.mock.calls[4];
    expect(String(deleteCall[0])).toContain('/weights/w1');
    expect(deleteCall[1]?.method).toBe('DELETE');
  });

  it('validates and applies date range filters', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { user: mockUser }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { entries: [] }));

    renderWeights(true);
    await screen.findByText(/Henüz kilo kaydı eklenmemiş/i);

    await user.type(screen.getByLabelText('Başlangıç Tarihi'), '2026-11-26');
    await user.type(screen.getByLabelText('Bitiş Tarihi'), '2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Filtrele' }));
    expect(
      screen.getByText('Başlangıç tarihi bitiş tarihinden büyük olamaz.'),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await user.clear(screen.getByLabelText('Başlangıç Tarihi'));
    await user.type(screen.getByLabelText('Başlangıç Tarihi'), '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Filtrele' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/weights?from=2026-11-01&to=2026-11-20');
  });
});
