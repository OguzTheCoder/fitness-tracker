import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { resolveSafeRedirectPath } from '../utils/security';

interface LoginErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { login, authNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = resolveSafeRedirectPath(
    (location.state as { from?: { pathname?: unknown } } | null)?.from?.pathname,
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const errors: LoginErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Geçerli bir e-posta adresi giriniz.';
    }
    if (!password) {
      errors.password = 'Şifre zorunludur.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Giriş Yap"
      subtitle="Fitness Tracker hesabına eriş."
      footer={
        <>
          Hesabın yok mu?{' '}
          <Link
            to="/register"
            className="font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Kayıt Ol
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {authNotice && (
          <div role="status" className="ft-alert-warn">
            {authNotice}
          </div>
        )}

        {serverError && (
          <div role="alert" className="ft-alert-error">
            {serverError}
          </div>
        )}

        <FormField
          id="email"
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          placeholder="ornek@eposta.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />

        <div className="space-y-1.5">
          <FormField
            id="password"
            name="password"
            label="Şifre"
            type="password"
            autoComplete="current-password"
            placeholder="Şifreni gir"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Şifremi unuttum
            </Link>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="ft-btn-primary w-full">
          {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </AuthLayout>
  );
}
