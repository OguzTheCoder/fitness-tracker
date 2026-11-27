import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'md:max-w-lg',
}: SlideOverProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Bottom Sheet / Desktop Right Drawer */}
      <div
        className={`relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-3xl border-t border-line bg-surface shadow-sheet md:h-full md:max-h-none md:rounded-none md:border-l md:border-t-0 ${maxWidthClass}`}
      >
        {/* Mobile grab handle */}
        <div className="flex justify-center pt-2.5 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Paneli kapat"
            className="rounded-xl border border-line bg-subtle p-1.5 text-ink-muted transition hover:border-line-strong hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}
