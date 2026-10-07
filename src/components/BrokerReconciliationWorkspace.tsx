import React, { useRef, useState } from 'react';
import type { EGXTicker, Position, TradeTransaction } from '../types';
import {
  parseBrokerPositionsText,
  parseBrokerSnapshotOcrText,
  reconcileBrokerSnapshot,
  type BrokerReconciliationReport,
} from '../services/brokerReconciliation';
import { currentCairoDateKey } from '../services/corporateActions';
import { recognizeTradeScreenshot } from '../services/ocrParser';
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  GitCompareArrows,
  ScanLine,
  ReceiptText,
  Wallet,
} from 'lucide-react';

interface BrokerReconciliationWorkspaceProps {
  positions: Position[];
  transactions: TradeTransaction[];
  cashBalance: number;
  tickers: EGXTicker[];
  onOpenLedgerEvidence?: (ticker: string, transactionIds: string[], detail: string) => void;
  onOpenCashLedger?: () => void;
}

const formatNumber = (value: number, max = 2) =>
  new Intl.NumberFormat('en-EG', { maximumFractionDigits: max }).format(value);

export const BrokerReconciliationWorkspace: React.FC<BrokerReconciliationWorkspaceProps> = ({
  positions,
  transactions,
  cashBalance,
  tickers,
  onOpenLedgerEvidence,
  onOpenCashLedger,
}) => {
  const [brokerName, setBrokerName] = useState('Telda');
  const [asOfDate, setAsOfDate] = useState(currentCairoDateKey());
  const [brokerCash, setBrokerCash] = useState('');
  const [holdingsText, setHoldingsText] = useState('');
  const [report, setReport] = useState<BrokerReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanningSnapshot, setIsScanningSnapshot] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const runComparison = () => {
    setError(null);
    try {
      if (brokerCash.trim() === '') throw new Error('Enter the broker cash balance.');
      const cash = Number(brokerCash.replace(/[,\s]/g, ''));
      if (!Number.isFinite(cash)) throw new Error('Broker cash balance must be a valid number.');

      const snapshotPositions = parseBrokerPositionsText(holdingsText, tickers);
      setReport(reconcileBrokerSnapshot(
        {
          brokerName,
          asOfDate,
          cashBalance: cash,
          positions: snapshotPositions,
        },
        {
          positions,
          transactions,
          cashBalance,
          tickers,
        },
      ));
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : 'Could not compare the broker snapshot.');
    }
  };

  const importSnapshotFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setHoldingsText(String(reader.result || ''));
      setReport(null);
      setError(null);
    };
    reader.onerror = () => setError('Could not read the broker holdings file.');
    reader.readAsText(file);
  };


  const scanSnapshotImage = async (file: File) => {
    setIsScanningSnapshot(true);
    setReport(null);
    setError(null);

    try {
      const text = await recognizeTradeScreenshot(file);
      const parsed = parseBrokerSnapshotOcrText(text, tickers);
      if (parsed.positions.length === 0) {
        throw new Error('No holdings could be recognized from this broker screenshot. Try a clearer portfolio/holdings view or use CSV/paste.');
      }

      setHoldingsText(
        parsed.positions
          .map((position) => [
            position.ticker,
            position.shares,
            position.avgPrice ?? '',
          ].join(','))
          .join('\n'),
      );
      if (parsed.cashBalance != null) setBrokerCash(String(parsed.cashBalance));
      if (parsed.brokerName) setBrokerName(parsed.brokerName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not scan the broker snapshot.');
    } finally {
      setIsScanningSnapshot(false);
    }
  };

  return (
    <section
      className="premium-modal-section space-y-4 rounded-xl p-4"
      data-broker-reconciliation-workspace
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-cyan-300">
            <GitCompareArrows className="h-4 w-4" />
            <h4 className="text-xs font-bold text-white">Broker Reconciliation Workspace</h4>
          </div>
          <p className="premium-type-helper mt-1 max-w-2xl">
            Compare a broker snapshot against the canonical app ledger. This workspace is read-only:
            corrections must go through the source Transactions or Cash Ledger.
          </p>
        </div>
        <span className="premium-chip shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
          Stage 6.1
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="premium-type-metric-label block">Broker</span>
          <input
            value={brokerName}
            onChange={(event) => setBrokerName(event.target.value)}
            className="premium-field w-full rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            placeholder="Telda"
          />
        </label>
        <label className="space-y-1">
          <span className="premium-type-metric-label block">Snapshot Date</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            className="premium-field w-full rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="premium-type-metric-label block">Broker Cash (EGP)</span>
          <input
            inputMode="decimal"
            value={brokerCash}
            onChange={(event) => setBrokerCash(event.target.value)}
            className="premium-field w-full rounded-xl px-3 py-2 font-mono text-xs text-white focus:outline-none"
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="premium-type-metric-label block">Broker Holdings</span>
            <p className="premium-type-helper mt-0.5">
              One row per holding: <span className="font-mono">TICKER,SHARES</span>. Optional third column: average price.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              disabled={isScanningSnapshot}
              className="premium-action premium-action-success shrink-0 justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
            >
              <ScanLine className={`h-3.5 w-3.5 ${isScanningSnapshot ? 'animate-pulse' : ''}`} />
              {isScanningSnapshot ? 'Scanning…' : 'Scan Screenshot'}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="premium-action shrink-0 justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            >
              <FileUp className="h-3.5 w-3.5" />
              Import CSV / TXT
            </button>
          </div>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void scanSnapshotImage(file);
              event.target.value = '';
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importSnapshotFile(file);
              event.target.value = '';
            }}
          />
        </div>
        <textarea
          value={holdingsText}
          onChange={(event) => {
            setHoldingsText(event.target.value);
            setReport(null);
            setError(null);
          }}
          rows={6}
          className="premium-field w-full resize-y rounded-xl px-3 py-2 font-mono text-xs text-white focus:outline-none"
          placeholder={'Ticker,Shares\nKORA,650\nMPCO,4000\nORHD,300'}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={runComparison}
          className="premium-action premium-action-primary premium-shimmer-border w-full justify-center rounded-xl px-4 py-2 text-xs font-bold sm:w-auto"
        >
          <GitCompareArrows className="h-4 w-4" />
          Compare Broker vs App
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="space-y-4 border-t border-slate-800 pt-4" data-broker-reconciliation-report>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Result</span>
              <strong className={report.isFullyMatched ? 'text-emerald-300' : 'text-amber-300'}>
                {report.isFullyMatched ? 'Matched' : 'Review'}
              </strong>
            </div>
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Matched Holdings</span>
              <strong className="font-mono text-emerald-300">{report.matchedPositions}</strong>
            </div>
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Share Mismatches</span>
              <strong className={report.mismatchedPositions ? 'font-mono text-rose-300' : 'font-mono text-emerald-300'}>
                {report.mismatchedPositions}
              </strong>
            </div>
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Cash Difference</span>
              <strong className={report.cash.matches ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>
                {report.cash.differenceCash > 0 ? '+' : ''}{formatNumber(report.cash.differenceCash)} EGP
              </strong>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-cyan-300" />
              <h5 className="text-xs font-bold text-white">Holdings Comparison</h5>
            </div>

            {report.rows.map((row) => (
              <div
                key={row.ticker}
                className={`premium-subpanel rounded-xl border p-3 ${
                  row.status === 'MATCH'
                    ? 'border-emerald-500/20'
                    : 'border-rose-500/30'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono text-sm text-white">{row.ticker}</strong>
                      <span className="truncate text-[11px] text-slate-400">{row.companyName}</span>
                      {row.status === 'MATCH' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Match
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-rose-300">{row.status.replaceAll('_', ' ')}</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="premium-type-metric-label block">{report.brokerName}</span>
                        <strong className="font-mono text-slate-100">{formatNumber(row.brokerShares, 8)}</strong>
                      </div>
                      <div>
                        <span className="premium-type-metric-label block">App</span>
                        <strong className="font-mono text-slate-100">{formatNumber(row.appShares, 8)}</strong>
                      </div>
                      <div>
                        <span className="premium-type-metric-label block">App − Broker</span>
                        <strong className={`font-mono ${row.differenceShares === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {row.differenceShares > 0 ? '+' : ''}{formatNumber(row.differenceShares, 8)}
                        </strong>
                      </div>
                    </div>
                    {row.status !== 'MATCH' && (
                      <>
                        <p className="mt-2 text-[11px] leading-4 text-slate-400">{row.explanation}</p>
                        {row.ledgerEvidence.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {row.ledgerEvidence.slice(-4).map((item) => (
                              <span key={item.id} className="premium-chip rounded-lg px-2 py-1 font-mono text-[9px] text-slate-300">
                                {item.date} · {item.label} · {item.shareDelta > 0 ? '+' : ''}{formatNumber(item.shareDelta, 8)}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {row.status !== 'MATCH' && onOpenLedgerEvidence && (
                    <button
                      type="button"
                      onClick={() => onOpenLedgerEvidence(
                        row.ticker,
                        row.ledgerTransactionIds,
                        row.explanation,
                      )}
                      className="premium-action shrink-0 justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                    >
                      Open Source Ledger
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={`premium-subpanel rounded-xl border p-3 ${
            report.cash.matches ? 'border-emerald-500/20' : 'border-amber-500/30'
          }`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-300" />
                  <h5 className="text-xs font-bold text-white">Cash Reconciliation</h5>
                  <span className={report.cash.matches ? 'text-[10px] text-emerald-300' : 'text-[10px] text-amber-300'}>
                    {report.cash.matches ? 'MATCH' : 'REVIEW'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div><span className="premium-type-metric-label block">{report.brokerName}</span><strong className="font-mono">{formatNumber(report.cash.brokerCash)}</strong></div>
                  <div><span className="premium-type-metric-label block">App</span><strong className="font-mono">{formatNumber(report.cash.appCash)}</strong></div>
                  <div><span className="premium-type-metric-label block">App − Broker</span><strong className={report.cash.matches ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>{report.cash.differenceCash > 0 ? '+' : ''}{formatNumber(report.cash.differenceCash)}</strong></div>
                </div>
                {!report.cash.matches && <p className="mt-2 text-[11px] leading-4 text-slate-400">{report.cash.explanation}</p>}
              </div>
              {!report.cash.matches && onOpenCashLedger && (
                <button
                  type="button"
                  onClick={onOpenCashLedger}
                  className="premium-action shrink-0 justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                >
                  Open Cash Ledger
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
