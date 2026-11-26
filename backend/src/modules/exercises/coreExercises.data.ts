export const MUSCLE_GROUPS = [
  'Göğüs',
  'Sırt',
  'Omuz',
  'Bacak',
  'Biceps',
  'Triceps',
  'Karın / Core',
  'Tam Vücut',
  'Diğer',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface CoreExerciseSeed {
  coreKey: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  isBodyweight?: boolean;
}

export const CORE_EXERCISES: CoreExerciseSeed[] = [
  // Göğüs
  { coreKey: 'chest_bench_press', name: 'Bench Press (Barbell)', muscleGroup: 'Göğüs', equipment: 'Barbell' },
  { coreKey: 'chest_incline_db_press', name: 'Incline Dumbbell Press', muscleGroup: 'Göğüs', equipment: 'Dumbbell' },
  { coreKey: 'chest_db_bench_press', name: 'Dumbbell Bench Press', muscleGroup: 'Göğüs', equipment: 'Dumbbell' },
  { coreKey: 'chest_db_fly', name: 'Dumbbell Fly', muscleGroup: 'Göğüs', equipment: 'Dumbbell' },
  { coreKey: 'chest_cable_crossover', name: 'Cable Crossover', muscleGroup: 'Göğüs', equipment: 'Kablo' },
  { coreKey: 'chest_push_up', name: 'Şınav (Push-Up)', muscleGroup: 'Göğüs', equipment: 'Vücut Ağırlığı', isBodyweight: true },
  { coreKey: 'chest_dips', name: 'Chest Dips', muscleGroup: 'Göğüs', equipment: 'Vücut Ağırlığı', isBodyweight: true },

  // Sırt
  { coreKey: 'back_pull_up', name: 'Barfiks (Pull-Up)', muscleGroup: 'Sırt', equipment: 'Vücut Ağırlığı', isBodyweight: true },
  { coreKey: 'back_lat_pulldown', name: 'Lat Pulldown', muscleGroup: 'Sırt', equipment: 'Kablo' },
  { coreKey: 'back_barbell_row', name: 'Barbell Row', muscleGroup: 'Sırt', equipment: 'Barbell' },
  { coreKey: 'back_seated_cable_row', name: 'Seated Cable Row', muscleGroup: 'Sırt', equipment: 'Kablo' },
  { coreKey: 'back_one_arm_db_row', name: 'Single-Arm Dumbbell Row', muscleGroup: 'Sırt', equipment: 'Dumbbell' },
  { coreKey: 'back_deadlift', name: 'Deadlift (Barbell)', muscleGroup: 'Sırt', equipment: 'Barbell' },
  { coreKey: 'back_face_pull', name: 'Face Pull', muscleGroup: 'Sırt', equipment: 'Kablo' },

  // Omuz
  { coreKey: 'shoulders_ohp', name: 'Overhead Press (Barbell)', muscleGroup: 'Omuz', equipment: 'Barbell' },
  { coreKey: 'shoulders_db_press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Omuz', equipment: 'Dumbbell' },
  { coreKey: 'shoulders_lateral_raise', name: 'Lateral Raise', muscleGroup: 'Omuz', equipment: 'Dumbbell' },
  { coreKey: 'shoulders_rear_delt_fly', name: 'Rear Delt Fly', muscleGroup: 'Omuz', equipment: 'Dumbbell' },
  { coreKey: 'shoulders_arnold_press', name: 'Arnold Press', muscleGroup: 'Omuz', equipment: 'Dumbbell' },

  // Bacak
  { coreKey: 'legs_back_squat', name: 'Back Squat (Barbell)', muscleGroup: 'Bacak', equipment: 'Barbell' },
  { coreKey: 'legs_front_squat', name: 'Front Squat', muscleGroup: 'Bacak', equipment: 'Barbell' },
  { coreKey: 'legs_rdl', name: 'Romanian Deadlift', muscleGroup: 'Bacak', equipment: 'Barbell' },
  { coreKey: 'legs_leg_press', name: 'Leg Press', muscleGroup: 'Bacak', equipment: 'Makine' },
  { coreKey: 'legs_bulgarian_split_squat', name: 'Bulgarian Split Squat', muscleGroup: 'Bacak', equipment: 'Dumbbell' },
  { coreKey: 'legs_walking_lunge', name: 'Walking Lunge', muscleGroup: 'Bacak', equipment: 'Dumbbell' },
  { coreKey: 'legs_leg_extension', name: 'Leg Extension', muscleGroup: 'Bacak', equipment: 'Makine' },
  { coreKey: 'legs_leg_curl', name: 'Leg Curl', muscleGroup: 'Bacak', equipment: 'Makine' },
  { coreKey: 'legs_calf_raise', name: 'Standing Calf Raise', muscleGroup: 'Bacak', equipment: 'Makine' },

  // Biceps
  { coreKey: 'biceps_barbell_curl', name: 'Barbell Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { coreKey: 'biceps_db_curl', name: 'Dumbbell Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { coreKey: 'biceps_hammer_curl', name: 'Hammer Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { coreKey: 'biceps_incline_db_curl', name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { coreKey: 'biceps_cable_curl', name: 'Cable Curl', muscleGroup: 'Biceps', equipment: 'Kablo' },

  // Triceps
  { coreKey: 'triceps_rope_pushdown', name: 'Triceps Rope Pushdown', muscleGroup: 'Triceps', equipment: 'Kablo' },
  { coreKey: 'triceps_overhead_ext', name: 'Overhead Triceps Extension', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { coreKey: 'triceps_skull_crusher', name: 'Skull Crusher', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { coreKey: 'triceps_close_grip_bench', name: 'Close-Grip Bench Press', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { coreKey: 'triceps_bench_dips', name: 'Bench Dips', muscleGroup: 'Triceps', equipment: 'Vücut Ağırlığı', isBodyweight: true },

  // Karın / Core
  { coreKey: 'core_plank', name: 'Plank', muscleGroup: 'Karın / Core', equipment: 'Vücut Ağırlığı', isBodyweight: true },
  { coreKey: 'core_hanging_leg_raise', name: 'Hanging Leg Raise', muscleGroup: 'Karın / Core', equipment: 'Vücut Ağırlığı', isBodyweight: true },
  { coreKey: 'core_cable_crunch', name: 'Cable Crunch', muscleGroup: 'Karın / Core', equipment: 'Kablo' },
  { coreKey: 'core_ab_wheel', name: 'Ab Wheel Rollout', muscleGroup: 'Karın / Core', equipment: 'Vücut Ağırlığı', isBodyweight: true },
  { coreKey: 'core_russian_twist', name: 'Russian Twist', muscleGroup: 'Karın / Core', equipment: 'Vücut Ağırlığı', isBodyweight: true },

  // Tam Vücut
  { coreKey: 'full_kettlebell_swing', name: 'Kettlebell Swing', muscleGroup: 'Tam Vücut', equipment: 'Kettlebell' },
  { coreKey: 'full_farmers_walk', name: "Farmer's Walk", muscleGroup: 'Tam Vücut', equipment: 'Dumbbell' },
  { coreKey: 'full_burpee', name: 'Burpee', muscleGroup: 'Tam Vücut', equipment: 'Vücut Ağırlığı', isBodyweight: true },
];
