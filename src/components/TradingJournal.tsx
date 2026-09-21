import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TradeTransaction, ClosedTrade, Position, Sector } from '../types';
import { StockLogo } from './StockLogo';
import { formatDateDDMMYYYY, formatDateVerbose } from '../utils/dateUtils';
import { DateInput } from './DateInput';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AnalyticsSelect } from './AnalyticsSelect';
import { NumberStepperInput } from './NumberStepperInput';
import { combineExecutionDateTime, executionDateInputValue, executionTimeInputValue, formatExecutionTime } from '../utils/executionTime';
import {
  BookOpen,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit3,
  Search,
  Layers,
  ShieldAlert,
  Target,
  ArrowUpDown,
  DollarSign,
  PlusCircle,
  Tag,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Check,
  Calendar,
  Sparkles,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface TradingJournalProps {
  transactions: TradeTransaction[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  onDeleteTransaction: (id: string) => Promise<boolean>;
  onEditTransaction?: (updatedTx: TradeTransaction) => void;
  onDeleteTrade?: (id: string) => void;
  onDeletePosition?: (id: string) => void;
  onOpenScreenshotModal?: () => void;
  onSyncToSheets?: () => void;
  isSyncingToSheets?: boolean;
}

export type JournalFilterMode = 'ALL' | 'OPEN' | 'WIN' | 'LOSS' | 'BUY' | 'SELL';

export const TradingJournal: React.FC<TradingJournalProps> = ({
  transactions,
  closedTrades,
  positions,
  onDeleteTransaction,
  onEditTransaction,
  onDeleteTrade,
  onDeletePosition,
  onOpenScreenshotModal,
  onSyncToSheets,
  isSyncingToSheets,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<JournalFilterMode>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'trade_id' | 'ticker'>('desc');
  const [deletedIdToast, setDeletedIdToast] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Delete Confirmation Modal State
  const [txToDelete, setTxToDelete] = useState<TradeTransaction | null>(null);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode, sortOrder, pageSize]);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<TradeTransaction | null>(null);
  const [editType, setEditType] = useState<'BUY' | 'SELL'>('BUY');
  const [editTicker, setEditTicker] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editSector, setEditSector] = useState<Sector>('Banking');
  const [editShares, setEditShares] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editFees, setEditFees] = useState<string>('');
  const [editCycleTag, setEditCycleTag] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTargetPrice, setEditTargetPrice] = useState<string>('');
  const [editStopLoss, setEditStopLoss] = useState<string>('');
  const [editOutcome, setEditOutcome] = useState<'WIN' | 'LOSS' | 'BREAKEVEN'>('WIN');
  const [editRealizedPnlEgp, setEditRealizedPnlEgp] = useState<string>('');
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Helper to accurately resolve sell transaction outcome & realized P&L
  const getTxSellMetrics = (tx: TradeTransaction) => {
    if (tx.type !== 'SELL') return null;

    // 1. Check explicit transaction fields
    if (tx.outcome) {
      const pnl = tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp : 0;
      const pct = tx.realizedPnlPercent !== undefined ? tx.realizedPnlPercent : 0;
      const isWin = tx.outcome === 'WIN';
      const isLoss = tx.outcome === 'LOSS';
      return { pnl, pct, outcome: tx.outcome, isWin, isLoss, isBreakeven: !isWin && !isLoss };
    }

    // 2. Check realizedPnlEgp if populated
    if (tx.realizedPnlEgp !== undefined && tx.realizedPnlEgp !== null) {
      const pnl = tx.realizedPnlEgp;
      const pct = tx.realizedPnlPercent || 0;
      const isWin = pnl > 0.01;
      const isLoss = pnl < -0.01;
      const outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' = isWin ? 'WIN' : isLoss ? 'LOSS' : 'BREAKEVEN';
      return { pnl, pct, outcome, isWin, isLoss, isBreakeven: !isWin && !isLoss };
    }

    // 3. Fallback: match with closedTrades by ticker and date/cycle
    const matchingClosed = closedTrades.find(
      (ct) =>
        ct.ticker.toUpperCase() === tx.ticker.toUpperCase() &&
        (ct.sellDate === tx.date || (tx.cycleTag && ct.cycleTag === tx.cycleTag))
    );

    if (matchingClosed) {
      const pnl = matchingClosed.realizedPnlEgp;
      const pct = matchingClosed.realizedPnlPercent;
      const outcome = matchingClosed.outcome;
      return {
        pnl,
        pct,
        outcome,
        isWin: outcome === 'WIN',
        isLoss: outcome === 'LOSS',
        isBreakeven: outcome === 'BREAKEVEN'
      };
    }

    return { pnl: 0, pct: 0, outcome: 'BREAKEVEN' as const, isWin: false, isLoss: false, isBreakeven: true };
  };

  // Compute counts for filter pills
  const winCount = useMemo(
    () => transactions.filter((t) => t.type === 'SELL' && getTxSellMetrics(t)?.isWin).length,
    [transactions, closedTrades]
  );
  const lossCount = useMemo(
    () => transactions.filter((t) => t.type === 'SELL' && getTxSellMetrics(t)?.isLoss).length,
    [transactions, closedTrades]
  );
  const buyCount = useMemo(
    () => transactions.filter((t) => t.type === 'BUY').length,
    [transactions]
  );
  const sellCount = useMemo(
    () => transactions.filter((t) => t.type === 'SELL').length,
    [transactions]
  );

  // Identify transactions corresponding to currently active open positions
  const openTickersSet = useMemo(
    () => new Set(positions.map((p) => p.ticker.toUpperCase())),
    [positions]
  );

  const openPositionsTransactionsCount = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === 'BUY' && openTickersSet.has(t.ticker.toUpperCase())
      ).length,
    [transactions, openTickersSet]
  );

  // Financial summary metrics
  const totalRealizedPnl = useMemo(
    () =>
      transactions.reduce((acc, t) => {
        if (t.type !== 'SELL') return acc;
        const metrics = getTxSellMetrics(t);
        return acc + (metrics?.pnl || 0);
      }, 0),
    [transactions, closedTrades]
  );

  const totalFeesPaid = useMemo(
    () => transactions.reduce((acc, t) => acc + (t.fees || 0), 0),
    [transactions]
  );

  const totalBuyOutlay = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'BUY')
        .reduce((acc, t) => acc + (t.totalAmount || t.shares * t.price + (t.fees || 0)), 0),
    [transactions]
  );

  // Sort and filter transactions chronologically
  const filteredAndSortedTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          tx.ticker.toLowerCase().includes(q) ||
          tx.companyName.toLowerCase().includes(q) ||
          (tx.notes && tx.notes.toLowerCase().includes(q)) ||
          tx.sector.toLowerCase().includes(q);

        if (!matchesSearch) return false;

        if (filterMode === 'WIN') {
          return tx.type === 'SELL' && !!getTxSellMetrics(tx)?.isWin;
        }
        if (filterMode === 'LOSS') {
          return tx.type === 'SELL' && !!getTxSellMetrics(tx)?.isLoss;
        }
        if (filterMode === 'OPEN') {
          return tx.type === 'BUY' && openTickersSet.has(tx.ticker.toUpperCase());
        }
        if (filterMode === 'BUY') {
          return tx.type === 'BUY';
        }
        if (filterMode === 'SELL') {
          return tx.type === 'SELL';
        }
        return true; // 'ALL'
      })
      .sort((a, b) => {
        // Mode: By Ticker (A-Z)
        if (sortOrder === 'ticker') {
          const comp = a.ticker.localeCompare(b.ticker);
          if (comp !== 0) return comp;
        }

        // Mode 1: Strict Trade ID Sequence (#1 -> #N)
        if (sortOrder === 'trade_id') {
          const rawA = a.tradeId ?? (a as any).trade_id;
          const rawB = b.tradeId ?? (b as any).trade_id;
          const idA = typeof rawA === 'number' ? rawA : parseFloat(String(rawA || '')) || 0;
          const idB = typeof rawB === 'number' ? rawB : parseFloat(String(rawB || '')) || 0;
          if (idA && idB && idA !== idB) return idA - idB;
        }

        // Mode 2 & 3: Chronological (asc) or Newest First (desc)
        const timeA = new Date(a.executedAt || a.date).getTime() || 0;
        const timeB = new Date(b.executedAt || b.date).getTime() || 0;

        if (timeA !== timeB) {
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        }

        // On the exact same execution date:
        // 1. Compare tradeId if available
        const rawA = a.tradeId ?? (a as any).trade_id;
        const rawB = b.tradeId ?? (b as any).trade_id;
        const idA = typeof rawA === 'number' ? rawA : parseFloat(String(rawA || '')) || 0;
        const idB = typeof rawB === 'number' ? rawB : parseFloat(String(rawB || '')) || 0;
        if (idA && idB && idA !== idB) {
          return sortOrder === 'desc' ? idB - idA : idA - idB;
        }

        // 2. Lot execution integrity: A BUY must always precede a SELL
        if (sortOrder === 'desc') {
          // In reverse time, the SELL executed later in the day is at the top
          if (a.type === 'SELL' && b.type === 'BUY') return -1;
          if (a.type === 'BUY' && b.type === 'SELL') return 1;
        } else {
          // In chronological order, the BUY entry must be listed first before the SELL exit
          if (a.type === 'BUY' && b.type === 'SELL') return -1;
          if (a.type === 'SELL' && b.type === 'BUY') return 1;
        }

        return 0;
      });
  }, [transactions, searchQuery, filterMode, sortOrder, openTickersSet, closedTrades]);

  const totalFilteredCount = filteredAndSortedTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTransactions = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedTransactions.slice(startIdx, startIdx + pageSize);
  }, [filteredAndSortedTransactions, safeCurrentPage, pageSize]);

  const handleDelete = (tx: TradeTransaction) => {
    setTxToDelete(tx);
  };

  const handleOpenEditModal = (tx: TradeTransaction) => {
    setEditingTx(tx);
    setEditType(tx.type);
    setEditTicker(tx.ticker);
    setEditCompanyName(tx.companyName || tx.ticker);
    setEditSector(tx.sector || 'Banking');
    setEditShares(tx.shares ? tx.shares.toString() : '0');
    setEditPrice(tx.price ? tx.price.toString() : '0');
    setEditDate(executionDateInputValue(tx.executedAt, tx.date || new Date().toISOString().split('T')[0]));
    setEditTime(executionTimeInputValue(tx.executedAt));
    setEditFees(tx.fees !== undefined ? tx.fees.toString() : '0');
    setEditCycleTag(tx.cycleTag || '');
    setEditNotes(tx.notes || '');
    setEditTargetPrice(tx.targetPrice ? tx.targetPrice.toString() : '');
    setEditStopLoss(tx.stopLoss ? tx.stopLoss.toString() : '');
    
    if (tx.type === 'SELL') {
      const metrics = getTxSellMetrics(tx);
      setEditOutcome(metrics?.outcome || tx.outcome || 'WIN');
      setEditRealizedPnlEgp(
        tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp.toString() : metrics ? metrics.pnl.toString() : '0'
      );
    } else {
      setEditOutcome('WIN');
      setEditRealizedPnlEgp('');
    }
    setEditFeedback(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const sharesNum = parseFloat(editShares);
    const priceNum = parseFloat(editPrice);
    const feesNum = parseFloat(editFees) || 0;
    const targetPriceNum = editTargetPrice ? parseFloat(editTargetPrice) : undefined;
    const stopLossNum = editStopLoss ? parseFloat(editStopLoss) : undefined;

    if (!editTicker.trim()) {
      setEditFeedback('Please enter a valid stock ticker symbol.');
      return;
    }

    if (isNaN(sharesNum) || sharesNum <= 0) {
      setEditFeedback('Please enter a valid positive number of shares.');
      return;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      setEditFeedback('Please enter a valid positive price per share.');
      return;
    }

    const grossVal = sharesNum * priceNum;
    const totalAmount = editType === 'BUY' ? grossVal + feesNum : Math.max(0, grossVal - feesNum);

    let realizedPnlEgp = editingTx.realizedPnlEgp;
    let realizedPnlPercent = editingTx.realizedPnlPercent;
    let outcome = editingTx.outcome;

    if (editType === 'SELL') {
      const parsedPnl = parseFloat(editRealizedPnlEgp);
      if (!isNaN(parsedPnl)) {
        realizedPnlEgp = parsedPnl;
        const estCost = Math.max(1, grossVal - realizedPnlEgp);
        realizedPnlPercent = (realizedPnlEgp / estCost) * 100;
        outcome = editOutcome;
      }
    }

    const updatedTx: TradeTransaction = {
      ...editingTx,
      type: editType,
      ticker: editTicker.trim().toUpperCase(),
      companyName: editCompanyName.trim() || editTicker.trim().toUpperCase(),
      sector: editSector,
      shares: sharesNum,
      price: priceNum,
      date: editDate,
      executedAt: combineExecutionDateTime(editDate, editTime),
      fees: feesNum,
      totalAmount,
      cycleTag: editCycleTag.trim() || undefined,
      notes: editNotes.trim() || undefined,
      targetPrice: targetPriceNum,
      stopLoss: stopLossNum,
      realizedPnlEgp: editType === 'SELL' ? realizedPnlEgp : undefined,
      realizedPnlPercent: editType === 'SELL' ? realizedPnlPercent : undefined,
      outcome: editType === 'SELL' ? outcome : undefined,
    };

    if (onEditTransaction) {
      onEditTransaction(updatedTx);
    }
    setEditingTx(null);
  };

  return (
    <div className="premium-section-enter space-y-4">
      {/* Toast Notification for deletion */}
      {deletedIdToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="premium-floating px-4 py-2.5 rounded-xl border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Transaction for {deletedIdToast} deleted successfully</span>
          </div>
        </div>
      )}

      {/* Top Banner with P&L, Transaction Stats and Commissions */}
      <div className="premium-glass flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Trade Journal &amp; Transaction Ledger
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {onSyncToSheets && (
                <button
                  type="button"
                  onClick={onSyncToSheets}
                  disabled={isSyncingToSheets}
                  className="premium-action premium-action-success flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50"
                  title="Sync local transaction ledger to Google Sheet"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToSheets ? 'animate-spin' : ''}`} />
                  <span>{isSyncingToSheets ? 'Syncing...' : 'Sync to Google Sheet'}</span>
                </button>
              )}

              {onOpenScreenshotModal && (
                <button
                  type="button"
                  onClick={onOpenScreenshotModal}
                  className="premium-action premium-action-success flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Scan Trade Screenshot</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Chronological log of all individual executions (entries, DCA purchases, and exit sales). Each buy order is tracked as a separate transaction at its exact purchase price.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="premium-subpanel p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px] font-medium">Total Transactions</span>
            <span className="font-mono font-bold text-white text-sm">
              {transactions.length}{' '}
              <span className="text-[11px] text-slate-400 font-normal">
                ({buyCount}B / {sellCount}S)
              </span>
            </span>
          </div>

          <div className={`premium-subpanel p-2.5 rounded-xl ${totalRealizedPnl > 0 ? 'premium-state-win' : totalRealizedPnl < 0 ? 'premium-state-loss' : 'premium-state-breakeven'}`}>
            <span className="text-slate-400 block text-[10px] font-medium">Net Realized P&amp;L</span>
            <span
              className={`font-mono font-bold text-sm ${
                totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalRealizedPnl >= 0 ? '+' : ''}
              {formatEgp(totalRealizedPnl)} EGP
            </span>
          </div>

          <div className="premium-subpanel premium-state-buy p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px] font-medium">Total Buy Inflow</span>
            <span className="font-mono font-bold text-blue-400 text-sm">
              {formatEgp(totalBuyOutlay)} EGP
            </span>
          </div>

          <div className="premium-subpanel premium-state-breakeven p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px] font-medium">Brokerage Fees Paid</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {formatEgp(totalFeesPaid)} EGP
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="premium-panel flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl">
        <div className="relative flex-1 min-w-[240px] max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="journal-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticker (COMI), company, or notes..."
            className="premium-field w-full pl-9 pr-3 py-1.5 rounded-xl text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none"
          />
        </div>

        {/* Filter Pills and Sort Dropdown */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="journal-filter-all"
            onClick={() => setFilterMode('ALL')}
            className={`premium-filter-pill px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'ALL' ? 'premium-filter-active-amber' : ''}`}
          >
            All ({transactions.length})
          </button>

          <button
            id="journal-filter-open"
            onClick={() => setFilterMode('OPEN')}
            className={`premium-filter-pill flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'OPEN' ? 'premium-filter-active-blue' : ''}`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Open Positions ({openPositionsTransactionsCount})
          </button>

          <button
            id="journal-filter-wins"
            onClick={() => setFilterMode('WIN')}
            className={`premium-filter-pill flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'WIN' ? 'premium-filter-active-emerald' : ''}`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            Wins ({winCount})
          </button>

          <button
            id="journal-filter-losses"
            onClick={() => setFilterMode('LOSS')}
            className={`premium-filter-pill flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'LOSS' ? 'premium-filter-active-rose' : ''}`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            Losses ({lossCount})
          </button>

          <button
            id="journal-filter-buys"
            onClick={() => setFilterMode('BUY')}
            className={`premium-filter-pill px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'BUY' ? 'premium-filter-active-cyan' : ''}`}
          >
            Buys Only ({buyCount})
          </button>

          <button
            id="journal-filter-sells"
            onClick={() => setFilterMode('SELL')}
            className={`premium-filter-pill px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'SELL' ? 'premium-filter-active-purple' : ''}`}
          >
            Sells Only ({sellCount})
          </button>

          {/* Compact Sort Dropdown Select */}
          <div className="premium-subpanel flex items-center gap-1.5 px-2.5 py-1 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <AnalyticsSelect
              value={sortOrder}
              onChange={(value) => setSortOrder(value as typeof sortOrder)}
              compact
              accent="amber"
              ariaLabel="Sort transaction journal"
              className="min-w-[170px]"
              options={[
                { value: 'desc', label: 'Sort: Newest First' },
                { value: 'asc', label: 'Sort: Oldest First' },
                { value: 'trade_id', label: 'Sort: By Trade #' },
                { value: 'ticker', label: 'Sort: By Ticker (A-Z)' },
              ]}
            />
          </div>

          {/* Page Size Selector */}
          <div className="premium-subpanel flex items-center gap-1.5 px-2.5 py-1 rounded-xl">
            <span className="text-[11px] font-medium text-slate-400">Show:</span>
            <AnalyticsSelect
              value={pageSize}
              onChange={(value) => setPageSize(Number(value))}
              compact
              ariaLabel="Rows per page"
              className="min-w-[112px]"
              options={[
                { value: 15, label: '15 / page' },
                { value: 25, label: '25 / page' },
                { value: 50, label: '50 / page' },
                { value: 100, label: '100 / page' },
                { value: 1000, label: 'All' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Pagination Status & Controls (Top) */}
      {totalFilteredCount > pageSize && (
        <div className="premium-subpanel flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{(safeCurrentPage - 1) * pageSize + 1}</strong> - <strong className="text-white">{Math.min(safeCurrentPage * pageSize, totalFilteredCount)}</strong> of <strong className="text-white">{totalFilteredCount}</strong> trades
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="premium-icon-action p-1.5 rounded-lg disabled:opacity-30 text-slate-300"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="premium-icon-action p-1.5 rounded-lg disabled:opacity-30 text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="premium-chip px-2 py-0.5 rounded-lg font-mono text-white font-semibold">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="premium-icon-action p-1.5 rounded-lg disabled:opacity-30 text-slate-300"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="premium-icon-action p-1.5 rounded-lg disabled:opacity-30 text-slate-300"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Transactions Feed */}
      <div className="space-y-3">
        {paginatedTransactions.map((tx) => {
          const isBuy = tx.type === 'BUY';
          const isSell = tx.type === 'SELL';
          const sellMetrics = isSell ? getTxSellMetrics(tx) : null;
          const isWinningSell = !!sellMetrics?.isWin;
          const isLosingSell = !!sellMetrics?.isLoss;
          const isBreakevenSell = isSell && !isWinningSell && !isLosingSell;
          const realizedPnlEgp = sellMetrics ? sellMetrics.pnl : 0;
          const realizedPnlPercent = sellMetrics ? sellMetrics.pct : 0;

          const isOpenPosition = isBuy && openTickersSet.has(tx.ticker.toUpperCase());
          const grossAmount = tx.shares * tx.price;
          const totalOutlayOrProceeds =
            tx.totalAmount ||
            (isBuy ? grossAmount + (tx.fees || 0) : Math.max(0, grossAmount - (tx.fees || 0)));

          return (
            <div
              key={tx.id}
              className={`premium-card p-4 rounded-2xl border transition space-y-3 relative overflow-hidden ${
                isBuy
                  ? 'premium-glow-buy'
                  : isWinningSell
                  ? 'premium-glow-win'
                  : isLosingSell
                  ? 'premium-glow-loss'
                  : 'premium-glow-breakeven'
              }`}
            >
              {/* Row 1: Ticker, Type Tag, Date, and P&L / Total Outlay */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StockLogo
                    ticker={tx.ticker}
                    companyName={tx.companyName}
                    sector={tx.sector}
                    size="lg"
                  />

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-base tracking-wide">
                        {tx.ticker}
                      </span>

                      {/* Trade Sequence ID */}
                      {(tx.tradeId !== undefined || (tx as any).trade_id !== undefined) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold premium-chip text-amber-300 border-amber-500/30">
                          Trade #{tx.tradeId ?? (tx as any).trade_id}
                        </span>
                      )}

                      {/* Transaction Type Tag */}
                      {isBuy ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            tx.isDCA
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}
                        >
                          <PlusCircle className="w-3 h-3" />
                          {tx.isDCA ? 'BUY (DCA LOT)' : 'BUY (INITIAL LOT)'}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isWinningSell
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : isLosingSell
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {isWinningSell ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : isLosingSell ? (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-amber-400" />
                          )}
                          {isWinningSell
                            ? 'SELL EXIT (WIN)'
                            : isLosingSell
                            ? 'SELL EXIT (LOSS)'
                            : 'SELL EXIT (BREAKEVEN)'}
                        </span>
                      )}

                      {/* Open Position Indicator */}
                      {isOpenPosition && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Active Holding
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium premium-chip text-slate-400">
                        {tx.sector}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">{tx.companyName}</p>
                  </div>
                </div>

                {/* Right side: Financial Impact & Delete Action */}
                <div className="flex items-center gap-3 text-right">
                  <div>
                    {isSell ? (
                      <>
                        <div
                          className={`font-mono font-bold text-base ${
                            isWinningSell
                              ? 'text-emerald-400'
                              : isLosingSell
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {realizedPnlEgp > 0 ? '+' : ''}
                          {formatEgp(realizedPnlEgp)} EGP
                        </div>
                        <div
                          className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                            isWinningSell
                              ? 'text-emerald-500'
                              : isLosingSell
                              ? 'text-rose-500'
                              : 'text-amber-500'
                          }`}
                        >
                          {isWinningSell ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : isLosingSell ? (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {realizedPnlPercent > 0 ? '+' : ''}
                            {realizedPnlPercent.toFixed(2)}% Realized
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono font-bold text-base text-blue-400">
                          {formatEgp(totalOutlayOrProceeds)} EGP
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          Total Capital Outlay
                        </div>
                      </>
                    )}
                  </div>

                  {/* Edit and Delete Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(tx)}
                      title="Edit Transaction Record"
                      className="premium-icon-action premium-icon-edit p-2 rounded-xl"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx)}
                      title="Delete Transaction Record"
                      className="premium-icon-action premium-icon-delete p-2 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Detailed Transaction Attributes Grid */}
              <div className="premium-inset-glass grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">Transaction Shares</span>
                  <span className="font-mono text-slate-100 font-bold">
                    {tx.shares.toLocaleString()} shares
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">
                    {isBuy ? 'Exact Buy Price' : 'Exact Sell Price'}
                  </span>
                  <span className="font-mono text-slate-100 font-bold">
                    {formatEgp(tx.price)} EGP
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">Execution Date</span>
                  <span
                    className="font-mono text-slate-200 flex items-center gap-1 font-semibold cursor-help"
                    title={`Interpreted Date: ${formatDateVerbose(tx.date, true)}`}
                  >
                    <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{formatDateVerbose(tx.date, false)}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatDateDDMMYYYY(tx.date)}
                    {formatExecutionTime(tx.executedAt) ? ` • ${formatExecutionTime(tx.executedAt)}` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">Brokerage Fee</span>
                  <span className="font-mono text-amber-400 font-semibold">
                    {tx.fees ? `${formatEgp(tx.fees)} EGP` : '0.00 EGP'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-medium">
                    {isBuy ? 'Net Cash Outlay' : 'Net Proceeds'}
                  </span>
                  <span className="font-mono text-slate-100 font-semibold">
                    {formatEgp(totalOutlayOrProceeds)} EGP
                  </span>
                </div>
              </div>

              {/* Row 3: Holding Duration, Targets & Journal Notes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs pt-0.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {isSell && tx.holdingDays !== undefined && (
                    <span className="premium-chip text-slate-400 flex items-center gap-1 font-medium px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Holding Period: <strong className="text-slate-200">{tx.holdingDays} days</strong>
                    </span>
                  )}

                  {isBuy && tx.targetPrice && (
                    <span className="premium-chip flex items-center gap-1 text-emerald-400 px-2.5 py-1 rounded-lg border-emerald-500/30 font-medium">
                      <Target className="w-3.5 h-3.5" />
                      Target: <strong className="font-mono">{formatEgp(tx.targetPrice)}</strong>
                    </span>
                  )}

                  {isBuy && tx.stopLoss && (
                    <span className="premium-chip flex items-center gap-1 text-rose-400 px-2.5 py-1 rounded-lg border-rose-500/30 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Stop: <strong className="font-mono">{formatEgp(tx.stopLoss)}</strong>
                    </span>
                  )}
                </div>

                {tx.notes && (
                  <div className="premium-chip text-xs text-slate-300 italic px-3 py-1.5 rounded-xl flex-1 sm:max-w-md truncate">
                    &ldquo;{tx.notes}&rdquo;
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredAndSortedTransactions.length === 0 && (
          <div className="premium-subpanel text-center py-12 rounded-2xl border-dashed text-xs text-slate-400 space-y-3">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-1" />
            <div>
              <p className="font-semibold text-slate-300">No transactions match your criteria.</p>
              <p className="text-slate-500 mt-0.5">
                Clear your search query or switch filters to view transactions.
              </p>
            </div>
            {(searchQuery || filterMode !== 'ALL') && (
              <div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('ALL');
                  }}
                  className="premium-action premium-action-primary px-4 py-2 rounded-xl font-semibold text-xs"
                >
                  Reset All Filters &amp; Show All ({transactions.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls (Bottom) */}
      {totalFilteredCount > pageSize && (
        <div className="premium-panel flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs text-slate-400">
          <span>
            Page <strong className="text-white">{safeCurrentPage}</strong> of <strong className="text-white">{totalPages}</strong> ({totalFilteredCount} total transactions)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="premium-action px-2.5 py-1.5 rounded-xl disabled:opacity-30 text-slate-300 flex items-center gap-1"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="premium-action px-2.5 py-1.5 rounded-xl disabled:opacity-30 text-slate-300 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="premium-chip px-3 py-1 rounded-xl font-mono text-white font-bold">
              {safeCurrentPage}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="premium-action px-2.5 py-1.5 rounded-xl disabled:opacity-30 text-slate-300 flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="premium-action px-2.5 py-1.5 rounded-xl disabled:opacity-30 text-slate-300 flex items-center gap-1"
            >
              Last
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete Transaction Modal */}
      <ConfirmDeleteModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={async () => {
          if (!txToDelete) return;
          const ticker = txToDelete.ticker;
          const deleted = await onDeleteTransaction(txToDelete.id);
          if (deleted) {
            setDeletedIdToast(ticker);
            setTimeout(() => setDeletedIdToast(null), 3000);
            setTxToDelete(null);
          }
        }}
        title="Delete Transaction Record"
        description="Are you sure you want to permanently delete this trade record from your journal? This will update your position calculations and cash history."
        itemDetails={
          txToDelete
            ? {
                ticker: txToDelete.ticker,
                type: txToDelete.type,
                shares: txToDelete.shares,
                amount: `${(txToDelete.totalAmount || txToDelete.shares * txToDelete.price).toFixed(2)} EGP`,
                date: txToDelete.date,
              }
            : undefined
        }
      />

      {/* Edit Transaction Modal */}
      {editingTx && createPortal((
        <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="premium-modal w-full max-w-xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Transaction</h3>
                  <p className="text-xs text-slate-400">
                    Modify execution details, prices, shares, fees, or notes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="premium-icon-action p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFeedback && (
              <div className="premium-modal-section p-3 rounded-xl border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType('BUY')}
                    className={`premium-choice py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 ${editType === 'BUY' ? 'premium-filter-active-blue' : ''}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    BUY (Stock Entry / DCA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('SELL')}
                    className={`premium-choice py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 ${editType === 'SELL' ? 'premium-filter-active-purple' : ''}`}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    SELL (Exit / Liquidation)
                  </button>
                </div>
              </div>

              {/* Ticker & Sector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Stock Ticker Symbol</label>
                  <input
                    type="text"
                    required
                    value={editTicker}
                    onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                    className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    placeholder="e.g. CANA, TAQA, ADIB"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Company Name</label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="premium-field w-full px-3 py-2 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Suez Canal Bank"
                  />
                </div>
              </div>

              {/* Shares & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Executed Shares</label>
                  <NumberStepperInput
                    step={1}
                    min={1}
                    required
                    value={editShares}
                    onValueChange={setEditShares}
                    accent="blue"
                    className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    placeholder="100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Price per Share (EGP)</label>
                  <NumberStepperInput
                    step={0.001}
                    min={0.001}
                    required
                    value={editPrice}
                    onValueChange={setEditPrice}
                    accent="blue"
                    className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    placeholder="43.21"
                  />
                </div>

                <DateInput
                  id="edit-tx-date"
                  label="Execution Date"
                  value={editDate}
                  onChange={setEditDate}
                  required
                />

                <div className="space-y-1">
                  <label htmlFor="edit-tx-time" className="text-slate-300 font-semibold">Execution Time</label>
                  <input
                    id="edit-tx-time"
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Fees & Cycle Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Brokerage Commission (EGP)</label>
                  <NumberStepperInput
                    step={0.01}
                    min={0}
                    value={editFees}
                    onValueChange={setEditFees}
                    accent="amber"
                    className="premium-field w-full px-3 py-2 rounded-xl text-amber-300 font-mono focus:outline-none focus:border-blue-500"
                    placeholder="12.50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Cycle Tag / Trade ID</label>
                  <input
                    type="text"
                    value={editCycleTag}
                    onChange={(e) => setEditCycleTag(e.target.value)}
                    className="premium-field w-full px-3 py-2 rounded-xl text-purple-300 font-mono focus:outline-none focus:border-blue-500"
                    placeholder="e.g. CANA-C1, TAQA-C1"
                  />
                </div>
              </div>

              {/* If SELL: Realized P&L and Outcome */}
              {editType === 'SELL' && (
                <div className="premium-modal-section p-3 rounded-xl border-purple-500/20 space-y-3">
                  <div className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sell Exit Financial Outcome
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-300 font-semibold">Realized P&amp;L (EGP)</label>
                      <NumberStepperInput
                        step={0.01}
                        value={editRealizedPnlEgp}
                        onValueChange={(value) => {
                          setEditRealizedPnlEgp(value);
                          const val = parseFloat(value);
                          if (!isNaN(val)) {
                            setEditOutcome(val > 0.01 ? 'WIN' : val < -0.01 ? 'LOSS' : 'BREAKEVEN');
                          }
                        }}
                        accent="purple"
                        className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                        placeholder="e.g. 1250.00"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-300 font-semibold">Outcome Status</label>
                      <AnalyticsSelect
                        value={editOutcome}
                        onChange={(value) => setEditOutcome(value as typeof editOutcome)}
                        accent="purple"
                        ariaLabel="Outcome status"
                        options={[
                          { value: 'WIN', label: 'WIN', description: 'Profitable exit' },
                          { value: 'LOSS', label: 'LOSS', description: 'Cut-loss exit' },
                          { value: 'BREAKEVEN', label: 'BREAKEVEN', description: 'Flat exit' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* If BUY: Targets */}
              {editType === 'BUY' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Target Price (Optional)</label>
                    <NumberStepperInput
                      step={0.01}
                      value={editTargetPrice}
                      onValueChange={setEditTargetPrice}
                      accent="emerald"
                      className="premium-field w-full px-3 py-2 rounded-xl text-emerald-300 font-mono focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 52.00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Stop Loss (Optional)</label>
                    <NumberStepperInput
                      step={0.01}
                      value={editStopLoss}
                      onValueChange={setEditStopLoss}
                      accent="rose"
                      className="premium-field w-full px-3 py-2 rounded-xl text-rose-300 font-mono focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 39.50"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Transaction Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="premium-field w-full px-3 py-2 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Order execution notes, broker phase details, strategy reasoning..."
                />
              </div>

              {/* Calculated Preview */}
              <div className="premium-modal-section p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {editType === 'BUY' ? 'Total Cash Outlay (Cost + Fees):' : 'Net Sales Proceeds (Gross - Fees):'}
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatEgp(
                    Math.max(
                      0,
                      (parseFloat(editShares) || 0) * (parseFloat(editPrice) || 0) +
                        (editType === 'BUY' ? (parseFloat(editFees) || 0) : -(parseFloat(editFees) || 0))
                    )
                  )}{' '}
                  EGP
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="premium-action px-4 py-2 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="premium-action premium-action-primary premium-shimmer-border px-5 py-2 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};
