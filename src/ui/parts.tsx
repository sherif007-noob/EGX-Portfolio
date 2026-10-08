import React from 'react';
import { toneClass } from './format';

/** Colored summary tile used on Home and Reports. */
export const MetricTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color: string;
  tone?: number | null;
}> = ({ label, value, sub, color, tone }) => (
  <div className="ui-tile" style={{ ['--tile' as string]: color }}>
    <div className="ui-sm">
      <span className="ui-dot" style={{ ['--dot' as string]: color }} />
      {label}
    </div>
    <div className={`ui-mono ${toneClass(tone)}`} style={{ fontSize: '1.2rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
      {value}
    </div>
    {sub && <div className="ui-sm">{sub}</div>}
  </div>
);

/** One label/value line in a metrics list. */
export const StatRow: React.FC<{ label: string; value: React.ReactNode; tone?: number | null; hint?: string }> = ({
  label,
  value,
  tone,
  hint,
}) => (
  <div className="ui-row">
    <span>
      {label}
      {hint && <span className="ui-sm"> · {hint}</span>}
    </span>
    <span className={`ui-mono ${toneClass(tone)}`} style={{ textAlign: 'right' }}>{value}</span>
  </div>
);

export const SectionHeader: React.FC<{ title: string; aside?: React.ReactNode }> = ({ title, aside }) => (
  <div className="ui-section-h">
    <h3 style={{ font: 'inherit', margin: 0 }}>{title}</h3>
    {aside && <span className="ui-sm">{aside}</span>}
  </div>
);
