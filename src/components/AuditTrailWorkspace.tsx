import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { AuditTrailRecord } from '../services/auditTrail';
import { loadAuditTrailFromSupabase } from '../services/supabasePersistence';

interface AuditTrailWorkspaceProps {
  active: boolean;
}

const formatEgp = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat('en-EG', { maximumFractionDigits: 2 }).format(number)
    : '—';
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const AuditTrailWorkspace: React.FC<AuditTrailWorkspaceProps> = ({ active }) => {
  const [records, setRecords] = useState<AuditTrailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRecords(await loadAuditTrailFromSupabase(100));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the audit trail.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  return (
    <section
      className="premium-modal-section space-y-3 rounded-xl p-4"
      data-audit-trail-workspace
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-violet-300" />
            <h4 className="text-xs font-bold text-white">Financial Audit Trail</h4>
            <span className="premium-chip rounded-lg px-2 py-0.5 text-[9px] font-semibold text-violet-200">
              Stage 6.2
            </span>
          </div>
          <p className="premium-type-helper mt-1 max-w-2xl">
            Immutable before/after records for canonical financial mutations. The ledger remains the accounting authority; this is traceability only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="premium-action shrink-0 justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      {!error && !isLoading && records.length === 0 && (
        <div className="premium-inset-glass flex items-start gap-2 rounded-xl p-3 text-[11px] text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <p>
            No audit records yet. The trail begins with the first canonical mutation after Stage 6.2 deployment.
          </p>
        </div>
      )}

      {records.length > 0 && (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {records.map((record) => {
            const expanded = expandedId === record.id;
            const beforeTx = record.beforeState?.transaction;
            const afterTx = record.afterState?.transaction;
            const beforeCash = Number(record.beforeState?.cashBalance);
            const afterCash = Number(record.afterState?.cashBalance);
            const cashChanged = Number.isFinite(beforeCash)
              && Number.isFinite(afterCash)
              && Math.abs(afterCash - beforeCash) > 0.005;

            return (
              <div key={record.id} className="premium-subpanel rounded-xl border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : record.id)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-violet-200">
                        {record.mutationKind}
                      </span>
                      {record.ticker && (
                        <span className="premium-chip rounded-md px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                          {record.ticker}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500">
                        {record.entityType}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {formatDateTime(record.createdAt)}
                      {record.entityId ? ` · ${record.entityId}` : ''}
                    </div>
                    {record.reason && (
                      <div className="mt-1 text-[10px] text-amber-200">
                        Reason: {record.reason}
                      </div>
                    )}
                  </div>
                  {expanded
                    ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
                </button>

                {expanded && (
                  <div className="border-t border-slate-700/50 px-3 pb-3 pt-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="premium-inset-glass rounded-lg p-2.5">
                        <span className="premium-type-metric-label block">Before</span>
                        <div className="mt-1 space-y-1 text-[10px] text-slate-300">
                          <div>Cash: <strong className="font-mono">{formatEgp(beforeCash)} EGP</strong></div>
                          <div>Transactions: <strong className="font-mono">{record.beforeState?.transactionCount ?? '—'}</strong></div>
                          {beforeTx && (
                            <div className="font-mono text-slate-400">
                              {beforeTx.type} · {beforeTx.shares} @ {beforeTx.price}
                            </div>
                          )}
                          {!beforeTx && <div className="text-slate-500">No transaction entity</div>}
                        </div>
                      </div>

                      <div className="premium-inset-glass rounded-lg p-2.5">
                        <span className="premium-type-metric-label block">After</span>
                        <div className="mt-1 space-y-1 text-[10px] text-slate-300">
                          <div>
                            Cash:{' '}
                            <strong className={`font-mono ${cashChanged ? 'text-cyan-200' : ''}`}>
                              {formatEgp(afterCash)} EGP
                            </strong>
                          </div>
                          <div>Transactions: <strong className="font-mono">{record.afterState?.transactionCount ?? '—'}</strong></div>
                          {afterTx && (
                            <div className="font-mono text-slate-400">
                              {afterTx.type} · {afterTx.shares} @ {afterTx.price}
                            </div>
                          )}
                          {!afterTx && <div className="text-slate-500">Transaction removed / no transaction entity</div>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {record.metadata?.addedTransactionIds?.length > 0 && (
                        <span className="premium-chip rounded-md px-2 py-1 text-[9px] text-emerald-300">
                          +{record.metadata.addedTransactionIds.length} ledger row
                        </span>
                      )}
                      {record.metadata?.changedTransactionIds?.length > 0 && (
                        <span className="premium-chip rounded-md px-2 py-1 text-[9px] text-amber-300">
                          {record.metadata.changedTransactionIds.length} edited row
                        </span>
                      )}
                      {record.metadata?.removedTransactionIds?.length > 0 && (
                        <span className="premium-chip rounded-md px-2 py-1 text-[9px] text-rose-300">
                          −{record.metadata.removedTransactionIds.length} ledger row
                        </span>
                      )}
                      {record.metadata?.changedPositionTickers?.length > 0 && (
                        <span className="premium-chip rounded-md px-2 py-1 text-[9px] text-cyan-300">
                          Positions: {record.metadata.changedPositionTickers.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
