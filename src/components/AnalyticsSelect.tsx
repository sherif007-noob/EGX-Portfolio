import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { DropdownPresence } from './PremiumMotion';

export interface AnalyticsSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  description?: string;
}

interface AnalyticsSelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: AnalyticsSelectOption<T>[];
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
  compact?: boolean;
  accent?: 'cyan' | 'emerald' | 'purple' | 'blue' | 'amber' | 'rose' | 'teal';
}

const ACCENTS = {
  cyan: {
    selected: 'bg-cyan-500/10 text-cyan-200',
    check: 'text-cyan-400',
    ring: 'focus-visible:ring-cyan-500/40',
  },
  emerald: {
    selected: 'bg-emerald-500/10 text-emerald-200',
    check: 'text-emerald-400',
    ring: 'focus-visible:ring-emerald-500/40',
  },
  purple: {
    selected: 'bg-purple-500/10 text-purple-200',
    check: 'text-purple-400',
    ring: 'focus-visible:ring-purple-500/40',
  },
  blue: {
    selected: 'bg-blue-500/10 text-blue-200',
    check: 'text-blue-400',
    ring: 'focus-visible:ring-blue-500/40',
  },
  amber: {
    selected: 'bg-amber-500/10 text-amber-200',
    check: 'text-amber-400',
    ring: 'focus-visible:ring-amber-500/40',
  },
  rose: {
    selected: 'bg-rose-500/10 text-rose-200',
    check: 'text-rose-400',
    ring: 'focus-visible:ring-rose-500/40',
  },
  teal: {
    selected: 'bg-teal-500/10 text-teal-200',
    check: 'text-teal-400',
    ring: 'focus-visible:ring-teal-500/40',
  },
} as const;

export function AnalyticsSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel,
  compact = false,
  accent = 'cyan',
}: AnalyticsSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const accentClasses = ACCENTS[accent];

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!selectedOption) return null;

  return (
    <div ref={wrapperRef} className={`relative ${open ? 'z-[70]' : ''} ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-accent={accent}
        onClick={() => setOpen((current) => !current)}
        className={[
          'premium-control premium-select-trigger group flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-950/70 text-left text-slate-200',
          'hover:border-slate-600 hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2',
          accentClasses.ring,
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          buttonClassName,
        ].join(' ')}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{selectedOption.label}</span>
          {!compact && selectedOption.description && (
            <span className="mt-0.5 block truncate text-[10px] leading-4 text-slate-500">
              {selectedOption.description}
            </span>
          )}
        </span>
        <ChevronDown
          className={`premium-motion-chevron h-4 w-4 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <DropdownPresence
        isOpen={open}
        role="listbox"
        dataAccent={accent}
        className={[
          'premium-floating premium-dropdown premium-refraction premium-refraction-overlay absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border p-1.5',
          'max-h-72 overflow-y-auto',
          menuClassName,
        ].join(' ')}
      >
        {open && <>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={[
                  'premium-menu-item flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left',
                  selected
                    ? accentClasses.selected
                    : 'text-slate-300',
                ].join(' ')}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected && <Check className={`h-3.5 w-3.5 ${accentClasses.check}`} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </>}
      </DropdownPresence>
    </div>
  );
}
