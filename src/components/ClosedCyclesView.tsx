import React, { useState, useMemo } from 'react';
import { ClosedTrade, TradeTransaction, Sector } from '../types';
import { StockLogo } from './StockLogo';
import { formatDateDDMMYYYY, formatDateVerbose } from '../utils/dateUtils';
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
  ChevronUp,
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
    const totalCount = enrichedCycles.length;
    const winTrades = enrichedCycles.filter((c) => c.outcome === 'WIN');
    const lossTrades = enrichedCycles.filter((c) => c.outcome === 'LOSS');
    const breakevenTrades = enrichedCycles.filter((c) => c.outcome === 'BREAKEVEN');

    const totalRealizedPnl = enrichedCycles.reduce((acc, c) => acc + c.realizedPnlEgp, 0);
    const totalWinningPnl = winTrades.reduce((acc, c) => acc + c.realizedPnlEgp, 0);
    const totalLosingPnl = Math.abs(lossTrades.reduce((acc, c) => acc + c.realizedPnlEgp, 0));
    const profitFactor = totalLosingPnl > 0 ? totalWinningPnl / totalLosingPnl : totalWinningPnl > 0 ? 9.99 : 1.0;

    const winRate = totalCount > 0 ? (winTrades.length / totalCount) * 100 : 0;
    const avgReturnPct = totalCount > 0 ? enrichedCycles.reduce((acc, c) => acc + c.realizedPnlPercent, 0) / totalCount : 0;
    const avgHoldingDays = totalCount > 0 ? Math.round(enrichedCycles.reduce((acc, c) => acc + c.holdingDays, 0) / totalCount) : 0;
    const totalFees = enrichedCycles.reduce((acc, c) => acc + (c.totalFees || 0), 0);

    const multiPhaseCount = enrichedCycles.filter(
      (c) => c.sellPhases.length > 1 || c.buyPhases.length > 1
    ).length;

    return {
      totalCount,
      winCount: winTrades.length,
      lossCount: lossTrades.length,
      breakevenCount: breakevenTrades.length,
      totalRealizedPnl,
      profitFactor,
      winRate,
      avgReturnPct,
      avgHoldingDays,
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

  const handleDelete = (cycle: EnrichedClosedCycle) => {
    if (!onDeleteTrade) return;
    onDeleteTrade(cycle.id);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-400" />
              Closed Trade Cycles
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {summary.totalCount} Completed Cycles
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Consolidated cycle views combining multi-phase executions (e.g. CANA, TAQA) into weighted average buy &amp; sell prices.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{summary.multiPhaseCount}</strong> cycles with phased executions
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Realized P&L */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Net Realized P&amp;L</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div
            className={`mt-2 text-lg font-black font-mono truncate ${
              summary.totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.totalRealizedPnl >= 0 ? '+' : ''}
            {formatEgp(summary.totalRealizedPnl)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">EGP net after fees</div>
        </div>

        {/* Win Rate */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-2 text-lg font-black font-mono text-white">
            {summary.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {summary.winCount}W / {summary.lossCount}L / {summary.breakevenCount}BE
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Profit Factor</span>
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2 text-lg font-black font-mono text-purple-300">
            {summary.profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Wins / Gross Losses</div>
        </div>

        {/* Average Return per Cycle */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Avg Return / Cycle</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div
            className={`mt-2 text-lg font-black font-mono truncate ${
              summary.avgReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.avgReturnPct >= 0 ? '+' : ''}
            {summary.avgReturnPct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Mean cycle gain</div>
        </div>

        {/* Average Holding Days */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Avg Hold Duration</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-lg font-black font-mono text-amber-300">
            {summary.avgHoldingDays} days
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">First buy to exit</div>
        </div>

        {/* Total Brokerage Fees */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Cycle Fees Paid</span>
            <Receipt className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 text-lg font-black font-mono text-rose-300">
            {formatEgp(summary.totalFees)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">EGP commissions</div>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-closed-cycles"
            type="text"
            placeholder="Search by ticker, cycle tag (e.g. CANA, TAQA), company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-400 text-xs border border-slate-700 focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters and Sorting */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Outcome Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setOutcomeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                outcomeFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({enrichedCycles.length})
            </button>
            <button
              onClick={() => setOutcomeFilter('WIN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                outcomeFilter === 'WIN'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Wins ({summary.winCount})
            </button>
            <button
              onClick={() => setOutcomeFilter('LOSS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                outcomeFilter === 'LOSS'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Losses ({summary.lossCount})
            </button>
            <button
              onClick={() => setOutcomeFilter('BREAKEVEN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                outcomeFilter === 'BREAKEVEN'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              BE ({summary.breakevenCount})
            </button>
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs border border-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="date">Sort: Exit Date (Newest)</option>
            <option value="pnl_desc">Sort: Highest P&amp;L (EGP)</option>
            <option value="pnl_asc">Sort: Lowest P&amp;L (EGP)</option>
            <option value="pct_desc">Sort: Highest Return (%)</option>
            <option value="holding">Sort: Longest Holding</option>
          </select>

          {/* Expand / Collapse All */}
          <button
            onClick={() =>
              toggleExpandAll(
                expandedCycleIds.size < filteredCycles.length,
                filteredCycles.map((c) => c.id)
              )
            }
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            {expandedCycleIds.size < filteredCycles.length ? 'Expand All Phases' : 'Collapse All'}
          </button>
        </div>
      </div>

      {/* Closed Cycles List */}
      <div className="space-y-3.5">
        {filteredCycles.map((cycle) => {
          const isExpanded = expandedCycleIds.has(cycle.id);
          const isWin = cycle.outcome === 'WIN';
          const isLoss = cycle.outcome === 'LOSS';
          const isBreakeven = cycle.outcome === 'BREAKEVEN';
          const hasMultiplePhases = cycle.sellPhases.length > 1 || cycle.buyPhases.length > 1;

          return (
            <div
              key={cycle.id}
              className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition-all ${
                isWin
                  ? 'border-emerald-500/20 hover:border-emerald-500/40'
                  : isLoss
                  ? 'border-rose-500/20 hover:border-rose-500/40'
                  : 'border-slate-800 hover:border-slate-700'
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
                      <span className="font-bold text-white text-base">{cycle.ticker}</span>
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
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cycle.companyName} • <span className="text-slate-500">{cycle.sector}</span>
                    </p>
                  </div>
                </div>

                {/* Realized Gains & Delete Action */}
                <div className="flex items-center gap-4 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <div
                      className={`text-lg font-black font-mono flex items-center gap-1 sm:justify-end ${
                        isWin
                          ? 'text-emerald-400'
                          : isLoss
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {cycle.realizedPnlEgp >= 0 ? '+' : ''}
                      {formatEgp(cycle.realizedPnlEgp)} EGP
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
                        {cycle.realizedPnlPercent >= 0 ? '+' : ''}
                        {cycle.realizedPnlPercent.toFixed(2)}% Net Return
                      </span>
                    </div>
                  </div>

                  {onDeleteTrade && (
                    <button
                      onClick={() => handleDelete(cycle)}
                      title="Delete this closed cycle"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Core Averaged Prices & Execution Metrics (User Requested Highlight) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 py-3.5 text-xs">
                {/* Total Shares */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Total Cycle Shares</span>
                  <span className="font-mono text-white font-bold text-sm">
                    {cycle.shares.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block">shares completed</span>
                </div>

                {/* Average Buying Price */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Avg. Buying Price</span>
                  <span className="font-mono text-blue-400 font-bold text-sm">
                    {formatEgp(cycle.weightedAvgBuyPrice)} EGP
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {cycle.buyPhases.length > 1 ? `${cycle.buyPhases.length} Buy Lots Avg` : 'Entry lot'}
                  </span>
                </div>

                {/* Average Selling Price */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Avg. Selling Price</span>
                  <span className="font-mono text-purple-400 font-bold text-sm">
                    {formatEgp(cycle.weightedAvgSellPrice)} EGP
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {cycle.sellPhases.length > 1 ? `${cycle.sellPhases.length} Phases Avg` : 'Exit lot'}
                  </span>
                </div>

                {/* Capital Outlay */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Total Invested Outlay</span>
                  <span className="font-mono text-slate-200 font-semibold text-sm">
                    {formatEgp(cycle.netOutlay)} EGP
                  </span>
                  <span className="text-[10px] text-slate-500 block">Cost basis + fees</span>
                </div>

                {/* Total Net Proceeds */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Net Realized Proceeds</span>
                  <span className="font-mono text-emerald-400 font-semibold text-sm">
                    {formatEgp(cycle.netProceeds)} EGP
                  </span>
                  <span className="text-[10px] text-slate-500 block">After sell fees</span>
                </div>

                {/* Cycle Duration & Dates */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-medium block">Cycle Duration</span>
                  <span className="font-mono text-amber-300 font-bold text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {cycle.holdingDays} days
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate font-mono">
                    {formatDateDDMMYYYY(cycle.buyDate)} → {formatDateDDMMYYYY(cycle.sellDate)}
                  </span>
                </div>
              </div>

              {/* Execution Phases Accordion Toggle */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(cycle.id)}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold transition"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>
                    {isExpanded ? 'Hide' : 'View'} Execution Phases &amp; Leg Breakdown (
                    {cycle.buyPhases.length} Buy / {cycle.sellPhases.length} Sell phases)
                  </span>
                </button>

                {cycle.notes && (
                  <div className="text-[11px] text-slate-400 italic truncate max-w-sm">
                    &ldquo;{cycle.notes}&rdquo;
                  </div>
                )}
              </div>

              {/* Expanded Multi-Phase Execution Breakdown */}
              {isExpanded && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      Multi-Phase Order Execution Details
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Total Brokerage Commission:{' '}
                      <strong className="text-amber-400 font-mono font-bold">
                        {formatEgp(cycle.totalFees || 0)} EGP
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Buy Phases Column */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                        <span>BUY INFLOW PHASES ({cycle.buyPhases.length})</span>
                        <span className="font-mono text-slate-400 font-normal">
                          Avg: {formatEgp(cycle.weightedAvgBuyPrice)} EGP
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {cycle.buyPhases.map((phase) => (
                          <div
                            key={phase.id}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="text-blue-400 font-bold mr-2">Phase #{phase.phaseNumber}</span>
                              <span className="text-white font-bold">{phase.shares.toLocaleString()} shs</span>
                              <span className="text-slate-400 mx-1">@</span>
                              <span className="text-blue-300 font-bold">{formatEgp(phase.price)} EGP</span>
                            </div>
                            <div className="text-right text-[10px] text-slate-400">
                              <div className="font-mono text-slate-300">{formatDateDDMMYYYY(phase.date)}</div>
                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}
                            </div>
                          </div>
                        ))}

                        {cycle.buyPhases.length === 0 && (
                          <div className="p-2 rounded-lg bg-slate-900 text-slate-500 text-[11px] italic">
                            Initial position entry: {cycle.shares} shares @ {formatEgp(cycle.buyPrice)} EGP on{' '}
                            {formatDateDDMMYYYY(cycle.buyDate)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sell Phases Column */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-purple-400 flex items-center justify-between">
                        <span>SELL OUTFLOW PHASES ({cycle.sellPhases.length})</span>
                        <span className="font-mono text-slate-400 font-normal">
                          Avg: {formatEgp(cycle.weightedAvgSellPrice)} EGP
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        {cycle.sellPhases.map((phase) => (
                          <div
                            key={phase.id}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="text-purple-400 font-bold mr-2">Phase #{phase.phaseNumber}</span>
                              <span className="text-white font-bold">{phase.shares.toLocaleString()} shs</span>
                              <span className="text-slate-400 mx-1">@</span>
                              <span className="text-purple-300 font-bold">{formatEgp(phase.price)} EGP</span>
                            </div>
                            <div className="text-right text-[10px] text-slate-400">
                              <div className="font-mono text-slate-300">{formatDateDDMMYYYY(phase.date)}</div>
                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}
                            </div>
                          </div>
                        ))}

                        {cycle.sellPhases.length === 0 && (
                          <div className="p-2 rounded-lg bg-slate-900 text-slate-500 text-[11px] italic">
                            Single exit order: {cycle.shares} shares @ {formatEgp(cycle.sellPrice)} EGP on{' '}
                            {formatDateDDMMYYYY(cycle.sellDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredCycles.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-400 space-y-3">
            <RotateCcw className="w-8 h-8 text-slate-600 mx-auto mb-1" />
            <div>
              <p className="font-semibold text-slate-300">No closed cycles match your filters.</p>
              <p className="text-slate-500 mt-0.5">
                Clear your search or adjust the outcome filter to see closed trade cycles.
              </p>
            </div>
            {(searchQuery || outcomeFilter !== 'ALL') && (
              <div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setOutcomeFilter('ALL');
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition active:scale-95 shadow-md shadow-purple-900/30"
                >
                  Clear All Filters &amp; Show All ({enrichedCycles.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
