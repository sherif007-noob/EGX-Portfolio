import React from 'react';
import { Edit3, Trash2, Wallet } from 'lucide-react';
import type { TradeTransaction } from '../types';
import { CASH_ROW_LABELS, cashRowAmount, cashRowKind } from '../services/ledgerClassification';
import { toneClass } from './format';

const formatWhen = (tx: TradeTransaction): string => {
  const source = tx.executedAt || tx.date;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return tx.date;
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tx.executedAt ? undefined : 'UTC' });
  if (!tx.executedAt) return day;
  return `${day} · ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

interface CashFlowRowProps {
  tx: TradeTransaction;
  formatEgp: (value: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * A cash movement is its own kind of row: no shares, price or win/loss badge,
 * just what happened and how it moved the cash balance.
 */
export const CashFlowRow: React.FC<CashFlowRowProps> = ({ tx, formatEgp, onEdit, onDelete }) => {
  const kind = cashRowKind(tx);
  const amount = cashRowAmount(tx);
  return (
    <div className="ui-card" style={{ padding: '10px 14px' }} data-journal-row="cash">
      <div className="ui-row" style={{ borderBottom: 0, padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="ui-avatar" style={{ ['--av' as string]: 'var(--ui-amber)' }} aria-hidden="true">
            <Wallet size={17} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{CASH_ROW_LABELS[kind]}</span>
            <span className="ui-sm" style={{ display: 'block' }}>{formatWhen(tx)}</span>
            {tx.notes && (
              <span className="ui-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.notes}
              </span>
            )}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          <span className={`ui-mono ${toneClass(amount)}`} style={{ fontWeight: 600 }}>
            {amount > 0 ? '+' : amount < 0 ? '−' : ''}
            {formatEgp(Math.abs(amount))} <span className="ui-sm">EGP</span>
          </span>
          <button type="button" className="ui-iconbtn" onClick={onEdit} title="Edit Transaction Record" aria-label={`Edit ${CASH_ROW_LABELS[kind].toLowerCase()}`}>
            <Edit3 size={16} aria-hidden />
          </button>
          <button type="button" className="ui-iconbtn" onClick={onDelete} title="Delete Transaction Record" aria-label={`Delete ${CASH_ROW_LABELS[kind].toLowerCase()}`}>
            <Trash2 size={16} aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
};
