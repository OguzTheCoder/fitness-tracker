import { useCallback, useEffect, useState } from 'react';
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

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'workouts', label: 'Antrenmanlar' },
  { key: 'templates', label: 'Şablonlar & Egzersizler' },
  { key: 'cardio', label: 'Kardiyo' },
  { key: 'steps', label: 'Günlük Adım' },
];

export function WorkoutsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workouts');
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [pendingTemplate, setPendingTemplate] = useState<WorkoutTemplate | null>(null);

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

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Antrenman, Kardiyo & Adım</h1>
          <p className="mt-1 text-sm text-slate-400">
            Şablon veya serbest hareketlerle set × tekrar × ağırlık kaydet, kardiyo ve günlük adımlarını takip et.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Antrenman sekmeleri"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
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
          onConsumePendingTemplate={handleConsumePendingTemplate}
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
