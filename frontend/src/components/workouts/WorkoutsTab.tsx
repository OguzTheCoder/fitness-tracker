import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DateRangeFilter } from '../DateRangeFilter';
import { FormField } from '../FormField';
import { ApiError } from '../../services/api';
import {
  workoutService,
  type ExerciseItem,
  type PreviousExercisePerformance,
  type WorkoutEntry,
  type WorkoutSummary,
  type WorkoutTemplate,
} from '../../services/workoutService';
import { formatTurkishDate, getTodayIsoDate, type DateRange } from '../../utils/date';

interface DraftSet {
  key: string;
  reps: string;
  weightKg: string;
}

interface DraftExercise {
  key: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  sets: DraftSet[];
}

interface FormErrors {
  date?: string;
  name?: string;
  durationMinutes?: string;
  note?: string;
  exercises?: string;
}

interface WorkoutsTabProps {
  exercises: ExerciseItem[];
  muscleGroups: string[];
  templates: WorkoutTemplate[];
  pendingTemplate: WorkoutTemplate | null;
  onConsumePendingTemplate: () => void;
}

let uidCounter = 0;
function nextKey(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}`;
}

function formatSetsCompact(sets: { reps: number; weightKg: number | null }[]): string {
  return sets
    .map((s) => (s.weightKg !== null && s.weightKg !== undefined ? `${s.reps}×${s.weightKg}kg` : `${s.reps} tk`))
    .join(' · ');
}

function validateWorkoutForm(
  date: string,
  name: string,
  durationText: string,
  note: string,
  draftExercises: DraftExercise[],
): FormErrors {
  const errors: FormErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Geçerli bir tarih seçiniz.';
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    errors.name = 'Antrenman adı giriniz.';
  } else if (trimmedName.length > 120) {
    errors.name = 'Antrenman adı en fazla 120 karakter olabilir.';
  }
  const duration = Number(durationText);
  if (!durationText.trim() || Number.isNaN(duration) || !Number.isInteger(duration)) {
    errors.durationMinutes = 'Süre tam sayı olmalıdır.';
  } else if (duration < 1 || duration > 1440) {
    errors.durationMinutes = 'Süre 1 ile 1440 dakika arasında olmalıdır.';
  }
  if (note.trim().length > 300) {
    errors.note = 'Not en fazla 300 karakter olabilir.';
  }
  for (const ex of draftExercises) {
    if (!ex.exerciseName.trim()) {
      errors.exercises = 'Tüm hareketlerin adı dolu olmalıdır.';
      break;
    }
    if (ex.sets.length === 0) {
      errors.exercises = `${ex.exerciseName} için en az 1 set giriniz.`;
      break;
    }
    for (const s of ex.sets) {
      const reps = Number(s.reps);
      if (!s.reps.trim() || Number.isNaN(reps) || !Number.isInteger(reps) || reps < 1 || reps > 1000) {
        errors.exercises = `${ex.exerciseName} için geçerli tekrar sayısı giriniz (1–1000).`;
        break;
      }
      if (s.weightKg.trim()) {
        const w = Number(s.weightKg);
        if (Number.isNaN(w) || w < 0 || w > 1000) {
          errors.exercises = `${ex.exerciseName} için ağırlık 0–1000 kg arasında olmalıdır.`;
          break;
        }
      }
    }
    if (errors.exercises) break;
  }
  return errors;
}

export function WorkoutsTab({
  exercises,
  muscleGroups,
  templates,
  pendingTemplate,
  onConsumePendingTemplate,
}: WorkoutsTabProps) {
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [summary, setSummary] = useState<WorkoutSummary>({
    totalCount: 0,
    totalDurationMinutes: 0,
  });
  const [range, setRange] = useState<DateRange>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIsoDate);
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [note, setNote] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);

  const [muscleFilter, setMuscleFilter] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [freeExerciseName, setFreeExerciseName] = useState('');

  const [prevById, setPrevById] = useState<Record<string, PreviousExercisePerformance>>({});
  const [prevByName, setPrevByName] = useState<Record<string, PreviousExercisePerformance>>({});

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async (activeRange: DateRange) => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await workoutService.list(activeRange);
      setEntries(res.entries);
      setSummary(res.summary);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Antrenman kayıtları yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries(range);
  }, [loadEntries, range]);

  const fetchPreviousForDraft = useCallback(
    async (items: DraftExercise[], activeDate: string, excludeId?: string | null) => {
      const ids = Array.from(
        new Set(items.map((item) => item.exerciseId).filter((id): id is string => Boolean(id))),
      );
      const names = Array.from(
        new Set(items.map((item) => item.exerciseName.trim()).filter((n) => n.length > 0)),
      );
      if (ids.length === 0 && names.length === 0) return;

      try {
        const res = await workoutService.getPrevious({
          exerciseIds: ids,
          exerciseNames: names,
          beforeDate: excludeId ? activeDate : undefined,
          excludeWorkoutId: excludeId ?? undefined,
        });
        setPrevById((prev) => ({ ...prev, ...res.byExerciseId }));
        setPrevByName((prev) => ({ ...prev, ...res.byExerciseName }));
      } catch {
        // Previous reminder is non-blocking helper data.
      }
    },
    [],
  );

  const applyTemplate = useCallback(
    (tpl: WorkoutTemplate) => {
      setEditingId(null);
      setTemplateId(tpl.id);
      setName(tpl.name);
      if (!durationMinutes) setDurationMinutes('45');
      const items: DraftExercise[] = tpl.exercises.map((ex) => ({
        key: nextKey('ex'),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        sets: Array.from({ length: Math.max(1, ex.defaultSets) }, () => ({
          key: nextKey('set'),
          reps: String(ex.defaultReps),
          weightKg:
            ex.defaultWeightKg !== null && ex.defaultWeightKg !== undefined
              ? String(ex.defaultWeightKg)
              : '',
        })),
      }));
      setDraftExercises(items);
      setFieldErrors({});
      setFormError(null);
      setFeedback(`"${tpl.name}" şablonu yüklendi.`);
      void fetchPreviousForDraft(items, date, null);
    },
    [date, durationMinutes, fetchPreviousForDraft],
  );

  useEffect(() => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
      onConsumePendingTemplate();
    }
  }, [applyTemplate, onConsumePendingTemplate, pendingTemplate]);

  function getPreviousForExercise(ex: DraftExercise): PreviousExercisePerformance | undefined {
    if (ex.exerciseId && prevById[ex.exerciseId]) {
      return prevById[ex.exerciseId];
    }
    const norm = ex.exerciseName.trim().toLocaleLowerCase('tr-TR');
    return norm ? prevByName[norm] : undefined;
  }

  function handleAddCatalogExercise() {
    const found = exercises.find((e) => e.id === selectedExerciseId);
    if (!found) return;
    const item: DraftExercise = {
      key: nextKey('ex'),
      exerciseId: found.id,
      exerciseName: found.name,
      muscleGroup: found.muscleGroup,
      sets: [
        { key: nextKey('set'), reps: '10', weightKg: '' },
        { key: nextKey('set'), reps: '10', weightKg: '' },
        { key: nextKey('set'), reps: '10', weightKg: '' },
      ],
    };
    const next = [...draftExercises, item];
    setDraftExercises(next);
    setSelectedExerciseId('');
    void fetchPreviousForDraft([item], date, editingId);
  }

  function handleAddFreeExercise() {
    const trimmed = freeExerciseName.trim();
    if (!trimmed) return;
    const item: DraftExercise = {
      key: nextKey('ex'),
      exerciseId: null,
      exerciseName: trimmed,
      muscleGroup: muscleFilter || null,
      sets: [{ key: nextKey('set'), reps: '10', weightKg: '' }],
    };
    setDraftExercises((prev) => [...prev, item]);
    setFreeExerciseName('');
    void fetchPreviousForDraft([item], date, editingId);
  }

  function applyPreviousSets(exKey: string, perf: PreviousExercisePerformance) {
    setDraftExercises((prev) =>
      prev.map((item) =>
        item.key !== exKey
          ? item
          : {
              ...item,
              sets: perf.sets.map((s) => ({
                key: nextKey('set'),
                reps: String(s.reps),
                weightKg: s.weightKg !== null && s.weightKg !== undefined ? String(s.weightKg) : '',
              })),
            },
      ),
    );
  }

  function addSetRow(exKey: string) {
    setDraftExercises((prev) =>
      prev.map((item) => {
        if (item.key !== exKey) return item;
        const last = item.sets[item.sets.length - 1];
        return {
          ...item,
          sets: [
            ...item.sets,
            {
              key: nextKey('set'),
              reps: last?.reps ?? '10',
              weightKg: last?.weightKg ?? '',
            },
          ],
        };
      }),
    );
  }

  function updateSetField(exKey: string, setKey: string, field: 'reps' | 'weightKg', value: string) {
    setDraftExercises((prev) =>
      prev.map((item) =>
        item.key !== exKey
          ? item
          : {
              ...item,
              sets: item.sets.map((s) => (s.key === setKey ? { ...s, [field]: value } : s)),
            },
      ),
    );
  }

  function removeSetRow(exKey: string, setKey: string) {
    setDraftExercises((prev) =>
      prev.map((item) =>
        item.key !== exKey
          ? item
          : { ...item, sets: item.sets.filter((s) => s.key !== setKey) },
      ),
    );
  }

  function removeExerciseRow(exKey: string) {
    setDraftExercises((prev) => prev.filter((item) => item.key !== exKey));
  }

  function resetForm() {
    setEditingId(null);
    setTemplateId(null);
    setDate(getTodayIsoDate());
    setName('');
    setDurationMinutes('');
    setNote('');
    setDraftExercises([]);
    setFieldErrors({});
    setFormError(null);
  }

  function startEdit(entry: WorkoutEntry) {
    setEditingId(entry.id);
    setTemplateId(entry.templateId ?? null);
    setDate(entry.date);
    setName(entry.name);
    setDurationMinutes(String(entry.durationMinutes));
    setNote(entry.note ?? '');
    const mapped: DraftExercise[] = (entry.exercises ?? []).map((ex) => ({
      key: nextKey('ex'),
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      sets: ex.sets.map((s) => ({
        key: nextKey('set'),
        reps: String(s.reps),
        weightKg: s.weightKg !== null && s.weightKg !== undefined ? String(s.weightKg) : '',
      })),
    }));
    setDraftExercises(mapped);
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
    if (mapped.length > 0) {
      void fetchPreviousForDraft(mapped, entry.date, entry.id);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const errors = validateWorkoutForm(date, name, durationMinutes, note, draftExercises);
    setFieldErrors(errors);
    setFormError(null);
    setFeedback(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        date,
        name: name.trim(),
        durationMinutes: Number(durationMinutes),
        note: note.trim() || null,
        ...(templateId ? { templateId } : {}),
        ...(draftExercises.length > 0 || editingId
          ? {
              exercises: draftExercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName.trim(),
                muscleGroup: ex.muscleGroup,
                sets: ex.sets.map((s) => ({
                  reps: Number(s.reps),
                  weightKg: s.weightKg.trim() ? Number(s.weightKg) : null,
                })),
              })),
            }
          : {}),
      };

      if (editingId) {
        await workoutService.update(editingId, payload);
        setFeedback('Antrenman kaydı güncellendi.');
      } else {
        await workoutService.create(payload);
        setFeedback('Antrenman kaydı eklendi.');
      }

      resetForm();
      await loadEntries(range);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) {
          setFieldErrors({
            date: err.fieldErrors.date?.[0],
            name: err.fieldErrors.name?.[0],
            durationMinutes: err.fieldErrors.durationMinutes?.[0],
            note: err.fieldErrors.note?.[0],
            exercises: err.fieldErrors.exercises?.[0],
          });
        }
      } else {
        setFormError('Antrenman kaydı kaydedilirken bir hata oluştu.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    setFeedback(null);
    try {
      await workoutService.remove(id);
      if (editingId === id) resetForm();
      setFeedback('Antrenman kaydı silindi.');
      await loadEntries(range);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Antrenman kaydı silinemedi.');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCatalog = muscleFilter
    ? exercises.filter((ex) => ex.muscleGroup === muscleFilter)
    : exercises;

  return (
    <div className="space-y-6">
      {summary.totalCount > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <span className="text-slate-400">Toplam Antrenman: </span>
            <span className="font-semibold text-emerald-400">{summary.totalCount}</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <span className="text-slate-400">Toplam Süre: </span>
            <span className="font-semibold text-slate-200">{summary.totalDurationMinutes} dk</span>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            {editingId ? 'Antrenman Kaydını Düzenle' : 'Yeni Antrenman Kaydı'}
          </h2>

          {templates.length > 0 && !editingId && (
            <div className="flex items-center gap-2">
              <label htmlFor="workout-template-select" className="text-xs text-slate-400">
                Şablondan yükle:
              </label>
              <select
                id="workout-template-select"
                value={templateId ?? ''}
                onChange={(e) => {
                  const found = templates.find((t) => t.id === e.target.value);
                  if (found) applyTemplate(found);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Şablon seçin...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.exercises.length} hareket)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-5">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
            >
              {formError}
            </div>
          )}
          {feedback && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300"
            >
              {feedback}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="workout-date"
              label="Tarih"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldErrors.date}
            />
            <FormField
              id="workout-name"
              label="Antrenman Adı"
              type="text"
              maxLength={120}
              placeholder="Örn. Üst Vücut Ağırlık"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <FormField
              id="workout-duration"
              label="Süre (dk)"
              type="number"
              step="1"
              min="1"
              max="1440"
              placeholder="Örn. 45"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              error={fieldErrors.durationMinutes}
            />
            <FormField
              id="workout-note"
              label="Not (Opsiyonel)"
              type="text"
              maxLength={300}
              placeholder="Örn. Enerji iyiydi"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={fieldErrors.note}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Hareketler & Setler (Opsiyonel)</h3>
                <p className="text-xs text-slate-400">
                  Katalogdan seç veya serbest hareket ekle; vücut ağırlığında ağırlık alanını boş bırakabilirsin.
                </p>
              </div>
              {fieldErrors.exercises && (
                <p role="alert" className="text-xs text-rose-400">
                  {fieldErrors.exercises}
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-12">
              <select
                aria-label="Kas bölgesi filtresi"
                value={muscleFilter}
                onChange={(e) => {
                  setMuscleFilter(e.target.value);
                  setSelectedExerciseId('');
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none sm:col-span-3"
              >
                <option value="">Tüm Kas Bölgeleri</option>
                {muscleGroups.map((mg) => (
                  <option key={mg} value={mg}>
                    {mg}
                  </option>
                ))}
              </select>

              <select
                aria-label="Katalogdan egzersiz seç"
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none sm:col-span-6"
              >
                <option value="">Katalogdan hareket seçin...</option>
                {filteredCatalog.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.muscleGroup})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedExerciseId}
                onClick={handleAddCatalogExercise}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-3"
              >
                + Hareket Ekle
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Serbest hareket adı"
                maxLength={100}
                placeholder="Veya serbest hareket adı yaz (örn. Band Pull-Apart)"
                value={freeExerciseName}
                onChange={(e) => setFreeExerciseName(e.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!freeExerciseName.trim()}
                onClick={handleAddFreeExercise}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Serbest Ekle
              </button>
            </div>

            {draftExercises.length > 0 && (
              <div className="space-y-3 pt-2">
                {draftExercises.map((ex, exIdx) => {
                  const previous = getPreviousForExercise(ex);
                  return (
                    <div
                      key={ex.key}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500">#{exIdx + 1}</span>
                          <span className="text-sm font-semibold text-white">{ex.exerciseName}</span>
                          {ex.muscleGroup && (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              {ex.muscleGroup}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExerciseRow(ex.key)}
                          className="text-xs text-slate-400 hover:text-rose-400"
                        >
                          Hareketi Kaldır
                        </button>
                      </div>

                      {previous && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200">
                          <span>
                            Önceki ({formatTurkishDate(previous.date)}):{' '}
                            <strong>{formatSetsCompact(previous.sets)}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => applyPreviousSets(ex.key, previous)}
                            className="rounded bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-200 transition hover:bg-sky-500/35"
                          >
                            Önceki setleri doldur
                          </button>
                        </div>
                      )}

                      <div className="mt-2.5 space-y-2">
                        {ex.sets.map((s, setIdx) => (
                          <div key={s.key} className="flex flex-wrap items-center gap-2">
                            <span className="w-12 text-xs text-slate-400">Set {setIdx + 1}</span>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              step="1"
                              aria-label={`${ex.exerciseName} set ${setIdx + 1} tekrar`}
                              placeholder="Tekrar"
                              value={s.reps}
                              onChange={(e) => updateSetField(ex.key, s.key, 'reps', e.target.value)}
                              className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-500">tekrar</span>
                            <input
                              type="number"
                              min="0"
                              max="1000"
                              step="0.5"
                              aria-label={`${ex.exerciseName} set ${setIdx + 1} ağırlık`}
                              placeholder="kg (ops.)"
                              value={s.weightKg}
                              onChange={(e) =>
                                updateSetField(ex.key, s.key, 'weightKg', e.target.value)
                              }
                              className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-500">kg</span>
                            {ex.sets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSetRow(ex.key, s.key)}
                                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                                aria-label="Seti sil"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addSetRow(ex.key)}
                        className="mt-2.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        + Set Ekle
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
            </button>
            {(editingId || draftExercises.length > 0) && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                {editingId ? 'İptal' : 'Temizle'}
              </button>
            )}
          </div>
        </form>
      </section>

      <DateRangeFilter value={range} onApply={setRange} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Antrenman Geçmişi</h2>
          <span className="text-xs text-slate-400">{entries.length} kayıt</span>
        </div>

        {listError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            {listError}
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Antrenman kayıtları yükleniyor...
          </p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {range.from || range.to
              ? 'Seçilen tarih aralığında antrenman kaydı bulunamadı.'
              : 'Henüz antrenman kaydı eklenmemiş. Yukarıdaki formdan ilk antrenmanını girebilirsin.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base font-semibold text-white">{entry.name}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      {entry.durationMinutes} dk
                    </span>
                    <span className="text-sm text-slate-300">{formatTurkishDate(entry.date)}</span>
                    <span className="text-xs text-slate-500">{entry.date}</span>
                  </div>
                  {entry.note && <p className="text-sm text-slate-400">{entry.note}</p>}
                  {entry.exercises && entry.exercises.length > 0 && (
                    <ul className="space-y-1 pt-1 text-xs text-slate-300">
                      {entry.exercises.map((ex, idx) => (
                        <li key={ex.id ?? idx} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-100">{ex.exerciseName}:</span>
                          <span className="text-slate-400">{formatSetsCompact(ex.sets)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === entry.id}
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-50"
                  >
                    {deletingId === entry.id ? 'Siliniyor...' : 'Sil'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
