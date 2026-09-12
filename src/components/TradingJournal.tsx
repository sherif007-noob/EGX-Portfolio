import React, { useState, useMemo } from 'react';
import { TradeTransaction, ClosedTrade, Position } from '../types';
import {
  BookOpen,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
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
} from 'lucide-react';

interface TradingJournalProps {
  transactions: TradeTransaction[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  onDeleteTransaction: (id: string) => void;
  onDeleteTrade?: (id: string) => void;
  onDeletePosition?: (id: string) => void;
}

export type JournalFilterMode = 'ALL' | 'OPEN' | 'WIN' | 'LOSS' | 'BUY' | 'SELL';

export const TradingJournal: React.FC<TradingJournalProps> = ({
  transactions,
  closedTrades,
  positions,
  onDeleteTransaction,
  onDeleteTrade,
  onDeletePosition,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<JournalFilterMode>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deletedIdToast, setDeletedIdToast] = useState<string | null>(null);

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Compute counts for filter pills
  const winCount = useMemo(
    () => transactions.filter((t) => t.type === 'SELL' && t.outcome === 'WIN').length,
    [transactions]
  );
  const lossCount = useMemo(
    () => transactions.filter((t) => t.type === 'SELL' && t.outcome === 'LOSS').length,
    [transactions]
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
      transactions.reduce(
        (acc, t) => (t.type === 'SELL' && t.realizedPnlEgp ? acc + t.realizedPnlEgp : acc),
        0
      ),
    [transactions]
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
          return tx.type === 'SELL' && tx.outcome === 'WIN';
        }
        if (filterMode === 'LOSS') {
          return tx.type === 'SELL' && tx.outcome === 'LOSS';
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
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [transactions, searchQuery, filterMode, sortOrder, openTickersSet]);

  const handleDelete = (tx: TradeTransaction) => {
    onDeleteTransaction(tx.id);
    setDeletedIdToast(tx.ticker);
    setTimeout(() => setDeletedIdToast(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification for deletion */}
      {deletedIdToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-2.5 rounded-xl bg-slate-900/95 border border-rose-500/50 text-rose-300 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Transaction for {deletedIdToast} deleted successfully</span>
          </div>
        </div>
      )}

      {/* Top Banner with P&L, Transaction Stats and Commissions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Trade Journal &amp; Transaction Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Chronological log of all individual executions (entries, DCA purchases, and exit sales). Each buy order is tracked as a separate transaction at its exact purchase price.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-medium">Total Transactions</span>
            <span className="font-mono font-bold text-white text-sm">
              {transactions.length}{' '}
              <span className="text-[11px] text-slate-400 font-normal">
                ({buyCount}B / {sellCount}S)
              </span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
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

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-medium">Total Buy Inflow</span>
            <span className="font-mono font-bold text-blue-400 text-sm">
              {formatEgp(totalBuyOutlay)} EGP
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-medium">Brokerage Fees Paid</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {formatEgp(totalFeesPaid)} EGP
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="journal-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticker (COMI), company, or notes..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-400 text-xs sm:text-sm border border-slate-700 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="journal-filter-all"
            onClick={() => setFilterMode('ALL')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'ALL'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            All ({transactions.length})
          </button>

          <button
            id="journal-filter-open"
            onClick={() => setFilterMode('OPEN')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'OPEN'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Open Positions ({openPositionsTransactionsCount})
          </button>

          <button
            id="journal-filter-wins"
            onClick={() => setFilterMode('WIN')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'WIN'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            Wins ({winCount})
          </button>

          <button
            id="journal-filter-losses"
            onClick={() => setFilterMode('LOSS')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'LOSS'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            Losses ({lossCount})
          </button>

          <button
            id="journal-filter-buys"
            onClick={() => setFilterMode('BUY')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'BUY'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            Buys Only ({buyCount})
          </button>

          <button
            id="journal-filter-sells"
            onClick={() => setFilterMode('SELL')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'SELL'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            Sells Only ({sellCount})
          </button>

          {/* Chronological Sort Toggle */}
          <button
            id="journal-sort-toggle"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Toggle Chronological Sort Order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </div>

      {/* Transactions Feed */}
      <div className="space-y-3">
        {filteredAndSortedTransactions.map((tx) => {
          const isBuy = tx.type === 'BUY';
          const isSell = tx.type === 'SELL';
          const isWinningSell = isSell && (tx.realizedPnlEgp || 0) >= 0;
          const isLosingSell = isSell && (tx.realizedPnlEgp || 0) < 0;
          const isOpenPosition = isBuy && openTickersSet.has(tx.ticker.toUpperCase());
          const grossAmount = tx.shares * tx.price;
          const totalOutlayOrProceeds =
            tx.totalAmount ||
            (isBuy ? grossAmount + (tx.fees || 0) : Math.max(0, grossAmount - (tx.fees || 0)));

          return (
            <div
              key={tx.id}
              className={`p-4 rounded-2xl bg-slate-900 border transition shadow-sm space-y-3 relative overflow-hidden ${
                isBuy
                  ? isOpenPosition
                    ? 'border-blue-500/40 hover:border-blue-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                  : isWinningSell
                  ? 'border-emerald-500/30 hover:border-emerald-500/50'
                  : 'border-rose-500/30 hover:border-rose-500/50'
              }`}
            >
              {/* Subtle background glow for quick recognition */}
              <div
                className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none opacity-5 ${
                  isBuy
                    ? isOpenPosition
                      ? 'bg-blue-500'
                      : 'bg-cyan-500'
                    : isWinningSell
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              />

              {/* Row 1: Ticker, Type Tag, Date, and P&L / Total Outlay */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                      isBuy
                        ? 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                        : isWinningSell
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {tx.ticker.slice(0, 4)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-base tracking-wide">
                        {tx.ticker}
                      </span>

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
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isWinningSell ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          )}
                          {isWinningSell ? 'SELL EXIT (WIN)' : 'SELL EXIT (LOSS)'}
                        </span>
                      )}

                      {/* Open Position Indicator */}
                      {isOpenPosition && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Active Holding
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400">
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
                            isWinningSell ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isWinningSell ? '+' : ''}
                          {formatEgp(tx.realizedPnlEgp || 0)} EGP
                        </div>
                        <div
                          className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                            isWinningSell ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {isWinningSell ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isWinningSell ? '+' : ''}
                            {(tx.realizedPnlPercent || 0).toFixed(2)}% Realized
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

                  {/* Instant Delete Button */}
                  <button
                    onClick={() => handleDelete(tx)}
                    title="Delete Transaction Record"
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 transition active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Detailed Transaction Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
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
                  <span className="font-mono text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {tx.date}
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
                    <span className="text-slate-400 flex items-center gap-1 font-medium bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Holding Period: <strong className="text-slate-200">{tx.holdingDays} days</strong>
                    </span>
                  )}

                  {isBuy && tx.targetPrice && (
                    <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-medium">
                      <Target className="w-3.5 h-3.5" />
                      Target: <strong className="font-mono">{formatEgp(tx.targetPrice)}</strong>
                    </span>
                  )}

                  {isBuy && tx.stopLoss && (
                    <span className="flex items-center gap-1 text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-500/30 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Stop: <strong className="font-mono">{formatEgp(tx.stopLoss)}</strong>
                    </span>
                  )}
                </div>

                {tx.notes && (
                  <div className="text-xs text-slate-300 italic bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-800 flex-1 sm:max-w-md truncate">
                    &ldquo;{tx.notes}&rdquo;
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredAndSortedTransactions.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-400 space-y-1">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">No transactions match your criteria.</p>
            <p className="text-slate-500">
              Clear your search query or switch filters to view transactions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
