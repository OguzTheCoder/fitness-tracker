import { useState, type FormEvent } from 'react';
import type { DateRange } from '../utils/date';

interface DateRangeFilterProps {
  value: DateRange;
  onApply: (range: DateRange) => void;
}

export function DateRangeFilter({ value, onApply }: DateRangeFilterProps) {
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (from && to && from > to) {
      setError('Başlangıç tarihi bitiş tarihinden büyük olamaz.');
      return;
    }
    setError(null);
    onApply({ from: from || undefined, to: to || undefined });
  }

  function handleReset() {
    setFrom('');
    setTo('');
    setError(null);
    onApply({});
  }

  const hasFilter = Boolean(value.from || value.to || from || to);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[150px] flex-1 space-y-1">
          <label htmlFor="filter-from" className="block text-xs font-medium text-slate-400">
            Başlangıç Tarihi
          </label>
          <input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="min-w-[150px] flex-1 space-y-1">
          <label htmlFor="filter-to" className="block text-xs font-medium text-slate-400">
            Bitiş Tarihi
          </label>
          <input
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          >
            Filtrele
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      )}
    </form>
  );
}
