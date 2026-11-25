import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { ApiError } from '../services/api';
import { authService } from '../services/authService';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Geçerli bir e-posta adresi giriniz.');
      return;
    }
    setEmailError(undefined);

    setIsSubmitting(true);
    try {
      const res = await authService.forgotPassword(email.trim());
      setSuccessMessage(res.message);
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Şifremi Unuttum"
      subtitle="Kayıtlı e-posta adresine şifre sıfırlama bağlantısı gönderelim."
      footer={
        <>
          Şifreni hatırladın mı?{' '}
          <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
            Giriş Yap
          </Link>
        </>
      }
    >
      {successMessage ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"
        >
          <p className="text-sm text-emerald-200">{successMessage}</p>
          <Link
            to="/reset-password"
            className="inline-block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Sıfırlama Kodunu Gir
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
            id="email"
            name="email"
            label="E-posta"
            type="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
