import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDDMMYYYY, dmyToIso, formatDateVerbose } from '../utils/dateUtils';

interface DateInputProps {
  id?: string;
  value: string; // ISO (YYYY-MM-DD) or DD/MM/YYYY
  onChange: (isoDate: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  showVerbosePreview?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  id,
  value,
  onChange,
  label,
  required = false,
  className = '',
  showVerbosePreview = true,
}) => {
  // We keep a display text formatted as DD/MM/YYYY
  const [displayText, setDisplayText] = useState<string>(() => formatDateDDMMYYYY(value));
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  // Sync internal display when external value changes
  useEffect(() => {
    if (value) {
      setDisplayText(formatDateDDMMYYYY(value));
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Allow numbers, slashes, dashes, dots
    raw = raw.replace(/[^\d\/\-\.]/g, '');

    // Auto format typing: 08092026 -> 08/09/2026
    if (/^\d{8}$/.test(raw)) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
    } else if (/^\d{6}$/.test(raw)) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/20${raw.slice(4, 6)}`;
    }

    setDisplayText(raw);

    // If matches complete DD/MM/YYYY or D/M/YYYY
    const dmyMatch = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1990 && year <= 2099) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    // On blur, format nicely or convert
    if (!displayText.trim()) return;
    const iso = dmyToIso(displayText);
    onChange(iso);
    setDisplayText(formatDateDDMMYYYY(iso));
  };

  const handleCalendarPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedIso = e.target.value;
    if (pickedIso) {
      onChange(pickedIso);
      setDisplayText(formatDateDDMMYYYY(pickedIso));
    }
  };

  const rawIso = dmyToIso(value || displayText);
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(rawIso) ? rawIso : '';

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-300">
          {label} <span className="text-[10px] text-cyan-400 font-mono">(DD/MM/YYYY)</span>
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY (e.g. 08/09/2026)"
          required={required}
          className="premium-field w-full px-3 py-2 pr-14 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white font-mono text-xs focus:outline-none focus:border-cyan-500/60 placeholder-slate-500 tracking-wider"
        />

        {/* Hidden native date picker with trigger button */}
        <div className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center">
          <input
            ref={hiddenDateInputRef}
            type="date"
            value={isoValue}
            onChange={handleCalendarPickerChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            title="Pick date from calendar"
            aria-label={label ? `${label} calendar picker` : 'Pick date from calendar'}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="premium-icon-action pointer-events-none flex h-9 w-9 items-center justify-center rounded-lg p-0"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </div>

      {showVerbosePreview && displayText && (
        <div className="text-[10px] text-slate-400 flex items-center gap-1 pl-0.5">
          <span>Date:</span>
          <strong className="text-cyan-300 font-medium">
            {formatDateVerbose(isoValue || displayText)}
          </strong>
        </div>
      )}
    </div>
  );
};
