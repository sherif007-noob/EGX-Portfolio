import React, { useState, useMemo } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { ExpandPresence, MotionSwap } from './PremiumMotion';
import { AnalyticsSelect } from './AnalyticsSelect';
import { ClosedTrade, TradeTransaction, Sector } from '../types';
import { StockLogo } from './StockLogo';
import { formatDateDDMMYYYY, formatDateVerbose } from '../utils/dateUtils';
import { calculatePerformanceStats } from '../services/portfolioAccounting';
import {
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Clock,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  XCircle,
  Layers,
  Percent,
  Calendar,
  DollarSign,
  Receipt,
  Trash2,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Tag
} from 'lucide-react';

interface ClosedCyclesViewProps {
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  onDeleteTrade?: (id: string) => void;
}

export interface CycleExecutionPhase {
  id: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
  fees: number;
  notes?: string;
  phaseNumber: number;
}

export interface EnrichedClosedCycle extends ClosedTrade {
  buyPhases: CycleExecutionPhase[];
  sellPhases: CycleExecutionPhase[];
  totalBuyShares: number;
  totalSellShares: number;
  weightedAvgBuyPrice: number;
  weightedAvgSellPrice: number;
  grossOutlay: number;
  grossProceeds: number;
  netProceeds: number;
  netOutlay: number;
}

