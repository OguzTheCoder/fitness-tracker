interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  accent?: 'emerald' | 'sky' | 'amber' | 'rose';
  label: string;
  centerText: string;
  centerSubtext?: string;
}

const STROKE_COLORS = {
  emerald: 'stroke-emerald-500 dark:stroke-emerald-400',
  sky: 'stroke-sky-500 dark:stroke-sky-400',
  amber: 'stroke-amber-500 dark:stroke-amber-400',
  rose: 'stroke-rose-500 dark:stroke-rose-400',
};

export function ProgressRing({
  value,
  max,
  size = 112,
  strokeWidth = 10,
  accent = 'emerald',
  label,
  centerText,
  centerSubtext,
}: ProgressRingProps) {
  const safeMax = max > 0 ? max : 1;
  const rawPct = Math.round((value / safeMax) * 100);
  const clamped = Math.min(100, Math.max(0, rawPct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${STROKE_COLORS[accent]} transition-all duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-base font-bold leading-tight text-ink">{centerText}</span>
        {centerSubtext && (
          <span className="mt-0.5 text-[10px] font-medium leading-tight text-ink-muted">
            {centerSubtext}
          </span>
        )}
      </div>
    </div>
  );
}
