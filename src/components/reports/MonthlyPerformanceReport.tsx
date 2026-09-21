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
import { getMonthKey, getMonthLabel, getLastDayOfMonth, dmyToIso, formatDateDDMMYYYY } from '../../utils/dateUtils';

interface MonthlyPerformanceReportProps {
  closedTrades: ClosedTrade[];
  positions: Position[];
}

type StatusFilter = 'ALL' | 'LIQUIDATED' | 'HOLDINGS';

const formatEgp = (val: number) =>
  val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export const MonthlyPerformanceReport: React.FC<MonthlyPerformanceReportProps> = ({
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
          const currentVal = p.shares * p.currentPrice;
          const pnlEgp = currentVal - costBasis;
          const pnlPercent = costBasis > 0 ? (pnlEgp / costBasis) * 100 : 0;
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
    <div id="report-monthly-performance" className="premium-report-glass p-5 sm:p-6 rounded-2xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportCSV(selectedMonth)}
            className="premium-action premium-report-glass-soft flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-medium"
            title="Download CSV audit"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Export Audit CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="premium-action premium-report-glass-soft flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-medium"
            title="Print Monthly Report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Print Audit</span>
          </button>
        </div>
      </div>

      {/* Interactive Controls Bar: Month Tabs & Sub-filters */}
      <div className="premium-report-glass-soft flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl">
        {/* Month Selector Tabs */}
        <div className="premium-selector-shell flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            aria-pressed={selectedMonth === 'ALL'}
            onClick={() => changeSelectedMonth('ALL')}
            className={`premium-filter-pill px-3 py-1 rounded-lg text-xs font-medium ${selectedMonth === 'ALL' ? 'premium-filter-active-purple font-semibold' : ''}`}
          >
            All Recorded Months
          </button>
          {availableMonths.map((m) => (
            <button
              key={m.monthKey}
              type="button"
              aria-pressed={selectedMonth === m.monthKey}
              onClick={() => changeSelectedMonth(m.monthKey)}
              className={`premium-filter-pill px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${selectedMonth === m.monthKey ? 'premium-filter-active-purple font-semibold' : ''}`}
            >
              <span>{m.monthLabel}</span>
              <span className="premium-chip px-1.5 py-0.2 rounded-full text-[10px] text-slate-300 font-mono">
                {m.liquidatedTrades.length} trades
              </span>
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <AnalyticsSelect
            value={statusFilter}
            onChange={(value) => changeStatusFilter(value as StatusFilter)}
            compact
            accent="purple"
            ariaLabel="Filter monthly report records"
            className="min-w-[185px]"
            options={[
              { value: 'ALL', label: 'All Records' },
              { value: 'LIQUIDATED', label: 'Liquidated Trades Only' },
              { value: 'HOLDINGS', label: 'Month-End Holdings Only' },
            ]}
          />

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker..."
              className="premium-field pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-950/45 border border-slate-700/70 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-32 sm:w-40"
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

          const hasActivity = filteredLiquidated.length > 0 || filteredHoldings.length > 0;
          const isProfitable = m.netRealized > 0;
          const isDrawdown = m.netRealized < 0;
          const isNoExits = m.liquidatedTrades.length === 0;

          return (
            <div
              key={m.monthKey}
              className={`premium-card premium-report-hero rounded-xl overflow-hidden ${
                isNoExits
                  ? 'border-slate-800'
                  : isProfitable
                  ? 'premium-state-win'
                  : isDrawdown
                  ? 'premium-state-loss'
                  : 'premium-state-breakeven'
              }`}
            >
              {/* Monthly Banner Ribbon */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-white/[0.025] via-transparent to-purple-500/[0.025] border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base sm:text-lg flex items-center gap-1.5 font-display">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      {m.monthLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                        isNoExits
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : isProfitable
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isNoExits ? (
                        'Accrual / Holdings'
                      ) : isProfitable ? (
                        `Profitable (+${formatEgp(m.netRealized)} EGP)`
                      ) : (
                        `Drawdown (${formatEgp(m.netRealized)} EGP)`
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {m.liquidatedTrades.length} liquidated roundtrips &bull; {m.monthEndHoldings.length} month-end portfolio positions
                  </p>
                </div>

                {/* Quick Monthly Metrics */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {/* Monthly Net Realized */}
                  <div className={`premium-report-glass-soft px-3 py-2 rounded-xl ${
                    isNoExits
                      ? 'border-slate-800'
                      : isProfitable
                      ? 'premium-state-win'
                      : isDrawdown
                      ? 'premium-state-loss'
                      : 'premium-state-breakeven'
                  }`}>
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Realized P&amp;L</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isNoExits
                          ? 'text-slate-400'
                          : isProfitable
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {isNoExits ? '0.00 EGP' : `${isProfitable ? '+' : ''}${formatEgp(m.netRealized)} EGP`}
                    </span>
                  </div>

                  {/* Win Rate */}
                  <div className="premium-report-glass-soft px-3 py-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Win Rate</span>
                    <span className="font-mono font-bold text-sm text-slate-200">
                      {m.winRate !== null ? (
                        `${m.winRate.toFixed(1)}% (${m.winsCount}W / ${m.lossesCount}L)`
                      ) : (
                        <span className="text-slate-500 text-xs font-normal">&mdash; (0 Exits)</span>
                      )}
                    </span>
                  </div>

                  {/* Brokerage Fees */}
                  <div className="premium-report-glass-soft px-3 py-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Commissions</span>
                    <span className="font-mono font-bold text-sm text-amber-400">
                      {formatEgp(m.fees)} EGP
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Records Table */}
              {!hasActivity ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No records matching the filter criteria for {m.monthLabel}.
                </div>
              ) : (
                <div className="premium-report-table overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
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
                      {/* 1. Liquidated Trades in Month */}
                      {filteredLiquidated.map((trade) => {
                        const isWin = trade.outcome === 'WIN';
                        return (
                          <tr key={`closed-${trade.id}`} className="transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white">{trade.ticker}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{trade.companyName}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isWin
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {isWin ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                Closed {trade.outcome} ({trade.sellDate})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-200 font-mono">
                              {trade.shares.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-300 font-mono">
                              {formatEgp(trade.buyPrice)}{' '}
                              <span className="text-[10px] text-slate-500 font-sans">({trade.buyDate})</span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-white font-mono">
                              {formatEgp(trade.sellPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <div className={`font-bold text-sm ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}{formatEgp(trade.realizedPnlEgp)} EGP
                              </div>
                              <div className={`text-[10px] font-semibold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isWin ? '+' : ''}{trade.realizedPnlPercent.toFixed(2)}%
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-amber-400 font-mono">
                              {trade.totalFees ? `${formatEgp(trade.totalFees)}` : '0.00'}
                            </td>
                          </tr>
                        );
                      })}

                      {/* 2. Month-End Active Holdings */}
                      {filteredHoldings.map((h) => {
                        const isGain = h.pnlEgp >= 0;
                        return (
                          <tr key={h.id} className="transition bg-white/[0.01]">
                            <td className="py-3 px-4">
                              <div className="font-bold text-cyan-300">{h.ticker}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{h.companyName}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  h.type === 'CURRENT_OPEN'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                    : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {h.type === 'CURRENT_OPEN'
                                  ? 'Active Holding'
                                  : `Held at Month-End (Exited ${h.exitDate})`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-200 font-mono">
                              {h.shares.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-300 font-mono">
                              {formatEgp(h.buyPrice)}{' '}
                              <span className="text-[10px] text-slate-500 font-sans">({h.buyDate})</span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-200 font-mono">
                              {formatEgp(h.marketPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <div className={`font-bold text-sm ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isGain ? '+' : ''}{formatEgp(h.pnlEgp)} EGP
                              </div>
                              <div className={`text-[10px] font-semibold ${isGain ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isGain ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-amber-400 font-mono">
                              {h.fees > 0 ? `${formatEgp(h.fees)}` : '0.00'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </MotionSwap>
    </div>
  );
};
