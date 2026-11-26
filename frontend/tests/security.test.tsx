import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { resolveSafeRedirectPath } from '../src/utils/security';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

describe('Frontend Security Suite (AUTH-8 / v1.0.1)', () => {
  it('G-008: strips ?token= from URL and browser history while keeping token in form state', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <MemoryRouter initialEntries={['/reset-password?token=sensitive-reset-token-999']}>
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    const tokenInput = screen.getByLabelText('Sıfırlama Kodu') as HTMLInputElement;
    expect(tokenInput.value).toBe('sensitive-reset-token-999');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/reset-password');
      expect(screen.getByTestId('location-probe').textContent).not.toContain('sensitive-reset-token-999');
    });

    expect(replaceStateSpy).toHaveBeenCalled();
    const lastUrlArg = String(replaceStateSpy.mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrlArg).not.toContain('sensitive-reset-token-999');
    replaceStateSpy.mockRestore();

    const indexHtml = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<meta name="referrer" content="no-referrer" />');
  });

  it('G-011: resolveSafeRedirectPath rejects protocol-relative, external, and malformed redirect targets', () => {
    expect(resolveSafeRedirectPath('/weights')).toBe('/weights');
    expect(resolveSafeRedirectPath('/calories?from=2026-11-01')).toBe('/calories?from=2026-11-01');

    expect(resolveSafeRedirectPath('//evil.example.com')).toBe('/dashboard');
    expect(resolveSafeRedirectPath('/\\evil.example.com')).toBe('/dashboard');
    expect(resolveSafeRedirectPath('https://evil.example.com')).toBe('/dashboard');
    expect(resolveSafeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
    expect(resolveSafeRedirectPath('/weights\r\nSet-Cookie: bad=1')).toBe('/dashboard');
    expect(resolveSafeRedirectPath(undefined)).toBe('/dashboard');
  });

  it('G-011: LoginPage ignores unsafe location.state.from.pathname and redirects safely to /dashboard', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u-sec',
      name: 'Oğuz',
      email: 'oguz@example.com',
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: 'local',
            isConfigured: false,
            isAuthenticated: false,
            user: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: mockUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { from: { pathname: '//evil.example.com/phish' } } },
        ]}
      >
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('E-posta'), 'oguz@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/dashboard');
    });
  });

  it('G-005: does not store JWT in localStorage and sends credentials: include on API calls', () => {
    const authContextSrc = fs.readFileSync(
      path.join(frontendRoot, 'src', 'context', 'AuthContext.tsx'),
      'utf8',
    );
    const apiSrc = fs.readFileSync(path.join(frontendRoot, 'src', 'services', 'api.ts'), 'utf8');

    expect(authContextSrc).not.toContain('localStorage');
    expect(authContextSrc).not.toContain('sessionStorage');
    expect(apiSrc).toContain("credentials: 'include'");
    expect(apiSrc).not.toContain('Authorization');
  });
});
