import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

export function FormField({ id, label, error, className = '', ...props }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-lg border bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 ${
          error
            ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-500/30'
            : 'border-slate-700 focus:border-emerald-400 focus:ring-emerald-500/30'
        } ${className}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
