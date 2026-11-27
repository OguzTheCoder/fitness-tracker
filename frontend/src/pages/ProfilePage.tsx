import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatabaseBackup, ShieldCheck, SlidersHorizontal, Target } from 'lucide-react';
import { BackupSection } from '../components/BackupSection';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import {
  profileService,
  type MicronutrientMeta,
  type UpdateProfilePayload,
} from '../services/profileService';

const DEFAULT_MINERAL_KEYS = ['Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn'];

interface ProfileFormErrors {
  name?: string;
  dailyCalorieGoal?: string;
  proteinGoalG?: string;
  carbsGoalG?: string;
  fatGoalG?: string;
  dailyStepGoal?: string;
}

function validateProfileForm(values: {
  name: string;
  dailyCalorieGoal: string;
  proteinGoalG: string;
  carbsGoalG: string;
  fatGoalG: string;
  dailyStepGoal: string;
}): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  if (values.name.trim().length < 2) {
    errors.name = 'Ad en az 2 karakter olmalıdır.';
  }

  const checkInt = (
    raw: string,
    min: number,
    max: number,
    label: string,
  ): string | undefined => {
    const num = Number(raw);
    if (!raw.trim() || !Number.isInteger(num)) {
      return `${label} tam sayı olmalıdır.`;
    }
    if (num < min || num > max) {
      return `${label} ${min} ile ${max} arasında olmalıdır.`;
    }
    return undefined;
  };

  errors.dailyCalorieGoal = checkInt(values.dailyCalorieGoal, 500, 15000, 'Günlük kalori hedefi');
  errors.proteinGoalG = checkInt(values.proteinGoalG, 0, 1000, 'Protein hedefi');
  errors.carbsGoalG = checkInt(values.carbsGoalG, 0, 2000, 'Karbonhidrat hedefi');
  errors.fatGoalG = checkInt(values.fatGoalG, 0, 500, 'Yağ hedefi');
  errors.dailyStepGoal = checkInt(values.dailyStepGoal, 0, 100000, 'Günlük adım hedefi');

  for (const key of Object.keys(errors) as (keyof ProfileFormErrors)[]) {
    if (!errors[key]) delete errors[key];
  }
  return errors;
}

