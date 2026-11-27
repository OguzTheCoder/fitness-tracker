import { useState, type FormEvent } from 'react';
import { CalendarRange, Filter, RotateCcw } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="ft-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-secondary">
        <CalendarRange className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <span>Tarih Aralığı</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[145px] flex-1 space-y-1">
          <label htmlFor="filter-from" className="block text-xs font-medium text-ink-muted">
            Başlangıç Tarihi
          </label>
          <input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ft-input py-2"
          />
        </div>

        <div className="min-w-[145px] flex-1 space-y-1">
          <label htmlFor="filter-to" className="block text-xs font-medium text-ink-muted">
            Bitiş Tarihi
          </label>
          <input
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ft-input py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="ft-btn-secondary py-2.5 text-sm">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filtrele</span>
          </button>
          {hasFilter && (
            <button type="button" onClick={handleReset} className="ft-btn-ghost py-2.5 text-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Temizle</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </form>
  );
}
