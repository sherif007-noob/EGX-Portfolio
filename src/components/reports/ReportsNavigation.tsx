import React, { useEffect, useRef } from 'react';
import {
  REPORT_MODES,
  REPORT_MODE_LABELS,
  type ReportsMode,
} from '../../services/reportsWorkspace';

interface ReportsNavigationProps {
  activeMode: ReportsMode;
  onModeChange: (mode: ReportsMode) => void;
}

export const ReportsNavigation: React.FC<ReportsNavigationProps> = ({
  activeMode,
  onModeChange,
}) => {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'auto',
    });
  }, [activeMode]);

  return (
    <nav
      className="premium-panel premium-hierarchy-h4 premium-pad-h4 rounded-2xl"
      aria-label="Reports workspace"
      data-reports-navigation
    >
      <div
        className="premium-selector-shell premium-selector-shell-emphasis premium-reports-mode-rail scrollbar-none flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain"
        role="tablist"
        aria-label="Report mode"
      >
        {REPORT_MODES.map((mode) => {
          const active = activeMode === mode;

          return (
            <button
              key={mode}
              ref={active ? activeButtonRef : undefined}
              id={`reports-mode-${mode}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="reports-active-workspace"
              onClick={() => onModeChange(mode)}
              className={[
                'premium-filter-pill premium-compact-selector shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 font-semibold',
                active ? 'premium-filter-active-cyan' : '',
              ].filter(Boolean).join(' ')}
            >
              {REPORT_MODE_LABELS[mode]}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