export function ProfilePage() {
  const { accessMode, logoutAll, syncUserName } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [availableMicronutrients, setAvailableMicronutrients] = useState<MicronutrientMeta[]>([]);

  const [name, setName] = useState('');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState('2000');
  const [proteinGoalG, setProteinGoalG] = useState('150');
  const [carbsGoalG, setCarbsGoalG] = useState('200');
  const [fatGoalG, setFatGoalG] = useState('65');
  const [dailyStepGoal, setDailyStepGoal] = useState('8000');
  const [visibleMicronutrients, setVisibleMicronutrients] = useState<string[]>(DEFAULT_MINERAL_KEYS);

  const [fieldErrors, setFieldErrors] = useState<ProfileFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await profileService.get();
      setName(res.profile.name);
      syncUserName(res.profile.name);
      setDailyCalorieGoal(String(res.profile.dailyCalorieGoal));
      setProteinGoalG(String(res.profile.proteinGoalG));
      setCarbsGoalG(String(res.profile.carbsGoalG));
      setFatGoalG(String(res.profile.fatGoalG));
      setDailyStepGoal(String(res.profile.dailyStepGoal));
      setVisibleMicronutrients(res.profile.visibleMicronutrients);
      setAvailableMicronutrients(res.availableMicronutrients);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Profil bilgileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [syncUserName]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const groupedMicronutrients = useMemo(() => {
    const minerals = availableMicronutrients.filter((m) => m.category === 'mineral');
    const vitamins = availableMicronutrients.filter((m) => m.category === 'vitamin');
    return { minerals, vitamins };
  }, [availableMicronutrients]);

  function toggleMicronutrient(key: string) {
    setVisibleMicronutrients((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setFeedback(null);

    const errors = validateProfileForm({
      name,
      dailyCalorieGoal,
      proteinGoalG,
      carbsGoalG,
      fatGoalG,
      dailyStepGoal,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: UpdateProfilePayload = {
      name: name.trim(),
      dailyCalorieGoal: Number(dailyCalorieGoal),
      proteinGoalG: Number(proteinGoalG),
      carbsGoalG: Number(carbsGoalG),
      fatGoalG: Number(fatGoalG),
      dailyStepGoal: Number(dailyStepGoal),
      visibleMicronutrients,
    };

    setIsSaving(true);
    try {
      const res = await profileService.update(payload);
      syncUserName(res.profile.name);
      setVisibleMicronutrients(res.profile.visibleMicronutrients);
      setFeedback('Profil ve hedeflerin kaydedildi.');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Profil güncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoutAll() {
    setSaveError(null);
    setIsRevoking(true);
    try {
      await logoutAll();
      navigate('/access', { replace: true });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Oturumlar sonlandırılamadı.');
    } finally {
      setIsRevoking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="ft-card p-6 text-sm text-ink-muted">
        Profil yükleniyor...
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="ft-card p-5 sm:p-6">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Profil ve Günlük Hedefler
        </h1>
        <p className="mt-1 text-xs text-ink-muted sm:text-sm">
          Adını, gram bazlı kalori/makro hedeflerini, günlük adım hedefini ve takip etmek istediğin
          mikro besinleri düzenle.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3.5 text-xs">
          <a href="#profile-goals" className="ft-btn-secondary py-1.5">
            <Target className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span>Hedefler</span>
          </a>
          <a href="#profile-micros" className="ft-btn-secondary py-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
            <span>Mikro Besinler</span>
          </a>
          <a href="#backup-section-title" className="ft-btn-secondary py-1.5">
            <DatabaseBackup className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span>Yedekleme</span>
          </a>
          <a href="#profile-security" className="ft-btn-secondary py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
            <span>Güvenlik</span>
          </a>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="ft-alert-error">
          {loadError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {saveError && (
          <div role="alert" className="ft-alert-error">
            {saveError}
          </div>
        )}

        {feedback && (
          <div role="status" className="ft-alert-success">
            {feedback}
          </div>
        )}

        <section id="profile-goals" className="ft-card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <h2 className="text-base font-semibold text-ink">Temel Bilgiler & Hedefler</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="profile-name"
              name="name"
              label="Ad"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <FormField
              id="profile-calorie-goal"
              name="dailyCalorieGoal"
              label="Günlük Kalori Hedefi (kcal)"
              type="number"
              inputMode="numeric"
              value={dailyCalorieGoal}
              onChange={(e) => setDailyCalorieGoal(e.target.value)}
              error={fieldErrors.dailyCalorieGoal}
            />
            <FormField
              id="profile-step-goal"
              name="dailyStepGoal"
              label="Günlük Adım Hedefi"
              type="number"
              inputMode="numeric"
              value={dailyStepGoal}
              onChange={(e) => setDailyStepGoal(e.target.value)}
              error={fieldErrors.dailyStepGoal}
            />
            <FormField
              id="profile-protein-goal"
              name="proteinGoalG"
              label="Protein Hedefi (g)"
              type="number"
              inputMode="numeric"
              value={proteinGoalG}
              onChange={(e) => setProteinGoalG(e.target.value)}
              error={fieldErrors.proteinGoalG}
            />
            <FormField
              id="profile-carbs-goal"
              name="carbsGoalG"
              label="Karbonhidrat Hedefi (g)"
              type="number"
              inputMode="numeric"
              value={carbsGoalG}
              onChange={(e) => setCarbsGoalG(e.target.value)}
              error={fieldErrors.carbsGoalG}
            />
            <FormField
              id="profile-fat-goal"
              name="fatGoalG"
              label="Yağ Hedefi (g)"
              type="number"
              inputMode="numeric"
              value={fatGoalG}
              onChange={(e) => setFatGoalG(e.target.value)}
              error={fieldErrors.fatGoalG}
            />
          </div>
        </section>

        <section id="profile-micros" className="ft-card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Görünür Mikro Besinler</h2>
              <p className="text-xs text-ink-muted">
                Seçili: {visibleMicronutrients.length} mikro besin
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisibleMicronutrients(DEFAULT_MINERAL_KEYS)}
              className="ft-btn-secondary py-1.5"
            >
              Varsayılan 6 Mineral
            </button>
          </div>

          <div className="space-y-4">
            {[
              { title: 'Mineraller', items: groupedMicronutrients.minerals },
              { title: 'Vitaminler', items: groupedMicronutrients.vitamins },
            ].map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.title}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const checked = visibleMicronutrients.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                          checked
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                            : 'border-line bg-subtle text-ink-secondary hover:border-line-strong'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMicronutrient(item.key)}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-xs text-ink-muted">{item.unit}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="ft-btn-primary">
            {isSaving ? 'Kaydediliyor...' : 'Profili Kaydet'}
          </button>
        </div>
      </form>

      <BackupSection onProfileRestored={loadProfile} />

      <section
        id="profile-security"
        className="ft-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"
      >
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <span>Oturum & Güvenlik</span>
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Erişim modu:{' '}
            <span className="font-semibold text-ink-secondary">
              {accessMode === 'pin' ? 'Kişisel PIN Kilidi' : 'Yerel Mod'}
            </span>{' '}
            · Oturum güvenli HttpOnly çerez ile korunur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogoutAll()}
          disabled={isRevoking}
          className="ft-btn-danger"
        >
          {isRevoking ? 'Sonlandırılıyor...' : 'Tüm Cihazlardan Çıkış Yap'}
        </button>
      </section>
    </div>
  );
}
