import { useId } from 'react';
import type { TrendPoint } from '../services/statsService';
import { formatTurkishDate } from '../utils/date';

interface TrendChartProps {
  title: string;
  subtitle: string;
  data: TrendPoint[];
  unit: string;
  accent?: 'emerald' | 'sky' | 'amber';
  emptyMessage: string;
}

const ACCENT_STYLES = {
  emerald: {
    stroke: '#34d399',
    fill: '#10b981',
    badge: 'bg-emerald-500/15 text-emerald-300',
  },
  sky: {
    stroke: '#38bdf8',
    fill: '#0ea5e9',
    badge: 'bg-sky-500/15 text-sky-300',
  },
  amber: {
    stroke: '#fbbf24',
    fill: '#f59e0b',
    badge: 'bg-amber-500/15 text-amber-300',
  },
};

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 20, right: 20, bottom: 32, left: 48 };

export function TrendChart({
  title,
  subtitle,
  data,
  unit,
  accent = 'emerald',
  emptyMessage,
}: TrendChartProps) {
  const gradientId = useId();
  const palette = ACCENT_STYLES[accent];
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 px-4 text-center text-sm text-slate-400">
          {emptyMessage}
        </div>
      </section>
    );
  }

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = rawMax === rawMin ? Math.max(1, rawMax * 0.05) : (rawMax - rawMin) * 0.12;
  const minVal = Math.max(0, rawMin - padding);
  const maxVal = rawMax + padding;
  const rangeVal = maxVal - minVal || 1;

  const points = data.map((item, idx) => {
    const x =
      data.length === 1
        ? PAD.left + innerWidth / 2
        : PAD.left + (idx / (data.length - 1)) * innerWidth;
    const y = PAD.top + innerHeight - ((item.value - minVal) / rangeVal) * innerHeight;
    return { ...item, x, y };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} Z`
      : '';

  const yTicks = [maxVal, (maxVal + minVal) / 2, minVal];
  const xLabelIndices =
    data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const latest = data[data.length - 1];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${palette.badge}`}>
          Son: {latest.value} {unit}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title} grafiği`}
        className="h-48 w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fill} stopOpacity="0.28" />
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
                stroke="#1e293b"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px]"
              >
                {label}
              </text>
            </g>
          );
        })}

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

        {points.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r="4.5"
            fill="#0f172a"
            stroke={palette.stroke}
            strokeWidth="2.5"
          >
            <title>{`${formatTurkishDate(p.date)}: ${p.value} ${unit}`}</title>
          </circle>
        ))}

        {xLabelIndices.map((idx) => {
          const p = points[idx];
          return (
            <text
              key={p.date}
              x={p.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[11px]"
            >
              {formatTurkishDate(p.date)}
            </text>
          );
        })}
      </svg>
    </section>
  );
}
