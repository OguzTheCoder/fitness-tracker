import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateRegister(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = 'Ad soyad en az 2 karakter olmalıdır.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Geçerli bir e-posta adresi giriniz.';
  }
  if (values.password.length < 8) {
    errors.password = 'Şifre en az 8 karakter olmalıdır.';
  }
  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Şifreler eşleşmiyor.';
  }
  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const clientErrors = validateRegister({ name, email, password, confirmPassword });
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
        if (err.fieldErrors) {
          setFieldErrors({
            name: err.fieldErrors.name?.[0],
            email: err.fieldErrors.email?.[0],
            password: err.fieldErrors.password?.[0],
          });
        }
      } else {
        setServerError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Hesap Oluştur"
      subtitle="Antrenman, kilo ve kalori takibine hemen başla."
      footer={
        <>
          Zaten hesabın var mı?{' '}
          <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
            Giriş Yap
          </Link>
        </>
      }
    >
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
          id="name"
          name="name"
          label="Ad Soyad"
          type="text"
          autoComplete="name"
          placeholder="Örn. Oğuz Yılmaz"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />

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

        <FormField
          id="password"
          name="password"
          label="Şifre"
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
          label="Şifre Tekrar"
          type="password"
          autoComplete="new-password"
          placeholder="Şifreni tekrar yaz"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
        </button>
      </form>
    </AuthLayout>
  );
}
