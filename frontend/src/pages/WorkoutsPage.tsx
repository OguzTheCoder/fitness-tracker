import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Dumbbell, Footprints, HeartPulse } from 'lucide-react';
import { CardioTab } from '../components/workouts/CardioTab';
import { StepsTab } from '../components/workouts/StepsTab';
import { TemplatesExercisesTab } from '../components/workouts/TemplatesExercisesTab';
import { WorkoutsTab } from '../components/workouts/WorkoutsTab';
import {
  exerciseService,
  workoutTemplateService,
  type ExerciseItem,
  type WorkoutTemplate,
} from '../services/workoutService';

type ActiveTab = 'workouts' | 'templates' | 'cardio' | 'steps';

const TABS: { key: ActiveTab; label: string; icon: typeof Dumbbell }[] = [
  { key: 'workouts', label: 'Antrenmanlar', icon: Dumbbell },
  { key: 'templates', label: 'Şablonlar & Egzersizler', icon: ClipboardList },
  { key: 'cardio', label: 'Kardiyo', icon: HeartPulse },
  { key: 'steps', label: 'Günlük Adım', icon: Footprints },
];

export function WorkoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>('workouts');
  const [initialOpenNew, setInitialOpenNew] = useState(false);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [pendingTemplate, setPendingTemplate] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setActiveTab('workouts');
      setInitialOpenNew(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadCatalog = useCallback(async () => {
    const [exRes, tplRes] = await Promise.all([
      exerciseService.list({ limit: 200 }).catch(() => null),
      workoutTemplateService.list({ limit: 100 }).catch(() => null),
    ]);
    if (exRes) {
      setExercises(exRes.exercises);
      setMuscleGroups(exRes.muscleGroups);
    }
    if (tplRes) {
      setTemplates(tplRes.templates);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleStartFromTemplate = useCallback((template: WorkoutTemplate) => {
    setPendingTemplate(template);
    setActiveTab('workouts');
  }, []);

  const handleConsumePendingTemplate = useCallback(() => {
    setPendingTemplate(null);
  }, []);

  const handleConsumeInitialOpenNew = useCallback(() => {
    setInitialOpenNew(false);
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Antrenman, Kardiyo & Adım
          </h1>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            Şablon veya serbest hareketlerle set × tekrar × ağırlık kaydet, kardiyo ve günlük
            adımlarını takip et.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Antrenman sekmeleri"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  selected
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-ink-secondary hover:bg-elevated hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === 'workouts' && (
        <WorkoutsTab
          exercises={exercises}
          muscleGroups={muscleGroups}
          templates={templates}
          pendingTemplate={pendingTemplate}
          initialOpenNew={initialOpenNew}
          onConsumePendingTemplate={handleConsumePendingTemplate}
          onConsumeInitialOpenNew={handleConsumeInitialOpenNew}
        />
      )}

      {activeTab === 'templates' && (
        <TemplatesExercisesTab
          exercises={exercises}
          muscleGroups={muscleGroups}
          templates={templates}
          onRefreshCatalog={loadCatalog}
          onStartWorkoutFromTemplate={handleStartFromTemplate}
        />
      )}

      {activeTab === 'cardio' && <CardioTab />}

      {activeTab === 'steps' && <StepsTab />}
    </div>
  );
}
