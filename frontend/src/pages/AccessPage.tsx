import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { resolveSafeRedirectPath } from '../utils/security';

interface AccessFormErrors {
  name?: string;
  pin?: string;
}

export function AccessPage() {
  const {
    accessMode,
    isConfigured,
    isAuthenticated,
    isLoading,
    authNotice,
    setupAccess,
    unlockWithPin,
    resumeLocalSession,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = resolveSafeRedirectPath(
    (location.state as { from?: { pathname?: unknown } } | null)?.from?.pathname,
  );

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AccessFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted">
        Oturum kontrol ediliyor...
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const isPinMode = accessMode === 'pin';
  const needsSetup = !isConfigured;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const errors: AccessFormErrors = {};
    if (needsSetup && name.trim().length < 2) {
      errors.name = 'Adınız en az 2 karakter olmalıdır.';
    }
    if (isPinMode && pin.trim().length < 4) {
      errors.pin = 'PIN en az 4 karakter olmalıdır.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (needsSetup) {
        await setupAccess({
          name: name.trim(),
          ...(isPinMode ? { pin: pin.trim() } : {}),
        });
      } else if (isPinMode) {
        await unlockWithPin(pin.trim());
      } else {
        await resumeLocalSession();
      }
      navigate(redirectTo, { replace: true });
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

  const title = isPinMode
    ? needsSetup
      ? 'Kişisel Kurulum'
      : 'PIN Kilidi'
    : needsSetup
      ? 'Hoş Geldin'
      : 'Tekrar Hoş Geldin';

  const subtitle = isPinMode
    ? needsSetup
      ? 'Profilini oluşturmak için adını ve kişisel PIN kodunu gir.'
      : 'Cihazda kalıcı oturum açmak için kişisel PIN kodunu gir.'
    : needsSetup
      ? 'Başlamak için yalnızca adını yaz; e-posta veya şifre gerekmez.'
      : 'Yerel profilin hazır. Tek tıkla devam edebilirsin.';

  const submitLabel = isPinMode
    ? needsSetup
      ? 'Profili Oluştur'
      : 'Kilidi Aç'
    : needsSetup
      ? 'Başla'
      : 'Devam Et';

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={
        <>
          E-posta hesabıyla devam etmek ister misin?{' '}
          <Link
            to="/login"
            className="font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            E-posta ile Giriş
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

        {needsSetup && (
          <FormField
            id="access-name"
            name="name"
            label="Adın"
            type="text"
            autoComplete="name"
            placeholder="Örn. Oğuz"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
        )}

        {isPinMode && (
          <FormField
            id="access-pin"
            name="pin"
            label="Kişisel PIN"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="PIN kodunu gir"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            error={fieldErrors.pin}
          />
        )}

        <button type="submit" disabled={isSubmitting} className="ft-btn-primary w-full">
          {isSubmitting ? 'Açılıyor...' : submitLabel}
        </button>
      </form>
    </AuthLayout>
  );
}
