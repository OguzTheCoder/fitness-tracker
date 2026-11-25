import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { ApiError } from '../services/api';
import { authService } from '../services/authService';

interface ResetErrors {
  token?: string;
  password?: string;
  confirmPassword?: string;
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ResetErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const errors: ResetErrors = {};
    if (!token.trim()) {
      errors.token = 'Sıfırlama kodu zorunludur.';
    }
    if (password.length < 8) {
      errors.password = 'Şifre en az 8 karakter olmalıdır.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Şifreler eşleşmiyor.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await authService.resetPassword(token.trim(), password);
      setSuccessMessage(res.message);
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
      title="Yeni Şifre Belirle"
      subtitle="Sıfırlama kodunu ve yeni şifreni gir."
      footer={
        <>
          <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
            Giriş ekranına dön
          </Link>
        </>
      }
    >
      {successMessage ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"
        >
          <p className="text-sm font-medium text-emerald-200">{successMessage}</p>
          <Link
            to="/login"
            className="inline-block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Giriş Yap
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              {serverError}
            </div>
          )}

          <FormField
            id="token"
            name="token"
            label="Sıfırlama Kodu"
            type="text"
            placeholder="E-postadaki sıfırlama kodu"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={fieldErrors.token}
          />

          <FormField
            id="password"
            name="password"
            label="Yeni Şifre"
            type="password"
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />

          <FormField
            id="confirmPassword"
            name="confirmPassword"
            label="Yeni Şifre Tekrar"
            type="password"
            autoComplete="new-password"
            placeholder="Yeni şifreni tekrar yaz"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
