import React from 'react';

export interface Choice<T extends string | number> { value: T; label: string; }

type PillProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'aria-pressed'> & {
  pressed: boolean;
};

/** Shared visual and accessibility contract for compact choices and toggles. */
export function Pill({ pressed, children, ...props }: PillProps) {
  return <button {...props} type="button" className="ui-filter-pill" aria-pressed={pressed}>{children}</button>;
}

export function PillGroup<const T extends string | number>({ label, value, choices, onChange }: {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: NoInfer<T>) => void;
}) {
  return <div className="ui-pill-wrap" data-ui-pill-group role="group" aria-label={label}>
    {choices.map(choice => <Pill key={choice.value} pressed={value === choice.value}
      onClick={() => onChange(choice.value)}>{choice.label}</Pill>)}
  </div>;
}
