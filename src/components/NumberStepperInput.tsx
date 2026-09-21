import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type StepperAccent = 'slate' | 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'indigo';

interface NumberStepperInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'step' | 'min' | 'max'> {
  value: string | number;
  onValueChange: (value: string) => void;
  step?: number | string;
  min?: number | string;
  max?: number | string;
  accent?: StepperAccent;
}

const ACCENTS: Record<StepperAccent, string> = {
  slate: 'hover:bg-slate-700 text-slate-400 hover:text-white',
  blue: 'hover:bg-blue-500/15 text-slate-400 hover:text-blue-300',
  emerald: 'hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-300',
  rose: 'hover:bg-rose-500/15 text-slate-400 hover:text-rose-300',
  amber: 'hover:bg-amber-500/15 text-slate-400 hover:text-amber-300',
  purple: 'hover:bg-purple-500/15 text-slate-400 hover:text-purple-300',
  indigo: 'hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-300',
};

function numeric(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decimalPlaces(value: string | number): number {
  const text = String(value);
  const decimal = text.indexOf('.');
  return decimal === -1 ? 0 : Math.min(8, text.length - decimal - 1);
}

export const NumberStepperInput: React.FC<NumberStepperInputProps> = ({
  value,
  onValueChange,
  step = 1,
  min,
  max,
  accent = 'slate',
  className = '',
  disabled,
  ...inputProps
}) => {
  const stepValue = Math.abs(numeric(step, 1)) || 1;
  const minValue = min === undefined ? -Infinity : numeric(min, -Infinity);
  const maxValue = max === undefined ? Infinity : numeric(max, Infinity);

  const nudge = (direction: 1 | -1) => {
    const current = Number(value);
    const baseline = Number.isFinite(current)
      ? current
      : Number.isFinite(minValue)
        ? minValue
        : 0;
    const precision = Math.max(decimalPlaces(step), decimalPlaces(baseline));
    const factor = 10 ** Math.min(8, precision);
    const raw = Math.round((baseline + direction * stepValue) * factor) / factor;
    const clamped = Math.min(maxValue, Math.max(minValue, raw));
    onValueChange(String(clamped));
  };

  return (
    <div className="relative">
      <input
        {...inputProps}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className={`premium-field app-number-input pr-10 ${className}`}
      />
      <div className="premium-inset-glass absolute inset-y-[1px] right-[1px] flex w-8 flex-col overflow-hidden rounded-r-[calc(0.75rem-1px)] border-l border-slate-700/40">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => nudge(1)}
          className={`premium-control flex flex-1 items-center justify-center border-b border-slate-700/50 disabled:opacity-30 ${ACCENTS[accent]}`}
          aria-label="Increase value"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => nudge(-1)}
          className={`premium-control flex flex-1 items-center justify-center disabled:opacity-30 ${ACCENTS[accent]}`}
          aria-label="Decrease value"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
