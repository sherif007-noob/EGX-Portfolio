import React, { useState, useMemo } from 'react';
import { runVisualTransition } from '../../utils/visualTransition';
import { MotionSwap } from '../PremiumMotion';
import { AnalyticsSelect } from '../AnalyticsSelect';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ClosedTrade, Position } from '../../types';
import { calculatePositionUnrealizedPnl } from '../../services/portfolioAccounting';
import { calculateMonthlyAuditSummary } from '../../services/monthlyAuditSummary';
import { getMonthKey, getMonthLabel, getLastDayOfMonth, dmyToIso, formatDateDDMMYYYY } from '../../utils/dateUtils';

interface MonthlyPerformanceReportProps {
  closedTrades: ClosedTrade[];
  positions: Position[];
}

type StatusFilter = 'ALL' | 'LIQUIDATED' | 'HOLDINGS';

const EGP_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (val: number) => EGP_FORMATTER.format(val);

interface MonthEndHolding {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  marketPrice: number;
  pnlEgp: number;
  pnlPercent: number;
  fees: number;
  type: 'CURRENT_OPEN' | 'HELD_AT_MONTH_END_LATER_CLOSED';
  exitDate?: string;
  notes?: string;
}

const MonthlyPerformanceReportComponent: React.FC<MonthlyPerformanceReportProps> = ({
  closedTrades,
  positions,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const changeSelectedMonth = (next: string) => {
    if (next === selectedMonth) return;
    runVisualTransition('monthly-filter', () => setSelectedMonth(next));
  };
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const changeStatusFilter = (next: StatusFilter) => {
    if (next === statusFilter) return;
    runVisualTransition('monthly-filter', () => setStatusFilter(next));
  };
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Collect all months with activity
  const allMonthsData = useMemo(() => {
    const monthKeys = new Set<string>();

    closedTrades.forEach((t) => {
      const sellKey = getMonthKey(t.sellDate);
      if (sellKey) monthKeys.add(sellKey);
      const buyKey = getMonthKey(t.buyDate);
      if (buyKey) monthKeys.add(buyKey);
    });

    positions.forEach((p) => {
      const buyKey = getMonthKey(p.buyDate);
      if (buyKey) monthKeys.add(buyKey);
    });

    const currentMonthKey = getMonthKey(new Date().toISOString());
    if (currentMonthKey) monthKeys.add(currentMonthKey);

    const sortedMonthKeys = Array.from(monthKeys).filter(Boolean).sort().reverse();

    return sortedMonthKeys.map((monthKey) => {
      const lastDayOfMonth = getLastDayOfMonth(monthKey);
      const monthLabel = getMonthLabel(monthKey, 'long');

      // 1. Trades liquidated/closed in this month
      const liquidatedTrades = closedTrades.filter(
        (t) => getMonthKey(t.sellDate) === monthKey
      );

      const wins = liquidatedTrades.filter((t) => t.outcome === 'WIN');
      const losses = liquidatedTrades.filter((t) => t.outcome === 'LOSS');
      const grossGain = wins.reduce((acc, t) => acc + (t.realizedPnlEgp > 0 ? t.realizedPnlEgp : 0), 0);
      const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.realizedPnlEgp < 0 ? t.realizedPnlEgp : 0), 0));
      const netRealized = liquidatedTrades.reduce((acc, t) => acc + (t.realizedPnlEgp || 0), 0);
      const fees = liquidatedTrades.reduce((acc, t) => {
        const tradeFees = typeof t.totalFees === 'number' && t.totalFees > 0 
          ? t.totalFees 
          : ((t.buyFees || 0) + (t.sellFees || 0));
        return acc + tradeFees;
      }, 0);
      const winRate = liquidatedTrades.length > 0 ? (wins.length / liquidatedTrades.length) * 100 : null;

      // 2. Accurate Month-End Holdings:
      // a) Positions currently active where buyDate <= lastDayOfMonth
      const currentActiveHoldings: MonthEndHolding[] = positions
        .filter((p) => {
          const buyIso = dmyToIso(p.buyDate);
          return buyIso <= lastDayOfMonth;
        })
        .map((p) => {
          const costBasis = p.shares * p.avgBuyPrice;
          const entryFees = p.totalFees || 0;
          const costBasisWithFees = costBasis + entryFees;
          const pnlEgp = calculatePositionUnrealizedPnl(p);
          const pnlPercent = costBasisWithFees > 0 ? (pnlEgp / costBasisWithFees) * 100 : 0;
          return {
            id: p.id,
            ticker: p.ticker,
            companyName: p.companyName,
            sector: p.sector,
            shares: p.shares,
            buyPrice: p.avgBuyPrice,
            buyDate: p.buyDate,
            marketPrice: p.currentPrice,
            pnlEgp,
            pnlPercent,
            fees: p.totalFees || 0,
            type: 'CURRENT_OPEN',
            notes: p.notes,
          };
        });

      // b) Closed trades that were active at month end: bought <= lastDayOfMonth AND sold > lastDayOfMonth
      const closedLaterHoldings: MonthEndHolding[] = closedTrades
        .filter((t) => {
          const buyIso = dmyToIso(t.buyDate);
          const sellIso = t.sellDate ? dmyToIso(t.sellDate) : '';
          return buyIso <= lastDayOfMonth && (!sellIso || sellIso > lastDayOfMonth);
        })
        .map((t) => {
          const tradeFees = typeof t.totalFees === 'number' && t.totalFees > 0 
            ? t.totalFees 
            : ((t.buyFees || 0) + (t.sellFees || 0));
          return {
            id: `held-${t.id}`,
            ticker: t.ticker,
            companyName: t.companyName,
            sector: t.sector,
            shares: t.shares,
            buyPrice: t.buyPrice,
            buyDate: t.buyDate,
            marketPrice: t.sellPrice,
            pnlEgp: t.realizedPnlEgp,
            pnlPercent: t.realizedPnlPercent,
            fees: tradeFees,
            type: 'HELD_AT_MONTH_END_LATER_CLOSED',
            exitDate: t.sellDate,
            notes: t.notes,
          };
        });

      const monthEndHoldings = [...currentActiveHoldings, ...closedLaterHoldings];

      return {
        monthKey,
        monthLabel,
        liquidatedTrades,
        monthEndHoldings,
        winsCount: wins.length,
        lossesCount: losses.length,
        grossGain,
        grossLoss,
        netRealized,
        fees,
        winRate,
        totalActivityCount: liquidatedTrades.length + monthEndHoldings.length,
      };
    });
  }, [closedTrades, positions]);


  // Months available for tab selector
  const availableMonths = useMemo(() => {
    return allMonthsData.filter((m) => m.totalActivityCount > 0);
  }, [allMonthsData]);

  // Filtered months to display
  const displayedMonths = useMemo(() => {
    let months = allMonthsData;
    if (selectedMonth !== 'ALL') {
      months = months.filter((m) => m.monthKey === selectedMonth);
    }
    return months;
  }, [allMonthsData, selectedMonth]);

  // Export Monthly Audit to CSV
  const handleExportCSV = (targetMonthKey?: string) => {
    const targetMonths = targetMonthKey && targetMonthKey !== 'ALL'
      ? allMonthsData.filter((m) => m.monthKey === targetMonthKey)
      : allMonthsData.filter((m) => m.totalActivityCount > 0);

    const rows: string[][] = [
      ['Monthly Performance & End-of-Month Positions Audit Report'],
      [`Export Date: ${new Date().toISOString().slice(0, 10)}`],
      [],
      ['Month', 'Holding Status', 'Ticker', 'Company Name', 'Sector', 'Shares', 'Buy Date', 'Buy Price (EGP)', 'Exit/Market Price (EGP)', 'P&L (EGP)', 'P&L (%)', 'Brokerage Fees (EGP)', 'Notes'],
    ];

    targetMonths.forEach((m) => {
      // Liquidated
      m.liquidatedTrades.forEach((t) => {
        rows.push([
          m.monthLabel,
          `Liquidated (${t.outcome}) on ${t.sellDate}`,
          t.ticker,
          t.companyName,
          t.sector,
          t.shares.toString(),
          t.buyDate,
          t.buyPrice.toFixed(2),
          t.sellPrice.toFixed(2),
          t.realizedPnlEgp.toFixed(2),
          `${t.realizedPnlPercent.toFixed(2)}%`,
          (t.totalFees || 0).toFixed(2),
          t.notes || '',
        ]);
      });

      // Month-end holdings
      m.monthEndHoldings.forEach((h) => {
        rows.push([
          m.monthLabel,
          h.type === 'CURRENT_OPEN' ? 'Active Portfolio Holding' : `Held at Month-End (Closed ${h.exitDate})`,
          h.ticker,
          h.companyName,
          h.sector,
          h.shares.toString(),
          h.buyDate,
          h.buyPrice.toFixed(2),
          h.marketPrice.toFixed(2),
          h.pnlEgp.toFixed(2),
          `${h.pnlPercent.toFixed(2)}%`,
          h.fees.toFixed(2),
          h.notes || '',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monthly_Audit_Report_${selectedMonth !== 'ALL' ? selectedMonth : 'All_Months'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="report-monthly-performance" className="premium-report-glass rounded-2xl p-4 space-y-6 sm:p-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
              REPORT 2 &bull; MONTHLY AUDIT
            </span>
            <span className="text-xs text-slate-400">Institutional Reconciliation</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-display">
            <Calendar className="w-5 h-5 text-purple-400 shrink-0" />
            Monthly Performance &amp; End-of-Month Positions Review
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Official monthly reconciliation audit detailing liquidated trade outcomes, month-end holdings, and brokerage costs.
          </p>
        </div>

        {/* Global Actions */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => handleExportCSV(selectedMonth)}
            className="premium-action premium-report-glass-soft flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white sm:justify-start"
            title="Download CSV audit"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span className="whitespace-nowrap">Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="premium-action premium-report-glass-soft flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white sm:justify-start"
            title="Print Monthly Report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="whitespace-nowrap">Print</span>
          </button>
        </div>
      </div>

      {/* Interactive Controls Bar: Month Tabs & Sub-filters */}
      <div className="premium-report-glass-soft flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl">
        {/* Month Selector Tabs */}
        <div className="premium-selector-shell -mx-1 flex w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)] flex-nowrap items-center gap-1.5 overflow-x-auto px-1 md:mx-0 md:w-auto md:max-w-none md:flex-wrap md:overflow-visible md:px-1">
          <button
            type="button"
            aria-pressed={selectedMonth === 'ALL'}
            onClick={() => changeSelectedMonth('ALL')}
            className={`premium-filter-pill shrink-0 px-3 py-1 rounded-lg text-xs font-medium ${selectedMonth === 'ALL' ? 'premium-filter-active-purple font-semibold' : ''}`}
          >
            All Recorded Months
          </button>
          {availableMonths.map((m) => (
            <button
              key={m.monthKey}
              type="button"
              aria-pressed={selectedMonth === m.monthKey}
              onClick={() => changeSelectedMonth(m.monthKey)}
              className={`premium-filter-pill flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${selectedMonth === m.monthKey ? 'premium-filter-active-purple font-semibold' : ''}`}
            >
              <span>{m.monthLabel}</span>
              <span className="premium-chip px-1.5 py-0.2 rounded-full text-[10px] text-slate-300 font-mono">
                {m.liquidatedTrades.length} trades
              </span>
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:flex md:w-auto md:items-center">
          {/* Status filter */}
          <AnalyticsSelect
            value={statusFilter}
            onChange={(value) => changeStatusFilter(value as StatusFilter)}
            compact
            accent="purple"
            ariaLabel="Filter monthly report records"
            className="w-full md:min-w-[185px] md:w-auto"
            options={[
              { value: 'ALL', label: 'All Records' },
              { value: 'LIQUIDATED', label: 'Liquidated Trades Only' },
              { value: 'HOLDINGS', label: 'Month-End Holdings Only' },
            ]}
          />

          {/* Search */}
          <div className="relative w-full md:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker..."
              className="premium-field w-full rounded-xl border border-slate-700/70 bg-slate-950/45 py-1 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-purple-500 focus:outline-none md:w-40"
            />
          </div>
        </div>
      </div>

      {/* Monthly Audit Statements */}
      <MotionSwap motionKey={`${selectedMonth}-${statusFilter}`} variant="state" className="premium-monthly-results space-y-6">
        {displayedMonths.map((m) => {
          // Filter items by search query and status
          const filteredLiquidated = m.liquidatedTrades.filter((t) => {
            if (statusFilter === 'HOLDINGS') return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return t.ticker.toLowerCase().includes(q) || t.companyName.toLowerCase().includes(q);
          });

          const filteredHoldings = m.monthEndHoldings.filter((h) => {
            if (statusFilter === 'LIQUIDATED') return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return h.ticker.toLowerCase().includes(q) || h.companyName.toLowerCase().includes(q);
          });

          const auditRecords = [
            ...filteredLiquidated.map((trade) => {
              const isWin = trade.outcome === 'WIN';
              const totalFees =
                typeof trade.totalFees === 'number' && trade.totalFees > 0
                  ? trade.totalFees
                  : (trade.buyFees || 0) + (trade.sellFees || 0);
              return {
                key: `closed-${trade.id}`,
                kind: 'LIQUIDATED' as const,
                ticker: trade.ticker,
                companyName: trade.companyName,
                sector: trade.sector,
                shares: trade.shares,
                buyPrice: trade.buyPrice,
                buyDate: trade.buyDate,
                exitPrice: trade.sellPrice,
                exitLabel: 'Exit Price',
                exitDate: trade.sellDate,
                pnlEgp: trade.realizedPnlEgp,
                pnlPercent: trade.realizedPnlPercent,
                fees: totalFees,
                notes: trade.notes || '',
                statusLabel: `Closed ${trade.outcome}`,
                statusDetail: trade.sellDate,
                tone: isWin ? 'positive' as const : 'negative' as const,
                isPositive: isWin,
              };
            }),
            ...filteredHoldings.map((holding) => ({
              key: holding.id,
              kind: 'HOLDING' as const,
              ticker: holding.ticker,
              companyName: holding.companyName,
              sector: holding.sector,
              shares: holding.shares,
              buyPrice: holding.buyPrice,
              buyDate: holding.buyDate,
              exitPrice: holding.marketPrice,
              exitLabel: holding.type === 'CURRENT_OPEN' ? 'Market Price' : 'Recorded Exit Price',
              exitDate: holding.exitDate,
              pnlEgp: holding.pnlEgp,
              pnlPercent: holding.pnlPercent,
              fees: holding.fees,
              notes: holding.notes || '',
              statusLabel:
                holding.type === 'CURRENT_OPEN'
                  ? 'Active Holding'
                  : 'Held at Month-End',
              statusDetail:
                holding.type === 'CURRENT_OPEN'
                  ? 'Open at reporting date'
                  : `Exited ${holding.exitDate || 'later'}`,
              tone:
                holding.type === 'CURRENT_OPEN'
                  ? 'blue' as const
                  : 'purple' as const,
              isPositive: holding.pnlEgp >= 0,
            })),
          ];

          const visibleSummary = calculateMonthlyAuditSummary(auditRecords);
          const hasActivity = visibleSummary.recordCount > 0;
          const isProfitable = visibleSummary.state === 'positive';
          const isDrawdown = visibleSummary.state === 'negative';
          const isFlat = visibleSummary.state === 'neutral';

          const pnlLabel =
            statusFilter === 'LIQUIDATED'
              ? 'Realized P&L'
              : statusFilter === 'HOLDINGS'
                ? 'Holdings P&L'
                : 'Combined P&L';

          const summaryBadgeLabel = !hasActivity
            ? 'No Matching Records'
            : statusFilter === 'LIQUIDATED'
              ? isProfitable
                ? `Profitable (+${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                : isDrawdown
                  ? `Drawdown (${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                  : 'Breakeven'
              : statusFilter === 'HOLDINGS'
                ? isProfitable
                  ? `Holding Gain (+${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                  : isDrawdown
                    ? `Holding Loss (${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                    : 'Holdings Flat'
                : isProfitable
                  ? `Net Positive (+${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                  : isDrawdown
                    ? `Net Negative (${formatEgp(visibleSummary.totalPnlEgp)} EGP)`
                    : 'Net Flat';

          const summaryCountText =
            statusFilter === 'LIQUIDATED'
              ? `${visibleSummary.closedCount} liquidated roundtrips`
              : statusFilter === 'HOLDINGS'
                ? `${visibleSummary.holdingCount} month-end holdings`
                : `${visibleSummary.closedCount} liquidated • ${visibleSummary.holdingCount} holdings • ${visibleSummary.recordCount} visible records`;

          return (
            <div
              key={m.monthKey}
              className="premium-month-audit-shell overflow-hidden rounded-xl"
            >
              {/* Monthly Banner Ribbon */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-white/[0.025] via-transparent to-purple-500/[0.025] border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-base sm:text-lg flex items-center gap-1.5 font-display">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      {m.monthLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                        !hasActivity || isFlat
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : isProfitable
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {summaryBadgeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {summaryCountText}
                  </p>
                </div>

                {/* Quick Monthly Metrics */}
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto md:gap-4">
                  {/* Filter-aware P&L */}
                  <div className={`premium-report-glass-soft px-3 py-2 rounded-xl ${
                    !hasActivity || isFlat
                      ? 'border-slate-800'
                      : isProfitable
                        ? 'premium-state-win'
                        : 'premium-state-loss'
                  }`}>
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">{pnlLabel}</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        !hasActivity || isFlat
                          ? 'text-slate-400'
                          : isProfitable
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {!hasActivity
                        ? '0.00 EGP'
                        : `${isProfitable ? '+' : ''}${formatEgp(visibleSummary.totalPnlEgp)} EGP`}
                    </span>
                  </div>

                  {/* Filter-aware population / closed-trade win rate */}
                  <div className="premium-report-glass-soft px-3 py-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">
                      {statusFilter === 'LIQUIDATED'
                        ? 'Closed Win Rate'
                        : statusFilter === 'HOLDINGS'
                          ? 'Holdings'
                          : 'Visible Records'}
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-200">
                      {statusFilter === 'LIQUIDATED' ? (
                        visibleSummary.winRate !== null ? (
                          `${visibleSummary.winRate.toFixed(1)}% (${visibleSummary.wins}W / ${visibleSummary.losses}L)`
                        ) : (
                          <span className="text-slate-500 text-xs font-normal">&mdash; (0 decisive exits)</span>
                        )
                      ) : statusFilter === 'HOLDINGS' ? (
                        `${visibleSummary.holdingCount} holdings`
                      ) : (
                        `${visibleSummary.recordCount} (${visibleSummary.closedCount}C / ${visibleSummary.holdingCount}H)`
                      )}
                    </span>
                  </div>

                  {/* Filter-aware commissions */}
                  <div className="premium-report-glass-soft px-3 py-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Commissions</span>
                    <span className="font-mono font-bold text-sm text-amber-400">
                      {formatEgp(visibleSummary.totalFees)} EGP
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Audit Records */}
              {!hasActivity ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No records matching the filter criteria for {m.monthLabel}.
                </div>
              ) : (
                <>
                  {/* One audit record per card on phone/tablet */}
                  <section
                    className="grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-2 2xl:hidden"
                    aria-label={`${m.monthLabel} audit records`}
                  >
                    {auditRecords.map((record) => {
                      const toneClass =
                        record.tone === 'positive'
                          ? 'premium-report-tone-positive'
                          : record.tone === 'negative'
                            ? 'premium-report-tone-negative'
                            : record.tone === 'blue'
                              ? 'premium-report-tone-blue'
                              : 'premium-report-tone-purple';
                      const pnlClass = record.isPositive ? 'text-emerald-300' : 'text-rose-300';
                      const statusClass =
                        record.tone === 'positive'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : record.tone === 'negative'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                            : record.tone === 'blue'
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                              : 'border-purple-500/30 bg-purple-500/10 text-purple-300';

                      return (
                        <article
                          key={record.key}
                          className={`premium-card premium-hero-metric premium-report-hero-card ${toneClass} relative overflow-hidden rounded-2xl border p-4`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-lg font-black tracking-tight text-white">
                                  {record.ticker}
                                </span>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                                  {record.kind === 'LIQUIDATED' ? (
                                    record.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />
                                  ) : record.tone === 'blue' ? (
                                    <Clock className="h-3 w-3" />
                                  ) : (
                                    <Briefcase className="h-3 w-3" />
                                  )}
                                  {record.statusLabel}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-400">{record.companyName}</p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">{record.sector}</p>
                            </div>

                            <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${statusClass}`}>
                              {record.kind === 'LIQUIDATED' ? (
                                record.isPositive ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />
                              ) : (
                                <ShieldCheck className="h-4 w-4" />
                              )}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Performance
                            </div>
                            <div className={`mt-1 font-mono text-2xl font-black leading-none ${pnlClass}`}>
                              {record.isPositive ? '+' : ''}{formatEgp(record.pnlEgp)} EGP
                            </div>
                            <div className={`mt-1 font-mono text-xs font-bold ${record.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {record.isPositive ? '+' : ''}{record.pnlPercent.toFixed(2)}%
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="premium-report-glass-soft rounded-xl px-3 py-2.5">
                              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Shares</span>
                              <span className="mt-1 block font-mono text-sm font-bold text-slate-100">
                                {record.shares.toLocaleString()}
                              </span>
                            </div>
                            <div className="premium-report-glass-soft rounded-xl px-3 py-2.5">
                              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Commissions</span>
                              <span className="mt-1 block font-mono text-sm font-bold text-amber-300">
                                {formatEgp(record.fees)} EGP
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-700/55 bg-slate-950/30 px-3 py-2.5">
                              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Entry</span>
                              <span className="mt-1 block font-mono text-sm font-bold text-slate-200">
                                {formatEgp(record.buyPrice)} EGP
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">{record.buyDate}</span>
                            </div>
                            <div className="rounded-xl border border-slate-700/55 bg-slate-950/30 px-3 py-2.5">
                              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">{record.exitLabel}</span>
                              <span className="mt-1 block font-mono text-sm font-bold text-slate-100">
                                {formatEgp(record.exitPrice)} EGP
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">{record.statusDetail}</span>
                            </div>
                          </div>

                          {record.notes && (
                            <div className="mt-3 border-t border-slate-700/45 pt-3 text-[11px] leading-relaxed text-slate-400">
                              <span className="mr-1 font-semibold uppercase tracking-[0.12em] text-slate-500">Notes</span>
                              {record.notes}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>

                  {/* Full institutional audit table on true desktop */}
                  <div className="premium-report-table hidden overflow-x-auto overscroll-x-contain 2xl:block">
                    <table className="report-monthly-table min-w-[1180px] w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-4">Instrument</th>
                        <th className="py-2.5 px-4">Audit Status</th>
                        <th className="py-2.5 px-4 text-right">Shares</th>
                        <th className="py-2.5 px-4 text-right">Buy Price / Date</th>
                        <th className="py-2.5 px-4 text-right">Exit / Market Price</th>
                        <th className="py-2.5 px-4 text-right">Performance (Gain / Loss)</th>
                        <th className="py-2.5 px-4 text-right">Commissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {auditRecords.map((record) => {
                        const statusClass =
                          record.tone === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : record.tone === 'negative'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : record.tone === 'blue'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-purple-500/10 text-purple-300 border border-purple-500/30';
                        return (
                          <tr key={record.key} className={`transition ${record.kind === 'HOLDING' ? 'bg-white/[0.01]' : ''}`}>
                            <td className="py-3 px-4">
                              <div className={`font-bold ${record.kind === 'HOLDING' ? 'text-cyan-300' : 'text-white'}`}>
                                {record.ticker}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{record.companyName}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
                                {record.kind === 'LIQUIDATED' ? (
                                  record.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                {record.statusLabel}
                                {record.statusDetail ? ` (${record.statusDetail})` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-200 font-mono">
                              {record.shares.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-300 font-mono">
                              {formatEgp(record.buyPrice)}{' '}
                              <span className="text-[10px] text-slate-500 font-sans">({record.buyDate})</span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-100 font-mono">
                              {formatEgp(record.exitPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <div className={`font-bold text-sm ${record.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {record.isPositive ? '+' : ''}{formatEgp(record.pnlEgp)} EGP
                              </div>
                              <div className={`text-[10px] font-semibold ${record.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {record.isPositive ? '+' : ''}{record.pnlPercent.toFixed(2)}%
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-amber-400 font-mono">
                              {record.fees > 0 ? formatEgp(record.fees) : '0.00'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          );
        })}
      </MotionSwap>
    </div>
  );
};

export const MonthlyPerformanceReport = React.memo(MonthlyPerformanceReportComponent);
