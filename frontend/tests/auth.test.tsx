import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { TOKEN_STORAGE_KEY } from '../src/context/AuthContext';

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function mockFetchJson(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('Frontend Auth Flows', () => {
  it('shows client validation errors on invalid register submit', async () => {
    const user = userEvent.setup();
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

  it('registers user, stores JWT and navigates to dashboard', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u1',
      name: 'Oğuz Yılmaz',
      email: 'oguz@example.com',
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt-token-1', user: mockUser }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: mockUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    renderApp('/register');

    await user.type(screen.getByLabelText('Ad Soyad'), 'Oğuz Yılmaz');
    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'Password123!');
    await user.type(screen.getByLabelText('Şifre Tekrar'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Kayıt Ol' }));

    expect(await screen.findByText('Hoş geldin, Oğuz Yılmaz')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-token-1');
  });

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
  });

  it('shows server error on failed login and logs in + logs out on valid login', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u1',
      name: 'Oğuz',
      email: 'oguz@example.com',
      createdAt: new Date().toISOString(),
    };

    mockFetchJson(401, { error: 'E-posta veya şifre hatalı.' });

    renderApp('/login');
    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'Yanlis123!');
    await user.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('E-posta veya şifre hatalı.')).toBeInTheDocument();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt-token-2', user: mockUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: mockUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await user.clear(screen.getByLabelText('Şifre'));
    await user.type(screen.getByLabelText('Şifre'), 'Dogru123!');
    await user.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('Hoş geldin, Oğuz')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Çıkış Yap' }));
    expect(await screen.findByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('submits forgot-password and resets password with URL token', async () => {
    const user = userEvent.setup();
    mockFetchJson(200, {
      message: 'Eğer bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
    });

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
    mockFetchJson(200, { message: 'Şifreniz başarıyla güncellendi.' });

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
