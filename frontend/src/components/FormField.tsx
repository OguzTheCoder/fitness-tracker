import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({ id, label, error, hint, className = '', ...props }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-ink-secondary">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        className={`ft-input ${
          error
            ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/25'
            : ''
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
