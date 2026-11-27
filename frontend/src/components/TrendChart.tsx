import { useId, useState } from 'react';
import type { TrendPoint } from '../services/statsService';
import { formatTurkishDate } from '../utils/date';

interface TrendChartProps {
  title: string;
  subtitle: string;
  data: TrendPoint[];
  unit: string;
  accent?: 'emerald' | 'sky' | 'amber';
  goalValue?: number;
  goalLabel?: string;
  emptyMessage: string;
}

const ACCENT_STYLES = {
  emerald: {
    stroke: '#10b981',
    fill: '#10b981',
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  sky: {
    stroke: '#0ea5e9',
    fill: '#0ea5e9',
    badge: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25',
  },
  amber: {
    stroke: '#f59e0b',
    fill: '#f59e0b',
    badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  },
};

const WIDTH = 560;
const HEIGHT = 210;
const PAD = { top: 20, right: 20, bottom: 32, left: 50 };

export function TrendChart({
  title,
  subtitle,
  data,
  unit,
  accent = 'emerald',
  goalValue,
  goalLabel,
  emptyMessage,
}: TrendChartProps) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const palette = ACCENT_STYLES[accent];
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  if (data.length === 0) {
    return (
      <section className="ft-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-line-strong bg-subtle px-4 text-center text-sm text-ink-muted">
          {emptyMessage}
        </div>
      </section>
    );
  }

  const values = data.map((d) => d.value);
  const compareValues =
    goalValue !== undefined && goalValue > 0 ? [...values, goalValue] : values;
  const rawMin = Math.min(...compareValues);
  const rawMax = Math.max(...compareValues);
  const padding = rawMax === rawMin ? Math.max(1, rawMax * 0.08) : (rawMax - rawMin) * 0.14;
  const minVal = Math.max(0, rawMin - padding);
  const maxVal = rawMax + padding;
  const rangeVal = maxVal - minVal || 1;

  const yForValue = (val: number) =>
    PAD.top + innerHeight - ((val - minVal) / rangeVal) * innerHeight;

  const points = data.map((item, idx) => {
    const x =
      data.length === 1
        ? PAD.left + innerWidth / 2
        : PAD.left + (idx / (data.length - 1)) * innerWidth;
    const y = yForValue(item.value);
    return { ...item, x, y, idx };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} Z`
      : '';

  const yTicks = [maxVal, (maxVal + minVal) / 2, minVal];
  const xLabelIndices =
    data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const safeIndex =
    activeIndex !== null && activeIndex >= 0 && activeIndex < points.length
      ? activeIndex
      : null;
  const activePoint = safeIndex !== null ? points[safeIndex] : points[points.length - 1];
  const goalY =
    goalValue !== undefined && goalValue > 0 ? yForValue(goalValue) : null;

  return (
    <section className="ft-card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${palette.badge}`}
        >
          <span>
            {safeIndex !== null
              ? `${formatTurkishDate(activePoint.date)}: ${activePoint.value} ${unit}`
              : `Son: ${activePoint.value} ${unit}`}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title} grafiği`}
        className="h-48 w-full overflow-visible"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fill} stopOpacity="0.26" />
            <stop offset="100%" stopColor={palette.fill} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, idx) => {
          const y = PAD.top + (idx / (yTicks.length - 1)) * innerHeight;
          const label =
            Number.isInteger(rawMax) && (unit === 'kcal' || unit === 'adım')
              ? Math.round(tick)
              : tick.toFixed(1);
          return (
            <g key={idx}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                className="stroke-line"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-ink-muted text-[11px]"
              >
                {label}
              </text>
            </g>
          );
        })}

        {goalY !== null && (
          <g>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={goalY}
              y2={goalY}
              stroke={palette.stroke}
              strokeOpacity="0.45"
              strokeWidth="1.25"
              strokeDasharray="6 4"
            />
            {goalLabel && (
              <text
                x={WIDTH - PAD.right}
                y={Math.max(12, goalY - 5)}
                textAnchor="end"
                fill={palette.stroke}
                className="text-[10px] font-medium"
              >
                {goalLabel}
              </text>
            )}
          </g>
        )}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {points.length >= 2 && (
          <path
            d={linePath}
            fill="none"
            stroke={palette.stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {safeIndex !== null && (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={PAD.top}
            y2={PAD.top + innerHeight}
            stroke={palette.stroke}
            strokeOpacity="0.35"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
        )}

        {points.map((p) => {
          const isSelected = safeIndex === p.idx;
          return (
            <g
              key={p.date}
              tabIndex={0}
              role="button"
              aria-label={`${formatTurkishDate(p.date)}: ${p.value} ${unit}`}
              onMouseEnter={() => setActiveIndex(p.idx)}
              onFocus={() => setActiveIndex(p.idx)}
              onClick={() => setActiveIndex(p.idx)}
              className="cursor-pointer outline-none"
            >
              {/* Invisible generous hit area for touch/mouse */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 6 : 4.2}
                className="fill-surface transition-all"
                stroke={palette.stroke}
                strokeWidth={isSelected ? 3 : 2.4}
              >
                <title>{`${formatTurkishDate(p.date)}: ${p.value} ${unit}`}</title>
              </circle>
            </g>
          );
        })}

        {xLabelIndices.map((idx) => {
          const p = points[idx];
          return (
            <text
              key={p.date}
              x={p.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-muted text-[11px]"
            >
              {formatTurkishDate(p.date)}
            </text>
          );
        })}
      </svg>
    </section>
  );
}
