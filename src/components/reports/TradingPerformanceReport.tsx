import React, { useState, useMemo } from 'react';
import { AnalyticsSelect } from '../AnalyticsSelect';
import { runVisualTransition } from '../../utils/visualTransition';
import { MotionSwap } from '../PremiumMotion';
import {
  TrendingUp,
  TrendingDown,
  Award,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download,
  Printer,
  Sparkles,
  Percent,
  Clock,
  Target,
  BarChart3,
  DollarSign,
  Layers,
} from 'lucide-react';
import { ClosedTrade, PerformanceStats, Position } from '../../types';
import { calculatePerformanceStats as calculateAccountingPerformanceStats } from '../../services/portfolioAccounting';

interface TradingPerformanceReportProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  cashBalance: number;
}

type TimeframeFilter = 'ALL' | 'YTD' | '90D' | '30D';

const EGP_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (val: number) => EGP_FORMATTER.format(val);

const formatRatio = (val: number) => (Number.isFinite(val) ? val.toFixed(2) : '∞');

const TradingPerformanceReportComponent: React.FC<TradingPerformanceReportProps> = ({
  stats,
  closedTrades,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('ALL');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'ALL' | 'Swing' | 'Day Trade' | 'Position'>('ALL');

  const changeTimeframe = (next: TimeframeFilter) => {
    if (next === timeframe) return;
    runVisualTransition('performance-filter', () => setTimeframe(next));
  };

  const changeTradeTypeFilter = (next: typeof tradeTypeFilter) => {
    if (next === tradeTypeFilter) return;
    runVisualTransition('performance-filter', () => setTradeTypeFilter(next));
  };

  // Filter trades based on user selections
  const filteredTrades = useMemo(() => {
    const now = new Date();
    return closedTrades.filter((t) => {
      // Trade Type filter
      if (tradeTypeFilter !== 'ALL' && t.tradeType !== tradeTypeFilter) {
        return false;
      }

      // Timeframe filter
      if (timeframe === 'ALL') return true;

      const dateStr = t.sellDate || t.buyDate;
      if (!dateStr) return true;
      const tradeDate = new Date(dateStr);

      if (timeframe === 'YTD') {
        const currentYear = now.getFullYear();
        return tradeDate.getFullYear() === currentYear;
      }
      if (timeframe === '90D') {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return tradeDate >= ninetyDaysAgo;
      }
      if (timeframe === '30D') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return tradeDate >= thirtyDaysAgo;
      }
      return true;
    });
  }, [closedTrades, timeframe, tradeTypeFilter]);

  // Trade statistics come from the authoritative accounting engine. Historical
  // drawdown is only shown when an actual equity-curve result has been supplied.
  const indicators = useMemo(() => {
    const accounting = calculateAccountingPerformanceStats(filteredTrades);
    const totalClosed = accounting.totalTrades;
    const wins = filteredTrades.filter((t) => t.realizedPnlEgp > 0.01);
    const losses = filteredTrades.filter((t) => t.realizedPnlEgp < -0.01);
    const winCount = accounting.winningTrades;
    const lossCount = accounting.losingTrades;
    const winRate = accounting.winRate ?? 0;
    const grossProfit = accounting.grossProfit;
    const grossLoss = accounting.grossLoss;
    const profitFactor = accounting.profitFactor ?? 0;
    const winLossRatio = lossCount > 0 ? winCount / lossCount : winCount > 0 ? Infinity : 0;
    const netRealized = grossProfit - grossLoss;
    const avgTradePnl = totalClosed > 0 ? netRealized / totalClosed : 0;
    const avgWin = accounting.avgWin;
    const avgLoss = accounting.avgLoss;
    const payoffRatio = accounting.payoffRatio ?? 0;
    const expectancy = accounting.expectancy ?? 0;

    const sortedWins = [...wins].sort((a, b) => b.realizedPnlEgp - a.realizedPnlEgp);
    const sortedLosses = [...losses].sort((a, b) => a.realizedPnlEgp - b.realizedPnlEgp);

    const largestWinTrade = sortedWins[0] || null;
    const largestLossTrade = sortedLosses[0] || null;
    const largestWin = largestWinTrade ? largestWinTrade.realizedPnlEgp : 0;
    const largestLoss = largestLossTrade ? Math.abs(largestLossTrade.realizedPnlEgp) : 0;

    const drawdownAvailable =
      timeframe === 'ALL' &&
      tradeTypeFilter === 'ALL' &&
      Number.isFinite(stats.maxDrawdownEgp) &&
      Number.isFinite(stats.maxDrawdownPercent);
    const maxDrawdownEgp = drawdownAvailable ? stats.maxDrawdownEgp! : null;
    const maxDrawdownPercent = drawdownAvailable ? stats.maxDrawdownPercent! : null;
    const recoveryFactor = drawdownAvailable
      ? maxDrawdownEgp! > 0
        ? netRealized / maxDrawdownEgp!
        : netRealized > 0
          ? Infinity
          : 0
      : null;

    const totalFees = filteredTrades.reduce((acc, t) => acc + (t.totalFees || 0), 0);
    const avgHoldDays = Math.round(accounting.avgHoldDays ?? 0);

    return {
      totalClosed,
      winCount,
      lossCount,
      winRate,
      grossProfit,
      grossLoss,
      netRealized,
      profitFactor,
      winLossRatio,
      avgTradePnl,
      avgWin,
      avgLoss,
      payoffRatio,
      expectancy,
      largestWin,
      largestLoss,
      largestWinTrade,
      largestLossTrade,
      drawdownAvailable,
      maxDrawdownEgp,
      maxDrawdownPercent,
      recoveryFactor,
      totalFees,
      avgHoldDays,
    };
  }, [filteredTrades, timeframe, tradeTypeFilter, stats.maxDrawdownEgp, stats.maxDrawdownPercent]);

  // Export Report to CSV
  const handleExportCSV = () => {
    const rows = [
      ['Trading Performance Indicators & Institutional Benchmarks Report'],
      [`Generated: ${new Date().toISOString().slice(0, 10)}`, `Timeframe: ${timeframe}`, `Trade Type: ${tradeTypeFilter}`],
      [],
      ['Indicator', 'Measured Result', 'Institutional Benchmark', 'Status Assessment'],
      ['Win Rate %', `${indicators.winRate.toFixed(1)}%`, '> 50.0%', indicators.winRate >= 50 ? 'TARGET MET' : 'BELOW TARGET'],
      ['Profit Factor', formatRatio(indicators.profitFactor), '> 1.50', indicators.profitFactor >= 1.5 ? 'OUTPERFORMING' : indicators.profitFactor >= 1.0 ? 'MODERATE' : 'UNPROFITABLE'],
      ['Payoff Ratio (Avg Win / Avg Loss)', `${formatRatio(indicators.payoffRatio)} : 1`, '> 1.50 : 1', indicators.payoffRatio >= 1.5 ? 'EXCELLENT' : 'MODERATE'],
      ['Mathematical Trade Expectancy', `${indicators.expectancy >= 0 ? '+' : ''}${indicators.expectancy.toFixed(2)} EGP`, '> 0.00 EGP', indicators.expectancy > 0 ? 'POSITIVE EDGE' : 'NEGATIVE'],
      ['Total Closed Trades', `${indicators.totalClosed}`, '>= 20 for statistical confidence', indicators.totalClosed >= 20 ? 'STATISTICALLY SIGNIFICANT' : 'PRELIMINARY SAMPLE'],
      ['Winning Trades', `${indicators.winCount} (${indicators.totalClosed > 0 ? ((indicators.winCount / indicators.totalClosed) * 100).toFixed(1) : 0}%)`, '> Losing Trades', indicators.winCount > indicators.lossCount ? 'DOMINANT' : 'EQUAL/BELOW'],
      ['Losing Trades', `${indicators.lossCount} (${indicators.totalClosed > 0 ? ((indicators.lossCount / indicators.totalClosed) * 100).toFixed(1) : 0}%)`, '< Winning Trades', indicators.lossCount < indicators.winCount ? 'CONTROLLED' : 'HIGH'],
      ['Win / Loss Ratio', `${formatRatio(indicators.winLossRatio)} : 1`, '> 1.00 : 1', indicators.winLossRatio >= 1.0 ? 'FAVORABLE' : 'UNFAVORABLE'],
      ['Average Trade P&L', `${indicators.avgTradePnl >= 0 ? '+' : ''}${indicators.avgTradePnl.toFixed(2)} EGP`, '> 0.00 EGP', indicators.avgTradePnl > 0 ? 'PROFITABLE' : 'UNPROFITABLE'],
      ['Average Win', `+${indicators.avgWin.toFixed(2)} EGP`, 'Maximize Gains', 'NET WIN'],
      ['Average Loss', `-${indicators.avgLoss.toFixed(2)} EGP`, 'Minimize Drawdowns', 'NET LOSS'],
      ['Largest Win', `+${indicators.largestWin.toFixed(2)} EGP (${indicators.largestWinTrade ? indicators.largestWinTrade.ticker : 'N/A'})`, 'Outlier Profit', 'BEST TRADE'],
      ['Largest Loss', `-${indicators.largestLoss.toFixed(2)} EGP (${indicators.largestLossTrade ? indicators.largestLossTrade.ticker : 'N/A'})`, '< 5% Capital Risk', 'MAX LOSS'],
      ['Gross Profit', `+${indicators.grossProfit.toFixed(2)} EGP`, 'Gross Wins', 'GAINS'],
      ['Gross Loss', `-${indicators.grossLoss.toFixed(2)} EGP`, 'Gross Losses', 'LOSSES'],
      ['Net Realized P&L', `${indicators.netRealized >= 0 ? '+' : ''}${indicators.netRealized.toFixed(2)} EGP`, '> 0.00 EGP', indicators.netRealized >= 0 ? 'PROFITABLE' : 'NET LOSS'],
      ['Max Performance Drawdown', indicators.drawdownAvailable ? `-${indicators.maxDrawdownPercent!.toFixed(2)}% (nominal equity gap: ${indicators.maxDrawdownEgp!.toFixed(2)} EGP)` : 'N/A — historical analytics unavailable', '<= 10.0%', indicators.drawdownAvailable ? (indicators.maxDrawdownPercent! <= 10 ? 'TARGET MET' : 'ELEVATED RISK') : 'NOT AVAILABLE'],
      ['Recovery Factor', indicators.recoveryFactor === null ? 'N/A' : formatRatio(indicators.recoveryFactor), '> 2.00', indicators.recoveryFactor === null ? 'NOT AVAILABLE' : indicators.recoveryFactor >= 2 ? 'RESILIENT' : 'MODERATE'],
      ['Brokerage Commissions Paid', `${indicators.totalFees.toFixed(2)} EGP`, 'Execution Friction', 'COSTS'],
      ['Average Holding Period', `${indicators.avgHoldDays} days`, 'Swing: 1-14 days', 'DURATION'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Trading_Performance_Indicators_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="report-trading-performance" className="premium-trading-performance-results premium-report-glass p-5 sm:p-6 rounded-2xl space-y-6">
      {/* Report Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              REPORT 1 &bull; INSTITUTIONAL BENCHMARK
            </span>
            <span className="text-xs text-slate-400">EGX Trading Discipline</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-display">
            <Award className="w-5 h-5 text-amber-400 shrink-0" />
            Trading Performance Indicators &amp; Institutional Benchmarks
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Comprehensive statistical evaluation of trading edge, win/loss mechanics, expectancy, and risk-adjusted efficiency.
          </p>
        </div>

        {/* Action Controls: Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="premium-selector-shell flex items-center">
            {(['ALL', 'YTD', '90D', '30D'] as TimeframeFilter[]).map((tf) => (
              <button
                key={tf}
                type="button"
                aria-pressed={timeframe === tf}
                onClick={() => changeTimeframe(tf)}
                className={`premium-filter-pill px-2.5 py-1 rounded-lg text-xs font-medium ${timeframe === tf ? 'premium-filter-active-blue font-semibold' : ''}`}
              >
                {tf === 'ALL' ? 'All Time' : tf}
              </button>
            ))}
          </div>

          {/* Trade Type Filter */}
          <AnalyticsSelect
            value={tradeTypeFilter}
            onChange={(value) => changeTradeTypeFilter(value as typeof tradeTypeFilter)}
            compact
            accent="blue"
            ariaLabel="Filter by trade type"
            className="min-w-[165px]"
            options={[
              { value: 'ALL', label: 'All Trade Types' },
              { value: 'Swing', label: 'Swing Only' },
              { value: 'Day Trade', label: 'Day Trade Only' },
              { value: 'Position', label: 'Position Only' },
            ]}
          />

          {/* Export & Print */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="premium-action premium-report-glass-soft flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-medium"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="premium-action premium-report-glass-soft flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white text-xs font-medium"
            title="Print or Save PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      <MotionSwap motionKey={`${timeframe}-${tradeTypeFilter}`} variant="state" className="space-y-6">
      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`premium-card premium-hero-metric p-3.5 rounded-xl ${indicators.winRate >= 50 ? 'premium-state-win' : 'premium-state-loss'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Win Rate</span>
            <Target className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${indicators.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {indicators.winRate.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              ({indicators.winCount}W / {indicators.lossCount}L)
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
            <span>Target: &gt; 50.0%</span>
            {indicators.winRate >= 50 ? (
              <span className="text-emerald-400 font-semibold">&bull; Target Met</span>
            ) : (
              <span className="text-rose-400 font-semibold">&bull; Below Target</span>
            )}
          </div>
        </div>

        <div className={`premium-card premium-hero-metric p-3.5 rounded-xl ${indicators.profitFactor >= 1.5 ? 'premium-state-win' : indicators.profitFactor >= 1.0 ? 'premium-state-breakeven' : 'premium-state-loss'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Profit Factor</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${indicators.profitFactor >= 1.5 ? 'text-emerald-400' : indicators.profitFactor >= 1.0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {formatRatio(indicators.profitFactor)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Gross Gain/Loss</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
            <span>Benchmark: &gt; 1.50</span>
            {indicators.profitFactor >= 1.5 ? (
              <span className="text-emerald-400 font-semibold">&bull; Outperforming</span>
            ) : (
              <span className="text-amber-400 font-semibold">&bull; Moderate</span>
            )}
          </div>
        </div>

        <div className={`premium-card premium-hero-metric p-3.5 rounded-xl ${indicators.payoffRatio >= 1.5 ? 'premium-state-win' : indicators.payoffRatio >= 1.0 ? 'premium-state-breakeven' : 'premium-state-loss'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Payoff Ratio</span>
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${indicators.payoffRatio >= 1.5 ? 'text-purple-300' : 'text-slate-200'}`}>
              {formatRatio(indicators.payoffRatio)} : 1
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
            <span>Avg Win: +{formatEgp(indicators.avgWin)}</span>
          </div>
        </div>

        <div className={`premium-card premium-hero-metric p-3.5 rounded-xl ${!indicators.drawdownAvailable ? '' : indicators.maxDrawdownPercent! <= 5 ? 'premium-state-win' : indicators.maxDrawdownPercent! <= 10 ? 'premium-state-breakeven' : 'premium-state-loss'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Performance Drawdown</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${!indicators.drawdownAvailable ? 'text-slate-400' : indicators.maxDrawdownPercent! <= 5 ? 'text-emerald-400' : indicators.maxDrawdownPercent! <= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
              {indicators.drawdownAvailable ? `-${indicators.maxDrawdownPercent!.toFixed(2)}%` : 'N/A'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {indicators.drawdownAvailable ? `(nominal gap ${formatEgp(indicators.maxDrawdownEgp!)} EGP)` : '(historical analytics unavailable)'}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            <span>Target: &le; 10.0% &bull; TWR peak-to-trough</span>
          </div>
        </div>
      </div>

      {/* Main Indicators Scorecard Table */}
      <div className="premium-report-table overflow-x-auto rounded-xl">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-800/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Performance Indicator</th>
              <th className="py-3 px-4 text-right">Measured Result</th>
              <th className="py-3 px-4">Institutional Benchmark / Target</th>
              <th className="py-3 px-4 text-right">Assessment &amp; Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {/* 1. Win Rate */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-blue-400" />
                  Win Rate %
                </div>
                <div className="text-[11px] text-slate-400">Winning trades as a percentage of total closed trades</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                <span className={indicators.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>
                  {indicators.winRate.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 50.0%</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.winRate >= 50
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.winRate >= 50 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {indicators.winRate >= 50 ? 'Target Met (>50%)' : 'Below Target'}
                </span>
              </td>
            </tr>

            {/* 2. Profit Factor */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Profit Factor
                </div>
                <div className="text-[11px] text-slate-400">Gross Realized Profit divided by Gross Realized Loss</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                <span
                  className={
                    indicators.profitFactor >= 1.5
                      ? 'text-emerald-400'
                      : indicators.profitFactor >= 1.0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {formatRatio(indicators.profitFactor)}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 1.50 (Breakeven = 1.00)</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.profitFactor >= 1.5
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : indicators.profitFactor >= 1.0
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.profitFactor >= 1.5 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Outperforming Benchmark
                    </>
                  ) : indicators.profitFactor >= 1.0 ? (
                    <>
                      <Info className="w-3 h-3" /> Moderate Profitability
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> Unprofitable Factor
                    </>
                  )}
                </span>
              </td>
            </tr>

            {/* 3. Payoff Ratio */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  Payoff Ratio (Win / Loss Magnitude)
                </div>
                <div className="text-[11px] text-slate-400">Average Winning Trade divided by Average Losing Trade</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-purple-300">
                {formatRatio(indicators.payoffRatio)} : 1
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 1.50 : 1</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.payoffRatio >= 1.5
                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {indicators.payoffRatio >= 2.0
                    ? 'Strong Asymmetry (>2.0x)'
                    : indicators.payoffRatio >= 1.5
                    ? 'Target Met (>1.5x)'
                    : 'Moderate Risk/Reward'}
                </span>
              </td>
            </tr>

            {/* 4. Mathematical Expectancy */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Mathematical Trade Expectancy
                </div>
                <div className="text-[11px] text-slate-400">Expected statistical return per trade execution (EGP)</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                <span className={indicators.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {indicators.expectancy >= 0 ? '+' : ''}{formatEgp(indicators.expectancy)} EGP
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 0.00 EGP per execution</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.expectancy > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.expectancy > 0 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Positive Statistical Edge
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> Negative Expectancy
                    </>
                  )}
                </span>
              </td>
            </tr>

            {/* 5. Total Closed Trades & Confidence */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Total Closed Trades Sample Size
                </div>
                <div className="text-[11px] text-slate-400">Completed roundtrip trades in filtered sample</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-white">
                {indicators.totalClosed} Trades
              </td>
              <td className="py-3 px-4 text-slate-300">Confidence Threshold: &ge; 20 executions</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.totalClosed >= 20
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <Info className="w-3 h-3" />
                  {indicators.totalClosed >= 20
                    ? 'Statistically Confident Sample'
                    : 'Preliminary Sample (<20)'}
                </span>
              </td>
            </tr>

            {/* 6. Total Winning Trades */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Total Winning Trades
                </div>
                <div className="text-[11px] text-slate-400">Number of liquidated trades with positive realized return</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-400">
                {indicators.winCount} Positions
              </td>
              <td className="py-3 px-4 text-slate-300">
                Split: {indicators.totalClosed > 0 ? ((indicators.winCount / indicators.totalClosed) * 100).toFixed(1) : 0}% of closed trades
              </td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Profitable Realizations
                </span>
              </td>
            </tr>

            {/* 7. Total Losing Trades */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  Total Losing Trades
                </div>
                <div className="text-[11px] text-slate-400">Number of liquidated trades with net realized loss</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-rose-400">
                {indicators.lossCount} Positions
              </td>
              <td className="py-3 px-4 text-slate-300">
                Split: {indicators.totalClosed > 0 ? ((indicators.lossCount / indicators.totalClosed) * 100).toFixed(1) : 0}% of closed trades
              </td>
              <td className="py-3 px-4 text-right">
                <span className="premium-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-300">
                  <Info className="w-3 h-3" /> Controlled Risk Exits
                </span>
              </td>
            </tr>

            {/* 8. Win / Loss Count Ratio */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  Win / Loss Count Ratio
                </div>
                <div className="text-[11px] text-slate-400">Ratio of winning positions count to losing positions count</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-white">
                {formatRatio(indicators.winLossRatio)} : 1
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 1.00 : 1</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.winLossRatio >= 1.0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.winLossRatio >= 1.0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {indicators.winLossRatio >= 1.0 ? 'Favorable (>1.0:1)' : 'Unfavorable (<1.0:1)'}
                </span>
              </td>
            </tr>

            {/* 9. Average Trade P&L */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-teal-400" />
                  Average Trade P&amp;L
                </div>
                <div className="text-[11px] text-slate-400">Net Realized P&amp;L divided by Total Closed Trades</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                <span className={indicators.avgTradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {indicators.avgTradePnl >= 0 ? '+' : ''}{formatEgp(indicators.avgTradePnl)} EGP
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 0.00 EGP</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.avgTradePnl >= 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.avgTradePnl >= 0 ? 'Positive Expectancy' : 'Negative Average'}
                </span>
              </td>
            </tr>

            {/* 10. Average Win */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Average Win
                </div>
                <div className="text-[11px] text-slate-400">Mean realized gain per profitable position</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-400">
                +{formatEgp(indicators.avgWin)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300">Baseline Gain Magnitude</td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Target Met
                </span>
              </td>
            </tr>

            {/* 11. Average Loss */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  Average Loss
                </div>
                <div className="text-[11px] text-slate-400">Mean realized loss per unprofitable position</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-rose-400">
                -{formatEgp(indicators.avgLoss)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300">Loss Containment: Minimize &lt; Avg Win</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.avgLoss <= indicators.avgWin
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.avgLoss <= indicators.avgWin ? 'Controlled (< Avg Win)' : 'Exceeds Avg Win'}
                </span>
              </td>
            </tr>

            {/* 12. Largest Win */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  Largest Win
                </div>
                <div className="text-[11px] text-slate-400">Single highest realized profit transaction</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-400">
                +{formatEgp(indicators.largestWin)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300 truncate max-w-xs">
                {indicators.largestWinTrade ? (
                  <span className="font-sans">
                    <strong className="text-white font-mono">{indicators.largestWinTrade.ticker}</strong> ({indicators.largestWinTrade.companyName}){' '}
                    <span className="text-emerald-400 font-mono font-bold">+{indicators.largestWinTrade.realizedPnlPercent.toFixed(1)}%</span>
                  </span>
                ) : (
                  'No closed wins'
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Peak Winner
                </span>
              </td>
            </tr>

            {/* 13. Largest Loss */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Largest Loss
                </div>
                <div className="text-[11px] text-slate-400">Single largest realized loss transaction</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-rose-400">
                -{formatEgp(indicators.largestLoss)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300 truncate max-w-xs">
                {indicators.largestLossTrade ? (
                  <span className="font-sans">
                    <strong className="text-white font-mono">{indicators.largestLossTrade.ticker}</strong> ({indicators.largestLossTrade.companyName}){' '}
                    <span className="text-rose-400 font-mono font-bold">{indicators.largestLossTrade.realizedPnlPercent.toFixed(1)}%</span>
                  </span>
                ) : (
                  'No closed losses'
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3 h-3" /> Max Drawdown Trade
                </span>
              </td>
            </tr>

            {/* 14. Gross Profit */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Gross Realized Profit
                </div>
                <div className="text-[11px] text-slate-400">Sum total of all winning transactions</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-400">
                +{formatEgp(indicators.grossProfit)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300">All Positive Realizations</td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Gross Gains
                </span>
              </td>
            </tr>

            {/* 15. Gross Loss */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  Gross Realized Loss
                </div>
                <div className="text-[11px] text-slate-400">Sum total of all losing transactions</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-rose-400">
                -{formatEgp(indicators.grossLoss)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300">All Negative Realizations</td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3 h-3" /> Gross Losses
                </span>
              </td>
            </tr>

            {/* 16. Net Realized P&L */}
            <tr className="transition bg-white/[0.012]">
              <td className="py-3 px-4">
                <div className="font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                  Net Realized P&amp;L
                </div>
                <div className="text-[11px] text-slate-400">Gross Profit minus Gross Loss (Net of Trade Fees)</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-base">
                <span className={indicators.netRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {indicators.netRealized >= 0 ? '+' : ''}{formatEgp(indicators.netRealized)} EGP
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Bottom-Line Trading Gain</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.netRealized >= 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {indicators.netRealized >= 0 ? 'Net Profitable Portfolio' : 'Net Loss Recorded'}
                </span>
              </td>
            </tr>

            {/* 17. Max Drawdown */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Peak-to-Trough Max Drawdown
                </div>
                <div className="text-[11px] text-slate-400">Maximum cumulative equity drop from historical peak</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                <span className={!indicators.drawdownAvailable ? 'text-slate-400' : indicators.maxDrawdownPercent! <= 5 ? 'text-emerald-400' : 'text-amber-400'}>
                  {indicators.drawdownAvailable ? `-${indicators.maxDrawdownPercent!.toFixed(2)}%` : 'N/A'}
                </span>
                <span className="block text-[10px] text-slate-400 font-normal">
                  {indicators.drawdownAvailable ? `-${formatEgp(indicators.maxDrawdownEgp!)} EGP` : 'Historical equity data unavailable'}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &le; 10.0% of Capital</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    !indicators.drawdownAvailable
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : indicators.maxDrawdownPercent! <= 10
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {indicators.drawdownAvailable && indicators.maxDrawdownPercent! <= 10 ? <CheckCircle2 className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                  {!indicators.drawdownAvailable ? 'Awaiting Historical Equity' : indicators.maxDrawdownPercent! <= 10 ? 'Risk Contained (<=10%)' : 'High Drawdown (>10%)'}
                </span>
              </td>
            </tr>

            {/* 18. Recovery Factor */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Recovery Factor (Net P&amp;L / Max Drawdown)
                </div>
                <div className="text-[11px] text-slate-400">Measures ability of system to generate profits relative to drawdown depth</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-cyan-300">
                {indicators.recoveryFactor === null ? 'N/A' : `${formatRatio(indicators.recoveryFactor)}x`}
              </td>
              <td className="py-3 px-4 text-slate-300">Target: &gt; 2.0x</td>
              <td className="py-3 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indicators.recoveryFactor === null
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : indicators.recoveryFactor >= 2
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {indicators.recoveryFactor === null ? 'Awaiting Historical Equity' : indicators.recoveryFactor >= 2 ? 'Resilient Edge (>2.0x)' : 'Moderate Resilience'}
                </span>
              </td>
            </tr>

            {/* 19. Average Holding Days */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Average Holding Duration
                </div>
                <div className="text-[11px] text-slate-400">Mean calendar duration from purchase to sale</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-white">
                {indicators.avgHoldDays} Days
              </td>
              <td className="py-3 px-4 text-slate-300">Swing Strategy: 1 &ndash; 14 Days</td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <Clock className="w-3 h-3" /> Short-Term Swing Cycle
                </span>
              </td>
            </tr>

            {/* 20. Total Brokerage Fees */}
            <tr className="transition">
              <td className="py-3 px-4">
                <div className="font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  Total Brokerage Commissions Paid
                </div>
                <div className="text-[11px] text-slate-400">Execution friction &amp; exchange levies incurred on completed trades</div>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-sm text-amber-400">
                {formatEgp(indicators.totalFees)} EGP
              </td>
              <td className="py-3 px-4 text-slate-300">Friction Rate: ~0.15% per leg</td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Info className="w-3 h-3" /> Fully Accounted
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Footer Note */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800 font-sans">
        <span>* All calculations account for buy/sell brokerage fees and real EGX settlement execution.</span>
        <span>Filter applied: {timeframe === 'ALL' ? 'Entire Trading History' : timeframe} ({indicators.totalClosed} closed trades)</span>
      </div>
      </MotionSwap>
    </div>
  );
};

export const TradingPerformanceReport = React.memo(TradingPerformanceReportComponent);
