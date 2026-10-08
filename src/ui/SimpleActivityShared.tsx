import React from 'react';
import { Search } from 'lucide-react';
import { formatEgp, formatSigned, toneClass } from './format';

export interface Choice<T extends string> { value: T; label: string; }
export function ActivityPills<T extends string>({ label, value, choices, onChange }: {
  label: string; value: T; choices: readonly Choice<T>[]; onChange: (value: T) => void;
}) {
  return <div className="ui-activity-choice">
    <div className="ui-sm ui-activity-choice-label">{label}</div>
    <div className="ui-pill-wrap" role="group" aria-label={label}>
      {choices.map(item => <button key={item.value} type="button" className="ui-filter-pill"
        aria-pressed={item.value === value} onClick={() => onChange(item.value)}>{item.label}</button>)}
    </div>
  </div>;
}
export function ActivitySearch({ value, onChange, placeholder = 'Search by ticker or company' }: {
  value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return <label className="ui-holdings-search ui-activity-search">
    <Search size={17} aria-hidden="true"/>
    <input type="search" value={value} onChange={event => onChange(event.target.value)}
      aria-label="Search activity" placeholder={placeholder}/>
  </label>;
}
export function ActivityStat({ label, value, amount, note }: {
  label: string; value: number | string; amount?: boolean; note?: string;
}) {
  return <div className="ui-activity-stat">
    <span className="ui-sm">{label}</span>
    <strong className={`ui-mono ${typeof value === 'number' && amount ? toneClass(value) : ''}`}>
      {typeof value === 'number' && amount ? formatSigned(value) : value}
      {amount ? <small> EGP</small> : null}
    </strong>
    {note ? <span className="ui-sm">{note}</span> : null}
  </div>;
}
export function ActivityHeader({ title, detail, action }: {
  title: string; detail: string; action?: React.ReactNode;
}) {
  return <header className="ui-activity-page-head">
    <div><h2>{title}</h2><p className="ui-sm">{detail}</p></div>
    {action && <div className="ui-activity-page-actions">{action}</div>}
  </header>;
}
export function ActivityDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="ui-activity-detail"><span className="ui-sm">{label}</span><strong>{value}</strong></div>;
}
export function formatActivityDate(value: string) {
  const day = (value || '').slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(date)
    : day;
}
export function ActivityEmpty({ children }: { children: React.ReactNode }) {
  return <p className="ui-activity-empty">{children}</p>;
}
export const egp = (value: number) => `${formatEgp(value)} EGP`;