export const ClosedCyclesView: React.FC<ClosedCyclesViewProps> = ({
  closedTrades,
  transactions,
  onDeleteTrade,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BREAKEVEN'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'pnl_desc' | 'pnl_asc' | 'pct_desc' | 'holding'>('date');
  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(new Set());

  const changeOutcomeFilter = (next: 'ALL' | 'WIN' | 'LOSS' | 'BREAKEVEN') => {
    if (next === outcomeFilter) return;
    runVisualTransition('closed-filter', () => setOutcomeFilter(next));
  };

  const changeSortBy = (next: typeof sortBy) => {
    if (next === sortBy) return;
    runVisualTransition('closed-filter', () => setSortBy(next));
  };

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const toggleExpand = (id: string) => {
    setExpandedCycleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpandAll = (expand: boolean, allIds: string[]) => {
    if (expand) {
      setExpandedCycleIds(new Set(allIds));
    } else {
      setExpandedCycleIds(new Set());
    }
  };

  // Associate individual transaction execution legs to each closed trade cycle
  const enrichedCycles: EnrichedClosedCycle[] = useMemo(() => {
    return closedTrades.map((ct) => {
      const tickerUpper = ct.ticker.toUpperCase();

      // Find matching buy transactions
      const buyTime = new Date(ct.buyDate).getTime();
      const sellTime = new Date(ct.sellDate).getTime();

      const matchingBuys = transactions.filter((t) => {
        if (t.type !== 'BUY') return false;
        if (t.ticker.toUpperCase() !== tickerUpper) return false;
        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;
        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;
        // Bounded date fallback: lot purchased between cycle buyDate and sellDate
        const tTime = new Date(t.date).getTime();
        return tTime >= buyTime - 86400000 && tTime <= sellTime;
      });

      // Find matching sell transactions
      const matchingSells = transactions.filter((t) => {
        if (t.type !== 'SELL') return false;
        if (t.ticker.toUpperCase() !== tickerUpper) return false;
        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;
        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;
        // Bounded date fallback: within 1 day of sell date
        return Math.abs(new Date(t.date).getTime() - sellTime) <= 86400000;
      });

      // Build buy phases
      const buyPhases: CycleExecutionPhase[] = matchingBuys.map((t, idx) => ({
        id: t.id,
        type: 'BUY',
        shares: t.shares,
        price: t.price,
        date: t.date,
        fees: t.fees || 0,
        notes: t.notes,
        phaseNumber: idx + 1,
      }));

      // Build sell phases
      const sellPhases: CycleExecutionPhase[] = matchingSells.map((t, idx) => ({
        id: t.id,
        type: 'SELL',
        shares: t.shares,
        price: t.price,
        date: t.date,
        fees: t.fees || 0,
        notes: t.notes,
        phaseNumber: idx + 1,
      }));

      // Calculate weighted averages
      const totalBuyShares = buyPhases.length > 0
        ? buyPhases.reduce((acc, p) => acc + p.shares, 0)
        : ct.shares;

      const grossBuyCost = buyPhases.length > 0
        ? buyPhases.reduce((acc, p) => acc + p.shares * p.price, 0)
        : ct.shares * ct.buyPrice;

      const totalBuyFees = buyPhases.length > 0
        ? buyPhases.reduce((acc, p) => acc + p.fees, 0)
        : (ct.buyFees || 0);

      const weightedAvgBuyPrice = totalBuyShares > 0 ? grossBuyCost / totalBuyShares : ct.buyPrice;

      const totalSellShares = sellPhases.length > 0
        ? sellPhases.reduce((acc, p) => acc + p.shares, 0)
        : ct.shares;

      const grossSellProceeds = sellPhases.length > 0
        ? sellPhases.reduce((acc, p) => acc + p.shares * p.price, 0)
        : ct.shares * ct.sellPrice;

      const totalSellFees = sellPhases.length > 0
        ? sellPhases.reduce((acc, p) => acc + p.fees, 0)
        : (ct.sellFees || 0);

      const weightedAvgSellPrice = totalSellShares > 0 ? grossSellProceeds / totalSellShares : ct.sellPrice;

      const netProceeds = grossSellProceeds - totalSellFees;
      const netOutlay = grossBuyCost + totalBuyFees;

      return {
        ...ct,
        buyPrice: Number(weightedAvgBuyPrice.toFixed(4)),
        sellPrice: Number(weightedAvgSellPrice.toFixed(4)),
        buyPhases,
        sellPhases,
        totalBuyShares,
        totalSellShares,
        weightedAvgBuyPrice: Number(weightedAvgBuyPrice.toFixed(4)),
        weightedAvgSellPrice: Number(weightedAvgSellPrice.toFixed(4)),
        grossOutlay: grossBuyCost,
        grossProceeds: grossSellProceeds,
        netProceeds,
        netOutlay,
      };
    });
  }, [closedTrades, transactions]);

  // Overall Statistics for Closed Cycles
  const summary = useMemo(() => {
    const performance = calculatePerformanceStats(enrichedCycles);
    const totalRealizedPnl = enrichedCycles.reduce((acc, c) => acc + c.realizedPnlEgp, 0);
    const totalFees = enrichedCycles.reduce((acc, c) => acc + (c.totalFees || 0), 0);

    const multiPhaseCount = enrichedCycles.filter(
      (c) => c.sellPhases.length > 1 || c.buyPhases.length > 1
    ).length;

    return {
      totalCount: performance.totalTrades,
      winCount: performance.winningTrades,
      lossCount: performance.losingTrades,
      breakevenCount: performance.breakevenTrades,
      totalRealizedPnl,
      profitFactor: performance.profitFactor,
      winRate: performance.winRate,
      avgReturnPct: performance.avgReturnPercent ?? 0,
      avgHoldingDays: Math.round(performance.avgHoldDays ?? 0),
      totalFees,
      multiPhaseCount,
    };
  }, [enrichedCycles]);

  // Filter & Sort
  const filteredCycles = useMemo(() => {
    return enrichedCycles
      .filter((cycle) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          cycle.ticker.toLowerCase().includes(q) ||
          cycle.companyName.toLowerCase().includes(q) ||
          (cycle.cycleTag && cycle.cycleTag.toLowerCase().includes(q)) ||
          (cycle.notes && cycle.notes.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        if (outcomeFilter === 'WIN') return cycle.outcome === 'WIN';
        if (outcomeFilter === 'LOSS') return cycle.outcome === 'LOSS';
        if (outcomeFilter === 'BREAKEVEN') return cycle.outcome === 'BREAKEVEN';

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pnl_desc') return b.realizedPnlEgp - a.realizedPnlEgp;
        if (sortBy === 'pnl_asc') return a.realizedPnlEgp - b.realizedPnlEgp;
        if (sortBy === 'pct_desc') return b.realizedPnlPercent - a.realizedPnlPercent;
        if (sortBy === 'holding') return b.holdingDays - a.holdingDays;
        // Default: date desc
        return new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime();
      });
  }, [enrichedCycles, searchQuery, outcomeFilter, sortBy]);

  const hasClosedCycles = enrichedCycles.length > 0;
  const hasActiveFilters = searchQuery.trim().length > 0 || outcomeFilter !== 'ALL';
  const allVisibleExpanded =
    filteredCycles.length > 0 &&
    filteredCycles.every((cycle) => expandedCycleIds.has(cycle.id));
  const realizedPnlState =
    summary.totalRealizedPnl > 0 ? 'WIN' : summary.totalRealizedPnl < 0 ? 'LOSS' : 'BREAKEVEN';
  const avgReturnState =
    summary.avgReturnPct > 0 ? 'WIN' : summary.avgReturnPct < 0 ? 'LOSS' : 'BREAKEVEN';

  const handleDelete = (cycle: EnrichedClosedCycle) => {
    if (!onDeleteTrade) return;
    onDeleteTrade(cycle.id);
  };

  return (
    <section
      className="premium-hierarchy-h0 premium-dense-workflow premium-flow-related"
      data-hierarchy="h0"
      data-page="closed-cycles"
    >
      {/* Header Banner */}
      <div className="premium-hierarchy-h2 premium-dense-summary premium-pad-h2 premium-gap-control flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl" data-hierarchy="h2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="premium-type-section-title flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-400" />
              Closed Trade Cycles
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {summary.totalCount} Completed Cycles
            </span>
          </div>
          <p className="premium-type-helper mt-1">
            Consolidated cycle views combining multi-phase executions (e.g. CANA, TAQA) into weighted average buy &amp; sell prices.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="premium-chip px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>{summary.multiPhaseCount}</strong> cycles with phased executions
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Realized P&L */}
        <div
          className={`premium-card premium-semantic-card premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl ${
            realizedPnlState === 'WIN'
              ? 'premium-glow-win'
              : realizedPnlState === 'LOSS'
                ? 'premium-glow-loss'
                : 'premium-glow-breakeven'
          }`}
          data-hierarchy="h3"
        >
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Net Realized P&amp;L</span>
            <DollarSign
              className={`w-3.5 h-3.5 ${
                realizedPnlState === 'WIN'
                  ? 'text-emerald-400'
                  : realizedPnlState === 'LOSS'
                    ? 'text-rose-400'
                    : 'text-amber-400'
              }`}
            />
          </div>
          <div
            className={`premium-type-metric premium-type-metric-secondary mt-2 truncate font-mono ${
              realizedPnlState === 'WIN'
                ? 'text-emerald-400'
                : realizedPnlState === 'LOSS'
                  ? 'text-rose-400'
                  : 'text-amber-400'
            }`}
          >
            {summary.totalRealizedPnl > 0 ? '+' : ''}
            {formatEgp(summary.totalRealizedPnl)}
          </div>
          <div className="premium-type-metadata mt-0.5">EGP net after fees</div>
        </div>

        {/* Win Rate */}
        <div className="premium-card premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl">
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="premium-type-metric premium-type-metric-secondary mt-2 font-mono text-white">
            {summary.winRate === null ? 'N/A' : `${summary.winRate.toFixed(1)}%`}
          </div>
          <div className="premium-type-metadata mt-0.5">
            {summary.winCount}W / {summary.lossCount}L / {summary.breakevenCount}BE
          </div>
        </div>

        {/* Profit Factor */}
        <div className="premium-card premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl">
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Profit Factor</span>
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="premium-type-metric premium-type-metric-secondary mt-2 font-mono text-purple-300">
            {summary.profitFactor === null ? 'N/A' : Number.isFinite(summary.profitFactor) ? summary.profitFactor.toFixed(2) : '∞'}
          </div>
          <div className="premium-type-metadata mt-0.5">Wins / Gross Losses</div>
        </div>

        {/* Average Return per Cycle */}
        <div
          className={`premium-card premium-semantic-card premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl ${
            avgReturnState === 'WIN'
              ? 'premium-glow-win'
              : avgReturnState === 'LOSS'
                ? 'premium-glow-loss'
                : 'premium-glow-breakeven'
          }`}
          data-hierarchy="h3"
        >
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Avg Return / Cycle</span>
            <ArrowUpDown
              className={`w-3.5 h-3.5 ${
                avgReturnState === 'WIN'
                  ? 'text-emerald-400'
                  : avgReturnState === 'LOSS'
                    ? 'text-rose-400'
                    : 'text-amber-400'
              }`}
            />
          </div>
          <div
            className={`premium-type-metric premium-type-metric-secondary mt-2 truncate font-mono ${
              avgReturnState === 'WIN'
                ? 'text-emerald-400'
                : avgReturnState === 'LOSS'
                  ? 'text-rose-400'
                  : 'text-amber-400'
            }`}
          >
            {summary.avgReturnPct > 0 ? '+' : ''}
            {summary.avgReturnPct.toFixed(2)}%
          </div>
          <div className="premium-type-metadata mt-0.5">Mean cycle gain</div>
        </div>

        {/* Average Holding Days */}
        <div className="premium-card premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl">
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Avg Hold Duration</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="premium-type-metric premium-type-metric-secondary mt-2 font-mono text-cyan-300">
            {summary.avgHoldingDays} days
          </div>
          <div className="premium-type-metadata mt-0.5">First buy to exit</div>
        </div>

        {/* Total Brokerage Fees */}
        <div
          className="premium-card premium-semantic-card premium-glow-breakeven premium-hierarchy-h3 premium-dense-summary-card premium-pad-h3 rounded-2xl"
          data-hierarchy="h3"
        >
          <div className="premium-type-metric-label flex items-center justify-between">
            <span>Cycle Fees Paid</span>
            <Receipt className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="premium-type-metric premium-type-metric-secondary mt-2 font-mono text-amber-300">
            {formatEgp(summary.totalFees)}
          </div>
          <div className="premium-type-metadata mt-0.5">EGP commissions</div>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="premium-panel premium-hierarchy-h4 premium-dense-toolbar premium-pad-h4 premium-gap-control rounded-2xl flex flex-col md:flex-row md:items-center justify-between" data-hierarchy="h4">
        {/* Search Bar */}
        <div className="relative w-full min-w-0 flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-closed-cycles"
            type="text"
            placeholder="Search by ticker, cycle tag (e.g. CANA, TAQA), company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="premium-field premium-dense-search w-full pl-9 pr-4 py-2 rounded-xl text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="premium-action premium-action-priority-utility absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-[10px]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters and Sorting */}
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
          {/* Outcome Filter Pills */}
          <div className="premium-selector-shell flex w-full items-center gap-1 overflow-x-auto overscroll-x-contain scrollbar-none sm:w-auto sm:flex-wrap sm:overflow-visible">
            <button
              type="button"
              aria-pressed={outcomeFilter === 'ALL'}
              onClick={() => changeOutcomeFilter('ALL')}
              className={`premium-filter-pill premium-compact-selector shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${outcomeFilter === 'ALL' ? 'premium-filter-active-neutral' : ''}`}
            >
              All ({enrichedCycles.length})
            </button>
            <button
              type="button"
              aria-pressed={outcomeFilter === 'WIN'}
              onClick={() => changeOutcomeFilter('WIN')}
              className={`premium-filter-pill premium-compact-selector shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${outcomeFilter === 'WIN' ? 'premium-filter-active-emerald' : ''}`}
            >
              Wins ({summary.winCount})
            </button>
            <button
              type="button"
              aria-pressed={outcomeFilter === 'LOSS'}
              onClick={() => changeOutcomeFilter('LOSS')}
              className={`premium-filter-pill premium-compact-selector shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${outcomeFilter === 'LOSS' ? 'premium-filter-active-rose' : ''}`}
            >
              Losses ({summary.lossCount})
            </button>
            <button
              type="button"
              aria-pressed={outcomeFilter === 'BREAKEVEN'}
              onClick={() => changeOutcomeFilter('BREAKEVEN')}
              className={`premium-filter-pill premium-compact-selector shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${outcomeFilter === 'BREAKEVEN' ? 'premium-filter-active-amber' : ''}`}
            >
              BE ({summary.breakevenCount})
            </button>
          </div>

          {/* Sort Selector */}
          <AnalyticsSelect
            value={sortBy}
            onChange={(value) => changeSortBy(value as typeof sortBy)}
            compact
            accent="purple"
            ariaLabel="Sort closed cycles"
            className="w-full min-w-0 sm:w-auto sm:min-w-[205px]"
            options={[
              { value: 'date', label: 'Sort: Exit Date (Newest)' },
              { value: 'pnl_desc', label: 'Sort: Highest P&L (EGP)' },
              { value: 'pnl_asc', label: 'Sort: Lowest P&L (EGP)' },
              { value: 'pct_desc', label: 'Sort: Highest Return (%)' },
              { value: 'holding', label: 'Sort: Longest Holding' },
            ]}
          />

          {/* Expand / Collapse All */}
          <button
            onClick={() =>
              toggleExpandAll(
                !allVisibleExpanded,
                filteredCycles.map((c) => c.id)
              )
            }
            disabled={filteredCycles.length === 0}
            className="premium-action premium-action-priority-secondary w-full justify-center px-3 py-1.5 rounded-xl text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {allVisibleExpanded ? 'Collapse All' : 'Expand All Phases'}
          </button>
        </div>
      </div>

      {/* Closed Cycles List */}
      <MotionSwap motionKey={`${outcomeFilter}-${sortBy}`} variant="state" className="premium-closed-results premium-flow-control">
        {filteredCycles.map((cycle) => {
          const isExpanded = expandedCycleIds.has(cycle.id);
          const isWin = cycle.outcome === 'WIN';
          const isLoss = cycle.outcome === 'LOSS';
          const hasMultiplePhases = cycle.sellPhases.length > 1 || cycle.buyPhases.length > 1;

          return (
            <div
              key={cycle.id}
              data-hierarchy="h5"
              className={`premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row premium-pad-h5 rounded-2xl border ${
                isWin
                  ? 'premium-glow-win'
                  : isLoss
                  ? 'premium-glow-loss'
                  : 'premium-glow-breakeven'
              }`}
            >
              {/* Top Row: Header & Performance Badges */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                <div className="flex items-center gap-3">
                  <StockLogo
                    ticker={cycle.ticker}
                    companyName={cycle.companyName}
                    sector={cycle.sector}
                    size="lg"
                  />

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="premium-type-metric-dense text-white">{cycle.ticker}</span>
                      {cycle.cycleTag && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {cycle.cycleTag}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          isWin
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isLoss
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isWin ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : isLoss ? (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-amber-400" />
                        )}
                        {cycle.outcome}
                      </span>

                      {hasMultiplePhases && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                          {cycle.sellPhases.length > 1 ? `${cycle.sellPhases.length} Sell Phases` : ''}
                          {cycle.sellPhases.length > 1 && cycle.buyPhases.length > 1 ? ' & ' : ''}
                          {cycle.buyPhases.length > 1 ? `${cycle.buyPhases.length} Buy Phases` : ''}
                        </span>
                      )}
                    </div>
                    <p className="premium-type-helper mt-0.5">
                      {cycle.companyName} • <span className="premium-type-metadata">{cycle.sector}</span>
                    </p>
                  </div>
                </div>

                {/* Realized Gains & Delete Action */}
                <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                  <div className="text-left sm:text-right">
                    <div
                      className={`premium-type-metric premium-type-metric-dense font-mono flex items-center gap-1 sm:justify-end ${
                        isWin
                          ? 'text-emerald-400'
                          : isLoss
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {cycle.realizedPnlEgp > 0 ? '+' : ''}
                      {formatEgp(cycle.realizedPnlEgp)} <span className="premium-type-unit">EGP</span>
                    </div>
                    <div
                      className={`text-xs font-bold flex items-center gap-1 sm:justify-end ${
                        isWin
                          ? 'text-emerald-500'
                          : isLoss
                          ? 'text-rose-500'
                          : 'text-amber-500'
                      }`}
                    >
                      {isWin ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : isLoss ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {cycle.realizedPnlPercent > 0 ? '+' : ''}
                        {cycle.realizedPnlPercent.toFixed(2)}% Net Return
                      </span>
                    </div>
                  </div>

                  {onDeleteTrade && (
                    <button
                      onClick={() => handleDelete(cycle)}
                      aria-label={`Delete ${cycle.ticker} closed cycle`}
                      title="Delete this closed cycle"
                      className="premium-icon-action premium-icon-delete flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 sm:h-9 sm:w-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Core Averaged Prices & Execution Metrics (User Requested Highlight) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 py-3.5 text-xs">
                {/* Total Shares */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Total Cycle Shares</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-white">
                    {cycle.shares.toLocaleString()}
                  </span>
                  <span className="premium-type-metadata block">shares completed</span>
                </div>

                {/* Average Buying Price */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Avg. Buying Price</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-blue-400">
                    {formatEgp(cycle.weightedAvgBuyPrice)} EGP
                  </span>
                  <span className="premium-type-metadata block">
                    {cycle.buyPhases.length > 1 ? `${cycle.buyPhases.length} Buy Lots Avg` : 'Entry lot'}
                  </span>
                </div>

                {/* Average Selling Price */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Avg. Selling Price</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-purple-400">
                    {formatEgp(cycle.weightedAvgSellPrice)} EGP
                  </span>
                  <span className="premium-type-metadata block">
                    {cycle.sellPhases.length > 1 ? `${cycle.sellPhases.length} Phases Avg` : 'Exit lot'}
                  </span>
                </div>

                {/* Capital Outlay */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Total Invested Outlay</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-slate-200">
                    {formatEgp(cycle.netOutlay)} EGP
                  </span>
                  <span className="premium-type-metadata block">Cost basis + fees</span>
                </div>

                {/* Total Net Proceeds */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Net Realized Proceeds</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-cyan-300">
                    {formatEgp(cycle.netProceeds)} EGP
                  </span>
                  <span className="premium-type-metadata block">After sell fees</span>
                </div>

                {/* Cycle Duration & Dates */}
                <div className="premium-subpanel premium-hierarchy-h4 p-2.5 rounded-xl" data-hierarchy="h4">
                  <span className="premium-type-metric-label block">Cycle Duration</span>
                  <span className="premium-type-metric premium-type-metric-dense font-mono text-cyan-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {cycle.holdingDays} days
                  </span>
                  <span className="premium-type-metadata block truncate font-mono">
                    {formatDateDDMMYYYY(cycle.buyDate)} → {formatDateDDMMYYYY(cycle.sellDate)}
                  </span>
                </div>
              </div>

              {/* Execution Phases Accordion Toggle */}
              <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => toggleExpand(cycle.id)}
                  className="premium-accordion-trigger flex w-full min-w-0 items-center justify-between gap-1.5 text-left text-xs font-semibold text-purple-400 hover:text-purple-300 sm:w-auto sm:justify-start"
                >
                  <ChevronDown className={`premium-motion-chevron w-4 h-4 ${isExpanded ? 'rotate-180' : ''}`} />
                  <span>
                    {isExpanded ? 'Hide' : 'View'} Execution Phases &amp; Leg Breakdown (
                    {cycle.buyPhases.length} Buy / {cycle.sellPhases.length} Sell phases)
                  </span>
                </button>

                {cycle.notes && (
                  <div className="premium-type-helper w-full max-w-full truncate italic sm:max-w-sm sm:text-right">
                    &ldquo;{cycle.notes}&rdquo;
                  </div>
                )}
              </div>

              {/* Expanded Multi-Phase Execution Breakdown */}
              <ExpandPresence isOpen={isExpanded} className="mt-3.5">
                <div className="premium-inset-glass premium-hierarchy-h4 p-3.5 rounded-xl space-y-3" data-hierarchy="h4">
                  <div className="flex flex-col gap-2 border-b border-slate-800 pb-2 text-xs font-semibold text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      Multi-Phase Order Execution Details
                    </span>
                    <span className="premium-type-metadata sm:text-right">
                      Total Brokerage Commission:{' '}
                      <strong className="text-amber-400 font-mono font-bold">
                        {formatEgp(cycle.totalFees || 0)} EGP
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Buy Phases Column */}
                    <div className="space-y-2">
                      <div className="premium-type-metric-label font-bold text-blue-400 flex items-center justify-between">
                        <span>BUY INFLOW PHASES ({cycle.buyPhases.length})</span>
                        <span className="font-mono text-slate-400 font-normal">
                          Avg: {formatEgp(cycle.weightedAvgBuyPrice)} EGP
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {cycle.buyPhases.map((phase) => (
                          <div
                            key={phase.id}
                            className="premium-inset-glass flex flex-col items-start gap-1.5 rounded-lg p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                          >
                            <div>
                              <span className="text-blue-400 font-bold mr-2">Phase #{phase.phaseNumber}</span>
                              <span className="text-white font-bold">{phase.shares.toLocaleString()} shs</span>
                              <span className="text-slate-400 mx-1">@</span>
                              <span className="text-blue-300 font-bold">{formatEgp(phase.price)} EGP</span>
                            </div>
                            <div className="premium-type-metadata w-full text-left sm:w-auto sm:text-right">
                              <div className="font-mono text-slate-300">{formatDateDDMMYYYY(phase.date)}</div>
                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}
                            </div>
                          </div>
                        ))}

                        {cycle.buyPhases.length === 0 && (
                          <div className="premium-inset-glass premium-type-helper p-2 rounded-lg text-slate-500 italic">
                            Initial position entry: {cycle.shares} shares @ {formatEgp(cycle.buyPrice)} EGP on{' '}
                            {formatDateDDMMYYYY(cycle.buyDate)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sell Phases Column */}
                    <div className="space-y-2">
                      <div className="premium-type-metric-label font-bold text-purple-400 flex items-center justify-between">
                        <span>SELL OUTFLOW PHASES ({cycle.sellPhases.length})</span>
                        <span className="font-mono text-slate-400 font-normal">
                          Avg: {formatEgp(cycle.weightedAvgSellPrice)} EGP
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {cycle.sellPhases.map((phase) => (
                          <div
                            key={phase.id}
                            className="premium-inset-glass flex flex-col items-start gap-1.5 rounded-lg p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                          >
                            <div>
                              <span className="text-purple-400 font-bold mr-2">Phase #{phase.phaseNumber}</span>
                              <span className="text-white font-bold">{phase.shares.toLocaleString()} shs</span>
                              <span className="text-slate-400 mx-1">@</span>
                              <span className="text-purple-300 font-bold">{formatEgp(phase.price)} EGP</span>
                            </div>
                            <div className="premium-type-metadata w-full text-left sm:w-auto sm:text-right">
                              <div className="font-mono text-slate-300">{formatDateDDMMYYYY(phase.date)}</div>
                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}
                            </div>
                          </div>
                        ))}

                        {cycle.sellPhases.length === 0 && (
                          <div className="premium-inset-glass premium-type-helper p-2 rounded-lg text-slate-500 italic">
                            Single exit order: {cycle.shares} shares @ {formatEgp(cycle.sellPrice)} EGP on{' '}
                            {formatDateDDMMYYYY(cycle.sellDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ExpandPresence>
            </div>
          );
        })}

        {filteredCycles.length === 0 && (
          <div
            className="premium-subpanel premium-hierarchy-h4 premium-flow-control rounded-2xl border-dashed py-12 text-center text-xs text-slate-400"
            data-hierarchy="h4"
          >
            <RotateCcw className="mx-auto mb-1 h-8 w-8 text-slate-600" />
            <div>
              <p className="font-semibold text-slate-300">
                {hasClosedCycles ? 'No closed cycles match your filters.' : 'No closed cycles yet.'}
              </p>
              <p className="mt-0.5 text-slate-500">
                {hasClosedCycles
                  ? 'Clear your search or adjust the outcome filter to see closed trade cycles.'
                  : 'Completed cycles will appear here after a position is fully exited.'}
              </p>
            </div>
            {hasClosedCycles && hasActiveFilters && (
              <div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    changeOutcomeFilter('ALL');
                  }}
                  className="premium-action premium-action-priority-secondary px-4 py-2 rounded-xl font-semibold text-xs"
                >
                  Clear All Filters &amp; Show All ({enrichedCycles.length})
                </button>
              </div>
            )}
          </div>
        )}
      </MotionSwap>
    </section>
  );
};
