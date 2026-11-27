import { useState, type FormEvent } from 'react';
import { FormField } from '../FormField';
import { ApiError } from '../../services/api';
import {
  exerciseService,
  workoutTemplateService,
  type ExerciseItem,
  type WorkoutTemplate,
} from '../../services/workoutService';

interface TemplatesExercisesTabProps {
  exercises: ExerciseItem[];
  muscleGroups: string[];
  templates: WorkoutTemplate[];
  onRefreshCatalog: () => Promise<void>;
  onStartWorkoutFromTemplate: (template: WorkoutTemplate) => void;
}

interface DraftTemplateExercise {
  key: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  defaultSets: string;
  defaultReps: string;
  defaultWeightKg: string;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `tpl_ex_${keySeq}`;
}

export function TemplatesExercisesTab({
  exercises,
  muscleGroups,
  templates,
  onRefreshCatalog,
  onStartWorkoutFromTemplate,
}: TemplatesExercisesTabProps) {
  // Template builder state
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplExercises, setTplExercises] = useState<DraftTemplateExercise[]>([]);
  const [pickExerciseId, setPickExerciseId] = useState('');
  const [freeMoveName, setFreeMoveName] = useState('');
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplFeedback, setTplFeedback] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);

  // Exercise library state
  const [exScope, setExScope] = useState<'all' | 'core' | 'custom'>('all');
  const [exMuscleFilter, setExMuscleFilter] = useState('');
  const [exQuery, setExQuery] = useState('');

  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [exName, setExName] = useState('');
  const [exMuscle, setExMuscle] = useState(muscleGroups[0] ?? 'Göğüs');
  const [exEquipment, setExEquipment] = useState('');
  const [exBodyweight, setExBodyweight] = useState(false);
  const [exError, setExError] = useState<string | null>(null);
  const [exFeedback, setExFeedback] = useState<string | null>(null);
  const [exSaving, setExSaving] = useState(false);

  function addCatalogToTemplate() {
    const found = exercises.find((e) => e.id === pickExerciseId);
    if (!found) return;
    setTplExercises((prev) => [
      ...prev,
      {
        key: nextKey(),
        exerciseId: found.id,
        exerciseName: found.name,
        muscleGroup: found.muscleGroup,
        defaultSets: '3',
        defaultReps: '10',
        defaultWeightKg: '',
      },
    ]);
    setPickExerciseId('');
  }

  function addFreeToTemplate() {
    const trimmed = freeMoveName.trim();
    if (!trimmed) return;
    setTplExercises((prev) => [
      ...prev,
      {
        key: nextKey(),
        exerciseId: null,
        exerciseName: trimmed,
        muscleGroup: null,
        defaultSets: '3',
        defaultReps: '10',
        defaultWeightKg: '',
      },
    ]);
    setFreeMoveName('');
  }

  function resetTemplateForm() {
    setEditingTplId(null);
    setTplName('');
    setTplDesc('');
    setTplExercises([]);
    setTplError(null);
  }

  function startEditTemplate(tpl: WorkoutTemplate) {
    setEditingTplId(tpl.id);
    setTplName(tpl.name);
    setTplDesc(tpl.description ?? '');
    setTplExercises(
      tpl.exercises.map((ex) => ({
        key: nextKey(),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        defaultSets: String(ex.defaultSets),
        defaultReps: String(ex.defaultReps),
        defaultWeightKg:
          ex.defaultWeightKg !== null && ex.defaultWeightKg !== undefined
            ? String(ex.defaultWeightKg)
            : '',
      })),
    );
    setTplError(null);
    setTplFeedback(null);
  }

  async function handleTemplateSubmit(e: FormEvent) {
    e.preventDefault();
    setTplError(null);
    setTplFeedback(null);

    if (!tplName.trim()) {
      setTplError('Şablon adı giriniz.');
      return;
    }
    if (tplExercises.length === 0) {
      setTplError('Şablona en az bir hareket ekleyiniz.');
      return;
    }

    const payloadExercises = [];
    for (const ex of tplExercises) {
      const sets = Number(ex.defaultSets);
      const reps = Number(ex.defaultReps);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20 || !Number.isInteger(reps) || reps < 1 || reps > 1000) {
        setTplError(`${ex.exerciseName} için geçerli set (1-20) ve tekrar (1-1000) giriniz.`);
        return;
      }
      const weightVal = ex.defaultWeightKg.trim() ? Number(ex.defaultWeightKg) : null;
      if (weightVal !== null && (Number.isNaN(weightVal) || weightVal < 0 || weightVal > 1000)) {
        setTplError(`${ex.exerciseName} için ağırlık 0-1000 kg arasında olmalıdır.`);
        return;
      }
      payloadExercises.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        defaultSets: sets,
        defaultReps: reps,
        defaultWeightKg: weightVal,
      });
    }

    setTplSaving(true);
    try {
      const payload = {
        name: tplName.trim(),
        description: tplDesc.trim() || null,
        exercises: payloadExercises,
      };
      if (editingTplId) {
        await workoutTemplateService.update(editingTplId, payload);
        setTplFeedback('Program şablonu güncellendi.');
      } else {
        await workoutTemplateService.create(payload);
        setTplFeedback('Program şablonu oluşturuldu.');
      }
      resetTemplateForm();
      await onRefreshCatalog();
    } catch (err) {
      setTplError(err instanceof ApiError ? err.message : 'Şablon kaydedilemedi.');
    } finally {
      setTplSaving(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    setTplError(null);
    setTplFeedback(null);
    try {
      await workoutTemplateService.remove(id);
      if (editingTplId === id) resetTemplateForm();
      setTplFeedback('Program şablonu silindi.');
      await onRefreshCatalog();
    } catch (err) {
      setTplError(err instanceof ApiError ? err.message : 'Şablon silinemedi.');
    }
  }

  function resetExerciseForm() {
    setEditingExId(null);
    setExName('');
    setExMuscle(muscleGroups[0] ?? 'Göğüs');
    setExEquipment('');
    setExBodyweight(false);
    setExError(null);
  }

  function startEditExercise(ex: ExerciseItem) {
    setEditingExId(ex.id);
    setExName(ex.name);
    setExMuscle(ex.muscleGroup);
    setExEquipment(ex.equipment ?? '');
    setExBodyweight(ex.isBodyweight);
    setExError(null);
    setExFeedback(null);
  }

  async function handleExerciseSubmit(e: FormEvent) {
    e.preventDefault();
    setExError(null);
    setExFeedback(null);

    if (!exName.trim()) {
      setExError('Egzersiz adı giriniz.');
      return;
    }

    setExSaving(true);
    try {
      const payload = {
        name: exName.trim(),
        muscleGroup: exMuscle,
        equipment: exEquipment.trim() || null,
        isBodyweight: exBodyweight,
      };
      if (editingExId) {
        await exerciseService.update(editingExId, payload);
        setExFeedback('Özel egzersiz güncellendi.');
      } else {
        await exerciseService.create(payload);
        setExFeedback('Özel egzersiz eklendi.');
      }
      resetExerciseForm();
      await onRefreshCatalog();
    } catch (err) {
      setExError(err instanceof ApiError ? err.message : 'Egzersiz kaydedilemedi.');
    } finally {
      setExSaving(false);
    }
  }

  async function handleDeleteExercise(id: string) {
    setExError(null);
    setExFeedback(null);
    try {
      await exerciseService.remove(id);
      if (editingExId === id) resetExerciseForm();
      setExFeedback('Özel egzersiz silindi.');
      await onRefreshCatalog();
    } catch (err) {
      setExError(err instanceof ApiError ? err.message : 'Egzersiz silinemedi.');
    }
  }

  const filteredExercises = exercises.filter((ex) => {
    if (exScope === 'core' && !ex.isCore) return false;
    if (exScope === 'custom' && ex.isCore) return false;
    if (exMuscleFilter && ex.muscleGroup !== exMuscleFilter) return false;
    if (exQuery.trim()) {
      const needle = exQuery.trim().toLocaleLowerCase('tr-TR');
      return `${ex.name} ${ex.muscleGroup} ${ex.equipment ?? ''}`
        .toLocaleLowerCase('tr-TR')
        .includes(needle);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Program Şablonları */}
      <section className="ft-card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-ink">
            {editingTplId ? 'Program Şablonunu Düzenle' : 'Program Şablonları'}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Sık yaptığın rutinleri (örn. İtiş, Çekiş, Bacak) bir kez kaydet, antrenman eklerken tek
            tıkla yükle.
          </p>
        </div>

        <form onSubmit={handleTemplateSubmit} noValidate className="space-y-4">
          {tplError && (
            <div role="alert" className="ft-alert-error">
              {tplError}
            </div>
          )}
          {tplFeedback && (
            <div role="status" className="ft-alert-success">
              {tplFeedback}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="tpl-name"
              label="Şablon Adı"
              type="text"
              maxLength={120}
              placeholder="Örn. İtiş Günü (Push)"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
            <FormField
              id="tpl-desc"
              label="Açıklama (Opsiyonel)"
              type="text"
              maxLength={300}
              placeholder="Örn. Göğüs + Omuz + Triceps"
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
            />
          </div>

          <div className="ft-card-subtle space-y-2.5 p-4">
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Şablona katalogdan egzersiz seç"
                value={pickExerciseId}
                onChange={(e) => setPickExerciseId(e.target.value)}
                className="ft-input-sm min-w-[200px] flex-1"
              >
                <option value="">Katalogdan hareket seç...</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.muscleGroup})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!pickExerciseId}
                onClick={addCatalogToTemplate}
                className="ft-btn-secondary border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                + Şablona Ekle
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Şablona serbest hareket adı"
                maxLength={100}
                placeholder="Veya serbest hareket yaz..."
                value={freeMoveName}
                onChange={(e) => setFreeMoveName(e.target.value)}
                className="ft-input-sm min-w-[200px] flex-1"
              />
              <button
                type="button"
                disabled={!freeMoveName.trim()}
                onClick={addFreeToTemplate}
                className="ft-btn-secondary"
              >
                Serbest Ekle
              </button>
            </div>

            {tplExercises.length > 0 && (
              <ul className="space-y-2 pt-2">
                {tplExercises.map((ex) => (
                  <li
                    key={ex.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-ink">{ex.exerciseName}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        aria-label={`${ex.exerciseName} varsayılan set`}
                        value={ex.defaultSets}
                        onChange={(e) =>
                          setTplExercises((prev) =>
                            prev.map((item) =>
                              item.key === ex.key ? { ...item, defaultSets: e.target.value } : item,
                            ),
                          )
                        }
                        className="ft-input-sm w-14 py-1"
                      />
                      <span className="text-ink-muted">set ×</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        aria-label={`${ex.exerciseName} varsayılan tekrar`}
                        value={ex.defaultReps}
                        onChange={(e) =>
                          setTplExercises((prev) =>
                            prev.map((item) =>
                              item.key === ex.key ? { ...item, defaultReps: e.target.value } : item,
                            ),
                          )
                        }
                        className="ft-input-sm w-16 py-1"
                      />
                      <span className="text-ink-muted">tk</span>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.5"
                        placeholder="kg"
                        aria-label={`${ex.exerciseName} varsayılan ağırlık`}
                        value={ex.defaultWeightKg}
                        onChange={(e) =>
                          setTplExercises((prev) =>
                            prev.map((item) =>
                              item.key === ex.key
                                ? { ...item, defaultWeightKg: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="ft-input-sm w-20 py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTplExercises((prev) => prev.filter((item) => item.key !== ex.key))
                        }
                        className="text-ink-muted transition hover:text-rose-500"
                      >
                        Kaldır
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={tplSaving} className="ft-btn-primary">
              {tplSaving ? 'Kaydediliyor...' : editingTplId ? 'Şablonu Güncelle' : 'Şablon Kaydet'}
            </button>
            {editingTplId && (
              <button type="button" onClick={resetTemplateForm} className="ft-btn-ghost text-sm">
                İptal
              </button>
            )}
          </div>
        </form>

        {templates.length === 0 ? (
          <p className="border-t border-line pt-4 text-xs text-ink-muted">
            Henüz kayıtlı şablon yok.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line pt-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{tpl.name}</span>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-ink-secondary">
                      {tpl.exercises.length} hareket
                    </span>
                  </div>
                  {tpl.description && <p className="text-xs text-ink-muted">{tpl.description}</p>}
                  <p className="text-xs text-ink-muted">
                    {tpl.exercises
                      .map((ex) => `${ex.exerciseName} (${ex.defaultSets}×${ex.defaultReps})`)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStartWorkoutFromTemplate(tpl)}
                    className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/25 dark:text-emerald-300"
                  >
                    Antrenmana Aktar
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditTemplate(tpl)}
                    className="ft-btn-secondary py-1.5"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(tpl.id)}
                    className="ft-btn-danger py-1.5"
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Egzersiz Kütüphanesi */}
      <section className="ft-card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-ink">Egzersiz Kütüphanesi</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Kas bölgelerine göre hazır egzersizlere göz at veya kendi özel egzersizlerini ekle.
          </p>
        </div>

        <form onSubmit={handleExerciseSubmit} noValidate className="ft-card-subtle space-y-3 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            {editingExId ? 'Özel Egzersizi Düzenle' : 'Yeni Özel Egzersiz Ekle'}
          </h3>
          {exError && (
            <div role="alert" className="ft-alert-error text-xs">
              {exError}
            </div>
          )}
          {exFeedback && (
            <div role="status" className="ft-alert-success text-xs">
              {exFeedback}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              id="custom-ex-name"
              label="Egzersiz Adı"
              type="text"
              maxLength={100}
              placeholder="Örn. Landmine Press"
              value={exName}
              onChange={(e) => setExName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label htmlFor="custom-ex-muscle" className="block text-xs font-semibold text-ink-secondary">
                Kas Bölgesi
              </label>
              <select
                id="custom-ex-muscle"
                value={exMuscle}
                onChange={(e) => setExMuscle(e.target.value)}
                className="ft-input"
              >
                {muscleGroups.map((mg) => (
                  <option key={mg} value={mg}>
                    {mg}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              id="custom-ex-equipment"
              label="Ekipman (Opsiyonel)"
              type="text"
              maxLength={50}
              placeholder="Örn. Barbell, Lastik"
              value={exEquipment}
              onChange={(e) => setExEquipment(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={exBodyweight}
                onChange={(e) => setExBodyweight(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Vücut ağırlığı hareketi
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={exSaving} className="ft-btn-primary py-2 text-xs">
                {exSaving ? 'Kaydediliyor...' : editingExId ? 'Güncelle' : 'Özel Egzersiz Ekle'}
              </button>
              {editingExId && (
                <button type="button" onClick={resetExerciseForm} className="ft-btn-ghost py-2">
                  İptal
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Egzersiz ara"
            placeholder="Egzersiz ara..."
            value={exQuery}
            onChange={(e) => setExQuery(e.target.value)}
            className="ft-input-sm min-w-[180px] flex-1"
          />
          <select
            aria-label="Kütüphane kas bölgesi filtresi"
            value={exMuscleFilter}
            onChange={(e) => setExMuscleFilter(e.target.value)}
            className="ft-input-sm"
          >
            <option value="">Tüm Kaslar</option>
            {muscleGroups.map((mg) => (
              <option key={mg} value={mg}>
                {mg}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-subtle p-1 text-xs">
            {(
              [
                ['all', 'Tümü'],
                ['core', 'Hazır'],
                ['custom', 'Özel'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setExScope(key)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  exScope === key
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-ink-muted">{filteredExercises.length} egzersiz listeleniyor</p>

        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredExercises.map((ex) => (
            <li
              key={ex.id}
              className="ft-card-subtle flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
            >
              <div>
                <p className="font-semibold text-ink">{ex.name}</p>
                <p className="text-ink-muted">
                  {ex.muscleGroup}
                  {ex.equipment ? ` · ${ex.equipment}` : ''}
                  {ex.isBodyweight ? ' · Vücut Ağırlığı' : ''}
                </p>
              </div>
              {ex.isCore ? (
                <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                  Hazır
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEditExercise(ex)}
                    className="ft-btn-secondary px-2 py-1 text-[11px]"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteExercise(ex.id)}
                    className="ft-btn-danger px-2 py-1 text-[11px]"
                  >
                    Sil
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
