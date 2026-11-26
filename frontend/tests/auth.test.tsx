import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const unauthLocalStatus = {
  mode: 'local',
  isConfigured: false,
  isAuthenticated: false,
  user: null,
};

describe('Frontend Auth Flows', () => {
  it('shows client validation errors on invalid register submit', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus));
    renderApp('/register');

    await user.type(screen.getByLabelText('Ad Soyad'), 'A');
    await user.type(screen.getByLabelText('E-posta'), 'hatali');
    await user.type(screen.getByLabelText('Şifre'), '123');
    await user.type(screen.getByLabelText('Şifre Tekrar'), '456');
    await user.click(screen.getByRole('button', { name: 'Kayıt Ol' }));

    expect(screen.getByText('Ad soyad en az 2 karakter olmalıdır.')).toBeInTheDocument();
    expect(screen.getByText('Geçerli bir e-posta adresi giriniz.')).toBeInTheDocument();
    expect(screen.getByText('Şifre en az 8 karakter olmalıdır.')).toBeInTheDocument();
    expect(screen.getByText('Şifreler eşleşmiyor.')).toBeInTheDocument();
  });

  it('registers user with HttpOnly cookie session (no localStorage) and navigates to dashboard', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u1',
      name: 'Oğuz Yılmaz',
      email: 'oguz@example.com',
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus))
      .mockResolvedValueOnce(jsonResponse(201, { user: mockUser }))
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

    renderApp('/register');

    await user.type(screen.getByLabelText('Ad Soyad'), 'Oğuz Yılmaz');
    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'Password123!');
    await user.type(screen.getByLabelText('Şifre Tekrar'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Kayıt Ol' }));

    expect(await screen.findByText('Hoş geldin, Oğuz Yılmaz')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(fetchSpy.mock.calls[1]?.[1]?.credentials).toBe('include');
  });

  it('redirects unauthenticated users from /dashboard to /access', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus));
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Hoş Geldin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'E-posta ile Giriş' })).toBeInTheDocument();
  });

  it('shows server error on failed login and logs in + logs out via cookie endpoints', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u1',
      name: 'Oğuz',
      email: 'oguz@example.com',
      createdAt: new Date().toISOString(),
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'E-posta veya şifre hatalı.' }))
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
      )
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Oturum kapatıldı.' }));

    renderApp('/login');
    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'Yanlis123!');
    await user.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('E-posta veya şifre hatalı.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Şifre'));
    await user.type(screen.getByLabelText('Şifre'), 'Dogru123!');
    await user.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Çıkış Yap' }));
    expect(await screen.findByRole('heading', { name: 'Hoş Geldin' })).toBeInTheDocument();
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/auth/logout');
    expect(localStorage.length).toBe(0);
  });

  it('submits forgot-password and resets password with URL token', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          message: 'Eğer bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
        }),
      );

    renderApp('/forgot-password');
    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.click(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }));

    expect(
      await screen.findByText(
        'Eğer bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
      ),
    ).toBeInTheDocument();
  });

  it('prefills token from query string and submits reset-password', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, unauthLocalStatus))
      .mockResolvedValueOnce(jsonResponse(200, { message: 'Şifreniz başarıyla güncellendi.' }));

    renderApp('/reset-password?token=demo-reset-token');

    const tokenInput = screen.getByLabelText('Sıfırlama Kodu') as HTMLInputElement;
    expect(tokenInput.value).toBe('demo-reset-token');

    await user.type(screen.getByLabelText('Yeni Şifre'), 'NewPassword123!');
    await user.type(screen.getByLabelText('Yeni Şifre Tekrar'), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: 'Şifreyi Güncelle' }));

    await waitFor(() => {
      expect(screen.getByText('Şifreniz başarıyla güncellendi.')).toBeInTheDocument();
    });
  });
});
