import React, { useState, useMemo } from 'react';
import { PerformanceStats, ClosedTrade, Position, PortfolioMetrics } from '../types';
import { RealizedTrajectoryChart } from './RealizedTrajectoryChart';
import { TradingPerformanceReport } from './reports/TradingPerformanceReport';
import { MonthlyPerformanceReport } from './reports/MonthlyPerformanceReport';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Target, 
  Clock, 
  Percent, 
  PieChart as PieChartIcon, 
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Info,
  Sliders,
  DollarSign,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  Scale,
  FileText,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

interface PerformanceReportsProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance?: number;
}

// Harmonious, distinct color palettes for pie slices
const SECTOR_COLORS = [
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
];

const STOCK_COLORS = [
  '#38bdf8', // sky-400
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
  '#fb923c', // orange-400
  '#a3e635', // lime-400
  '#64748b', // slate-500
];

export const PerformanceReports: React.FC<PerformanceReportsProps> = ({
  stats,
  closedTrades,
  positions,
  metrics,
  cashBalance = 0,
}) => {
  const [trajectoryMode, setTrajectoryMode] = useState<'cumulative' | 'discrete'>('cumulative');
  const [allocationTab, setAllocationTab] = useState<'sector' | 'stock'>('sector');
  const [includeCashInStockPie, setIncludeCashInStockPie] = useState<boolean>(true);
  const [waterfallMode, setWaterfallMode] = useState<'capital' | 'closed_positions'>('capital');
  const [capitalScaleMode, setCapitalScaleMode] = useState<'full' | 'zoom'>('full');
  const [closedScaleMode, setClosedScaleMode] = useState<'full' | 'zoom'>('zoom');
  const [hoveredCapitalStep, setHoveredCapitalStep] = useState<number | null>(null);
  const [hoveredClosedStep, setHoveredClosedStep] = useState<number | null>(null);

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // 1. Prepare Realized P&L Trajectory Data (Chronologically sorted by sellDate)
  const trajectoryData = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => {
      const dateA = a.sellDate || '2026-01-01';
      const dateB = b.sellDate || '2026-01-01';
      return dateA.localeCompare(dateB);
    });

    let runningCumulative = 0;
    const points = [
      {
        index: 0,
        tradeLabel: 'Inception',
        date: 'Start',
        ticker: 'PORTFOLIO',
        companyName: 'Baseline Inception',
        tradePnl: 0,
        tradePercent: 0,
        cumulativePnl: 0,
        fees: 0,
        outcome: 'START',
      },
    ];

    sorted.forEach((trade, idx) => {
      runningCumulative += trade.realizedPnlEgp;
      points.push({
        index: idx + 1,
        tradeLabel: `#${idx + 1} ${trade.ticker}`,
        date: trade.sellDate || `Trade ${idx + 1}`,
        ticker: trade.ticker,
        companyName: trade.companyName,
        tradePnl: trade.realizedPnlEgp,
        tradePercent: trade.realizedPnlPercent,
        cumulativePnl: runningCumulative,
        fees: trade.totalFees || 0,
        outcome: trade.outcome,
      });
    });

    return points;
  }, [closedTrades]);

  // 2. Prepare Sector Allocation Data for Pie Chart
  const sectorPieData = useMemo(() => {
    let totalValue = 0;
    const sectorMap: Record<string, { value: number; count: number }> = {};

    positions.forEach((pos) => {
      const val = pos.shares * pos.currentPrice;
      totalValue += val;
      if (!sectorMap[pos.sector]) {
        sectorMap[pos.sector] = { value: 0, count: 0 };
      }
      sectorMap[pos.sector].value += val;
      sectorMap[pos.sector].count += 1;
    });

    return Object.entries(sectorMap)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  // 3. Prepare Active Stock Allocation Data for Pie Chart
  const stockPieData = useMemo(() => {
    const totalEquitiesValue = positions.reduce((acc, p) => acc + p.shares * p.currentPrice, 0);
    const denominator = includeCashInStockPie ? totalEquitiesValue + cashBalance : totalEquitiesValue;

    const list = positions.map((p) => {
      const val = p.shares * p.currentPrice;
      return {
        name: p.ticker,
        fullName: p.companyName,
        sector: p.sector,
        shares: p.shares,
        value: val,
        percentage: denominator > 0 ? (val / denominator) * 100 : 0,
        isCash: false,
      };
    });

    if (includeCashInStockPie && cashBalance > 0) {
      list.push({
        name: 'CASH',
        fullName: 'Egyptian Pounds Liquid Balance',
        sector: 'Liquid Buying Power',
        shares: 1,
        value: cashBalance,
        percentage: denominator > 0 ? (cashBalance / denominator) * 100 : 0,
        isCash: true,
      });
    }

    return list.sort((a, b) => b.value - a.value);
  }, [positions, cashBalance, includeCashInStockPie]);

  // 4. Net Profit and Net Loss Calculations
  const grossNetProfit = stats.totalRealizedGainEgp || 0;
  const grossNetLoss = stats.totalRealizedLossEgp || 0;
  const netRealizedPnl = grossNetProfit - grossNetLoss;
  const totalOpenFees = positions.reduce((acc, p) => acc + (p.totalFees || 0), 0);
  const totalClosedFees = stats.totalBrokerageFeesPaid || 0;
  const totalAllCommissions = totalClosedFees + totalOpenFees;
  const netRealizedAfterFees = netRealizedPnl; // Closed trades already deduct allocated fees

  // Segregate winning and losing closed trades for gross P&L calculations
  const winningTradesList = useMemo(() => closedTrades.filter((t) => t.outcome === 'WIN'), [closedTrades]);
  const losingTradesList = useMemo(() => closedTrades.filter((t) => t.outcome === 'LOSS'), [closedTrades]);

  // Gross profit and loss before fees so the dedicated Trading Fees step accurately represents commissions without double-counting
  const grossRealizedGain = useMemo(
    () => winningTradesList.reduce((acc, t) => acc + t.realizedPnlEgp + (t.totalFees || 0), 0),
    [winningTradesList]
  );
  const grossRealizedLoss = useMemo(
    () => losingTradesList.reduce((acc, t) => acc + Math.max(0, Math.abs(t.realizedPnlEgp) - (t.totalFees || 0)), 0),
    [losingTradesList]
  );

  // 5. Portfolio Equity Capital Formation & Stepped P&L Bridge (Waterfall Data)
  const waterfallData = useMemo(() => {
    const costBasis = metrics?.totalCost || positions.reduce((acc, p) => acc + p.shares * p.avgBuyPrice, 0);
    const unrealizedPnl = metrics?.unrealizedPnlEgp ?? positions.reduce((acc, p) => acc + p.shares * (p.currentPrice - p.avgBuyPrice), 0);
    const endingEquity = metrics?.totalValue ?? (costBasis + unrealizedPnl + cashBalance);

    // Initial Capital: Starting portfolio capital base before realized trade performance, commissions, and active floating gains
    // Formula: Initial Capital + Gross Realized Gains - Gross Realized Losses - Total Trading Fees + Unrealized P&L = Total Capital Now + Realized
    const computedInitialCapital = endingEquity - (grossRealizedGain - grossRealizedLoss - totalAllCommissions) - unrealizedPnl;
    const initialCapital = Math.max(0, computedInitialCapital);

    let currentLevel = initialCapital;

    const steps = [
      {
        step: 0,
        name: 'Initial Capital',
        category: 'base' as const,
        start: 0,
        delta: initialCapital,
        end: initialCapital,
        isTotal: true,
        description: 'Starting portfolio capital base before closed trade returns and active market gains',
        color: '#3b82f6', // blue
      },
      {
        step: 1,
        name: 'Realized Gains',
        category: 'gain' as const,
        start: currentLevel,
        delta: grossRealizedGain,
        end: (currentLevel += grossRealizedGain),
        isTotal: false,
        description: `Gross profit booked across ${winningTradesList.length} winning closed trades`,
        color: '#10b981', // emerald
      },
      {
        step: 2,
        name: 'Realized Losses',
        category: 'loss' as const,
        start: currentLevel,
        delta: -grossRealizedLoss,
        end: (currentLevel -= grossRealizedLoss),
        isTotal: false,
        description: `Gross loss absorbed across ${losingTradesList.length} losing closed trades`,
        color: '#f43f5e', // rose
      },
      {
        step: 3,
        name: 'Trading Fees',
        category: 'fees' as const,
        start: currentLevel,
        delta: -totalAllCommissions,
        end: (currentLevel -= totalAllCommissions),
        isTotal: false,
        description: totalAllCommissions > 0
          ? 'Total broker commissions, EGX tariffs, and transaction taxes paid across trades'
          : 'No brokerage commissions or transaction taxes recorded',
        color: '#f59e0b', // amber
      },
      {
        step: 4,
        name: 'Unrealized P&L',
        category: (unrealizedPnl >= 0 ? 'gain' : 'loss') as 'gain' | 'loss',
        start: currentLevel,
        delta: unrealizedPnl,
        end: (currentLevel += unrealizedPnl),
        isTotal: false,
        description: 'Mark-to-market floating gain/loss on currently active stock positions',
        color: unrealizedPnl >= 0 ? '#34d399' : '#fb7185',
      },
      {
        step: 5,
        name: 'Total Capital Now + Realized',
        category: 'total' as const,
        start: 0,
        delta: endingEquity,
        end: endingEquity,
        isTotal: true,
        description: 'Current Net Asset Value (NAV): Active stock market value + Liquid cash, including all realized P&L',
        color: '#8b5cf6', // violet
      },
    ];

    // Scaling bounds for Full Scale (0 to NAV)
    const allLevels = [0, ...steps.flatMap((s) => [s.start, s.end])];
    const minVal = Math.min(...allLevels);
    const maxVal = Math.max(...allLevels);
    const fullSpan = Math.max(maxVal - minVal, 1000);
    const fullYMin = minVal < 0 ? minVal - fullSpan * 0.05 : 0;
    const fullYMax = maxVal + fullSpan * 0.22;
    const fullYRange = Math.max(fullYMax - fullYMin, 100);

    // Scaling bounds for P&L Bridge Zoom (magnifying the gain/loss bridge steps)
    const bridgeLevels = steps.filter((s) => !s.isTotal).flatMap((s) => [s.start, s.end]);
    const bridgeMin = Math.min(...(bridgeLevels.length > 0 ? bridgeLevels : allLevels));
    const bridgeMax = Math.max(...(bridgeLevels.length > 0 ? bridgeLevels : allLevels));
    const bridgeSpan = Math.max(bridgeMax - bridgeMin, 500);
    const zoomYMin = Math.max(0, bridgeMin - bridgeSpan * 0.25);
    const zoomYMax = bridgeMax + bridgeSpan * 0.28;
    const zoomYRange = Math.max(zoomYMax - zoomYMin, 100);

    return {
      steps,
      initialCapital,
      costBasis,
      endingEquity,
      grossRealizedGain,
      grossRealizedLoss,
      totalAllCommissions,
      unrealizedPnl,
      fullScale: { yMin: fullYMin, yMax: fullYMax, yRange: fullYRange },
      zoomScale: { yMin: zoomYMin, yMax: zoomYMax, yRange: zoomYRange },
      maxVal,
    };
  }, [metrics, positions, grossRealizedGain, grossRealizedLoss, totalAllCommissions, cashBalance, winningTradesList.length, losingTradesList.length]);

  // 5b. Closed Positions Stepped P&L Waterfall Data (Trade-by-trade steps)
  const closedPositionsWaterfallData = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => {
      const dateA = a.sellDate || '2026-01-01';
      const dateB = b.sellDate || '2026-01-01';
      return dateA.localeCompare(dateB);
    });

    const initialCapital = waterfallData.initialCapital;
    const endingEquity = waterfallData.endingEquity;
    const costBasis = waterfallData.costBasis;

    type StepCategory = 'gain' | 'loss' | 'total' | 'base';

    interface WaterfallStepItem {
      stepNumber: number;
      ticker: string;
      companyName: string;
      sellDate: string;
      buyDate: string;
      holdingDays: number;
      shares: number;
      outcome: 'WIN' | 'LOSS';
      category: StepCategory;
      start: number;
      delta: number;
      end: number;
      percent: number;
      fees: number;
      isTotal: boolean;
      color: string;
      description: string;
    }

    const steps: WaterfallStepItem[] = [];

    // Step 0: Initial Capital (Same as in Capital Formation)
    steps.push({
      stepNumber: 0,
      ticker: 'INITIAL CAPITAL',
      companyName: 'Initial Capital',
      sellDate: 'Baseline Capital',
      buyDate: '',
      holdingDays: 0,
      shares: 0,
      outcome: 'WIN',
      category: 'base',
      start: 0,
      delta: initialCapital,
      end: initialCapital,
      percent: 0,
      fees: 0,
      isTotal: true,
      color: '#3b82f6',
      description: 'Starting portfolio capital base before closed trade returns and active market gains',
    });

    let runningLevel = initialCapital;

    // Intermediate Trade Steps
    sorted.forEach((trade, idx) => {
      const start = runningLevel;
      const delta = trade.realizedPnlEgp;
      const end = runningLevel + delta;
      runningLevel = end;
      const isWin = delta >= 0;

      steps.push({
        stepNumber: idx + 1,
        ticker: trade.ticker,
        companyName: trade.companyName,
        sellDate: trade.sellDate || `Trade ${idx + 1}`,
        buyDate: trade.buyDate,
        holdingDays: trade.holdingDays,
        shares: trade.shares,
        outcome: trade.outcome,
        category: isWin ? 'gain' : 'loss',
        start,
        delta,
        end,
        percent: trade.realizedPnlPercent,
        fees: trade.totalFees || 0,
        isTotal: false,
        color: isWin ? '#10b981' : '#f43f5e',
        description: `${trade.outcome === 'WIN' ? 'Profit' : 'Loss'} closed on ${trade.ticker} (${trade.realizedPnlPercent >= 0 ? '+' : ''}${trade.realizedPnlPercent.toFixed(1)}%)`,
      });
    });

    // Bridge step for Active Open Positions Unrealized P&L if positions exist
    const remainingToEndingEquity = endingEquity - runningLevel;
    if (Math.abs(remainingToEndingEquity) >= 1) {
      const isPositive = remainingToEndingEquity >= 0;
      const start = runningLevel;
      const delta = remainingToEndingEquity;
      const end = endingEquity;
      runningLevel = end;

      steps.push({
        stepNumber: steps.length,
        ticker: 'OPEN POSITIONS',
        companyName: 'Active Unrealized P&L',
        sellDate: 'Active Holdings',
        buyDate: '',
        holdingDays: 0,
        shares: positions.reduce((acc, p) => acc + p.shares, 0),
        outcome: isPositive ? 'WIN' : 'LOSS',
        category: isPositive ? 'gain' : 'loss',
        start,
        delta,
        end,
        percent: costBasis > 0 ? (delta / costBasis) * 100 : 0,
        fees: 0,
        isTotal: false,
        color: isPositive ? '#34d399' : '#fb7185',
        description: 'Mark-to-market floating gain/loss on currently open stock positions',
      });
    }

    // Final Pillar: Total Capital Now + Realized (Same as in Capital Formation)
    steps.push({
      stepNumber: steps.length,
      ticker: 'TOTAL CAPITAL',
      companyName: 'Total Capital Now + Realized',
      sellDate: 'Current NAV',
      buyDate: '',
      holdingDays: stats.avgHoldDays,
      shares: 0,
      outcome: endingEquity >= initialCapital ? 'WIN' : 'LOSS',
      category: 'total',
      start: 0,
      delta: endingEquity,
      end: endingEquity,
      percent: initialCapital > 0 ? ((endingEquity - initialCapital) / initialCapital) * 100 : 0,
      fees: stats.totalBrokerageFeesPaid,
      isTotal: true,
      color: '#8b5cf6',
      description: 'Current Net Asset Value (NAV): Active stock market value + Liquid cash, including all realized P&L',
    });

    // Scaling bounds for Full Scale (0 to NAV)
    const allLevels = [0, ...steps.flatMap((s) => [s.start, s.end])];
    const minVal = Math.min(...allLevels);
    const maxVal = Math.max(...allLevels);
    const fullSpan = Math.max(maxVal - minVal, 1000);
    const fullYMin = minVal < 0 ? minVal - fullSpan * 0.05 : 0;
    const fullYMax = maxVal + fullSpan * 0.22; // 22% headroom ensures labels above the tallest bars never get clipped
    const fullYRange = Math.max(fullYMax - fullYMin, 100);

    // Scaling bounds for P&L Bridge Zoom (magnifying the trade gain/loss bridge steps)
    const bridgeLevels = steps.filter((s) => !s.isTotal).flatMap((s) => [s.start, s.end]);
    const bridgeMin = Math.min(...(bridgeLevels.length > 0 ? bridgeLevels : [initialCapital, endingEquity]));
    const bridgeMax = Math.max(...(bridgeLevels.length > 0 ? bridgeLevels : [initialCapital, endingEquity]));
    const bridgeSpan = Math.max(bridgeMax - bridgeMin, 500);
    const zoomYMin = Math.max(0, bridgeMin - bridgeSpan * 0.25);
    const zoomYMax = bridgeMax + bridgeSpan * 0.28;
    const zoomYRange = Math.max(zoomYMax - zoomYMin, 100);

    return {
      steps,
      initialCapital,
      endingEquity,
      finalTotal: endingEquity,
      netRealized: grossNetProfit - grossNetLoss,
      minVal,
      maxVal,
      fullScale: { yMin: fullYMin, yMax: fullYMax, yRange: fullYRange },
      zoomScale: { yMin: zoomYMin, yMax: zoomYMax, yRange: zoomYRange },
      yMin: fullYMin,
      yMax: fullYMax,
      yRange: fullYRange,
    };
  }, [closedTrades, stats, waterfallData, positions, grossNetProfit, grossNetLoss]);

  // 6. Monthly Realized P&L (preserves existing monthly breakdown)
  const monthlyPnl: Record<string, { gain: number; count: number; fees: number }> = {};
  closedTrades.forEach((trade) => {
    const month = trade.sellDate ? trade.sellDate.slice(0, 7) : '2026-07';
    if (!monthlyPnl[month]) {
      monthlyPnl[month] = { gain: 0, count: 0, fees: 0 };
    }
    monthlyPnl[month].gain += trade.realizedPnlEgp;
    monthlyPnl[month].fees += trade.totalFees || 0;
    monthlyPnl[month].count += 1;
  });

  const sortedMonths = Object.keys(monthlyPnl).sort();

  return (
    <div className="space-y-6">
      {/* Top Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Trading Performance &amp; Analytical Reports
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            P&amp;L trajectories, asset allocation pie charts, net profit &amp; loss analysis, and portfolio equity capital formation waterfall bridge.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold border border-slate-700">
            Total Closed Trades: {stats.totalTrades}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 font-semibold border border-slate-700">
            Win Rate: {stats.winRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* SECTION A: NET PROFIT AND NET LOSS BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Gross Realized Gains (Winners) */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              Gross Realized Gains
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              {stats.winningTrades} Winning Trades
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-emerald-400 font-mono">
              +{formatEgp(grossNetProfit)}
            </span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Largest Win:</span>
            <span className="font-mono font-bold text-emerald-400">+{stats.bestTradePercent.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 w-full h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${
                  grossNetProfit + grossNetLoss > 0
                    ? (grossNetProfit / (grossNetProfit + grossNetLoss)) * 100
                    : 100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Gross Realized Losses (Losses) */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4" />
              Gross Realized Losses
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
              {stats.losingTrades} Losing Trades
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-rose-400 font-mono">
              -{formatEgp(grossNetLoss)}
            </span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Max Drawdown Trade:</span>
            <span className="font-mono font-bold text-rose-400">{stats.worstTradePercent.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 w-full h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-rose-500"
              style={{
                width: `${
                  grossNetProfit + grossNetLoss > 0
                    ? (grossNetLoss / (grossNetProfit + grossNetLoss)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Total Realized Net P&L */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Total Net Realized P&amp;L
            </span>
            <span className="text-[10px] text-slate-400">Profit - Loss</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black tracking-tight font-mono ${
                netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netRealizedPnl >= 0 ? '+' : ''}{formatEgp(netRealizedPnl)}
            </span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Profit Factor:</span>
            <span className="font-mono font-bold text-amber-400">{stats.profitFactor.toFixed(2)}x</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 truncate">
            Avg Closed Trade ROI: <strong className="text-slate-300 font-mono">{stats.avgReturnPercent >= 0 ? '+' : ''}{stats.avgReturnPercent.toFixed(2)}%</strong>
          </div>
        </div>

        {/* Brokerage Commissions & Friction */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Receipt className="w-4 h-4" />
              Commissions &amp; Fees
            </span>
            <span className="text-[10px] text-slate-400">Brokers &amp; EGX</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-amber-400 font-mono">
              {formatEgp(totalAllCommissions)}
            </span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Closed Trades Fees:</span>
            <span className="font-mono font-medium text-slate-200">{formatEgp(totalClosedFees)} EGP</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Active Open Fees:</span>
            <span className="font-mono font-medium text-slate-300">{formatEgp(totalOpenFees)} EGP</span>
          </div>
        </div>
      </div>

      {/* SECTION B: TRADING PERFORMANCE INDICATORS & BENCHMARK SCORECARD (REPORT 1) */}
      <TradingPerformanceReport
        stats={stats}
        closedTrades={closedTrades}
        positions={positions}
        cashBalance={cashBalance || 0}
      />

      {/* SECTION C: REALIZED P&L GAIN/LOSS TRAJECTORY GRAPH */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Realized P&amp;L Gain / Loss Trajectory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical equity growth trajectory of closed trades over time (in EGP)
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setTrajectoryMode('cumulative')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                trajectoryMode === 'cumulative'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cumulative Growth Curve
            </button>
            <button
              onClick={() => setTrajectoryMode('discrete')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                trajectoryMode === 'discrete'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trade-by-Trade Returns
            </button>
          </div>
        </div>

        {/* Trajectory Key Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Total Closed Gain</span>
            <span className={`font-mono font-bold ${netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netRealizedPnl >= 0 ? '+' : ''}{formatEgp(netRealizedPnl)} EGP
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Peak High-Water Mark</span>
            <span className="font-mono font-bold text-cyan-400">
              +{formatEgp(Math.max(...trajectoryData.map((d) => d.cumulativePnl), 0))} EGP
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Trades Closed</span>
            <span className="font-mono font-bold text-slate-200">
              {closedTrades.length} trades ({stats.winningTrades}W / {stats.losingTrades}L)
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Average Holding Duration</span>
            <span className="font-mono font-bold text-purple-400">
              {stats.avgHoldDays} trading days
            </span>
          </div>
        </div>

        {/* Trajectory Plot Points Guide (for Cumulative Growth Mode) */}
        {trajectoryMode === 'cumulative' && (
          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 px-1">
            <span className="text-slate-500">Each trade is plotted as an interactive milestone point on the growth curve:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900" />
                <span className="text-slate-300 font-medium">Winning Trade</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" />
                <span className="text-slate-300 font-medium">Losing Trade</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-900" />
                <span className="text-slate-400 font-medium">Inception</span>
              </span>
            </div>
          </div>
        )}

        {/* Recharts Trajectory Plot */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {trajectoryMode === 'cumulative' ? (
              <AreaChart data={trajectoryData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="pnlGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="tradeLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}${(val / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      if (data.outcome === 'START') {
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs text-slate-200">
                            <p className="font-bold text-white">Portfolio Inception</p>
                            <p className="text-slate-400 text-[11px]">Zero baseline</p>
                          </div>
                        );
                      }
                      const isPositive = data.tradePnl >= 0;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                            <span className="font-bold text-white">{data.ticker}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                isPositive
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {data.outcome}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] truncate">{data.companyName}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Trade P&amp;L:</span>
                            <span className={`font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{formatEgp(data.tradePnl)} EGP ({isPositive ? '+' : ''}{data.tradePercent?.toFixed(2)}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Cumulative Realized:</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {data.cumulativePnl >= 0 ? '+' : ''}{formatEgp(data.cumulativePnl)} EGP
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <span>Closed: {data.date}</span>
                            {data.fees > 0 && <span>Fee: {formatEgp(data.fees)}</span>}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePnl"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pnlGrowthGrad)"
                  dot={(dotProps: any) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (typeof cx !== 'number' || typeof cy !== 'number') return null;
                    const isStart = payload?.outcome === 'START';
                    const isWin = (payload?.tradePnl ?? 0) >= 0;
                    const fill = isStart ? '#94a3b8' : isWin ? '#10b981' : '#f43f5e';
                    return (
                      <circle
                        key={`traj-dot-${index}-${payload?.ticker || 'pt'}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill={fill}
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 6.5, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={trajectoryData.filter((d) => d.outcome !== 'START')} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="tradeLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}${(val / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isPositive = data.tradePnl >= 0;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[190px]">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>{data.ticker}</span>
                            <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? '+' : ''}{formatEgp(data.tradePnl)} EGP
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px]">{data.companyName}</p>
                          <div className="text-[11px] text-slate-400 flex justify-between">
                            <span>Return:</span>
                            <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? '+' : ''}{data.tradePercent?.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1">
                            Closed on {data.date}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="tradePnl" radius={[4, 4, 0, 0]}>
                  {trajectoryData.filter((d) => d.outcome !== 'START').map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.tradePnl >= 0 ? '#10b981' : '#f43f5e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION C: ALLOCATION PIE CHARTS (SECTOR & ACTIVE STOCK) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-cyan-400" />
              Portfolio Allocation &amp; Diversification Analysis
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive pie charts showing capital concentration across EGX sectors and active stock holdings
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setAllocationTab('sector')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  allocationTab === 'sector'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EGX Sectors
              </button>
              <button
                onClick={() => setAllocationTab('stock')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  allocationTab === 'stock'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active Stock Holdings
              </button>
            </div>

            {allocationTab === 'stock' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <input
                  type="checkbox"
                  checked={includeCashInStockPie}
                  onChange={(e) => setIncludeCashInStockPie(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Include Cash ({formatEgp(cashBalance)} EGP)</span>
              </label>
            )}
          </div>
        </div>

        {/* Display Area: Allocation Pie Charts & Ranked Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
          {/* Pie Chart Canvas */}
          <div className="lg:col-span-6 h-72 w-full flex items-center justify-center">
            {allocationTab === 'sector' ? (
              sectorPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {sectorPieData.map((entry, index) => (
                        <Cell
                          key={`sector-cell-${index}`}
                          fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
                          stroke="#0f172a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-white">{data.name}</p>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">Market Value:</span>
                                <span className="font-mono font-bold text-cyan-400">{formatEgp(data.value)} EGP</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">Allocation:</span>
                                <span className="font-mono font-bold text-emerald-400">{data.percentage.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px]">
                                <span>Active Positions:</span>
                                <span className="font-mono text-slate-200">{data.count} stocks</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-400 text-center py-12">No active positions to plot.</div>
              )
            ) : (
              stockPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stockPieData.map((entry, index) => (
                        <Cell
                          key={`stock-cell-${index}`}
                          fill={STOCK_COLORS[index % STOCK_COLORS.length]}
                          stroke="#0f172a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[200px]">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white text-sm">{data.name}</span>
                                <span className="font-mono font-bold text-emerald-400">{data.percentage.toFixed(1)}%</span>
                              </div>
                              <p className="text-slate-400 text-[11px] truncate">{data.fullName}</p>
                              <div className="flex items-center justify-between gap-4 pt-1">
                                <span className="text-slate-400">Value:</span>
                                <span className="font-mono font-bold text-blue-400">{formatEgp(data.value)} EGP</span>
                              </div>
                              {!data.isCash && (
                                <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px]">
                                  <span>Shares Owned:</span>
                                  <span className="font-mono text-slate-200">{data.shares.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-400 text-center py-12">No active stock holdings.</div>
              )
            )}
          </div>

          {/* Accompanying Ranked Table / Legend */}
          <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto pr-1">
            {allocationTab === 'sector' ? (
              sectorPieData.map((sec, idx) => (
                <div
                  key={sec.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-200 truncate">{sec.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-slate-300">{formatEgp(sec.value)} EGP</span>
                    <span className="font-mono font-bold text-cyan-400 w-12 text-right">
                      {sec.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              stockPieData.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{item.name}</span>
                        {item.isCash && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300">
                            Cash
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block max-w-[150px] sm:max-w-[200px]">
                        {item.fullName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-slate-300">{formatEgp(item.value)} EGP</span>
                    <span className="font-mono font-bold text-blue-400 w-12 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION D: WATERFALL STYLE GRAPH - PORTFOLIO EQUITY CAPITAL FORMATION & CLOSED POSITIONS STEPPED P&L */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              {waterfallMode === 'capital'
                ? 'Portfolio Equity Capital Formation & Stepped P&L Bridge'
                : 'Closed Positions Stepped P&L Waterfall Bridge'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {waterfallMode === 'capital'
                ? 'Waterfall bridge demonstrating how initial cost basis steps through realized gains, losses, fees, unrealized P&L, and cash to formulate current total portfolio equity'
                : 'Stepped waterfall converting closed positions into sequential steps, demonstrating how each individual trade impacted cumulative realized P&L'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setWaterfallMode('capital')}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  waterfallMode === 'capital'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Capital Formation
              </button>
              <button
                onClick={() => setWaterfallMode('closed_positions')}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  waterfallMode === 'closed_positions'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Closed Positions Steps
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/30 text-purple-200 font-mono">
                  {closedTrades.length}
                </span>
              </button>
            </div>

            {/* Quick Metrics Badge */}
            {waterfallMode === 'capital' ? (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                  Initial Capital: <strong className="text-white font-mono">{formatEgp(waterfallData.initialCapital)} EGP</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-purple-300">
                  Total Capital Now + Realized: <strong className="text-white font-mono">{formatEgp(waterfallData.endingEquity)} EGP</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                  Initial Capital: <strong className="text-white font-mono">{formatEgp(waterfallData.initialCapital)} EGP</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-purple-300">
                  Total Capital Now + Realized: <strong className="text-white font-mono">{formatEgp(waterfallData.endingEquity)} EGP</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* VIEW 1: Portfolio Capital Formation Waterfall Bridge */}
        {waterfallMode === 'capital' ? (
          <>
            {/* Interactive Step Inspector & Scale Toggle Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              {(() => {
                const activeStep = hoveredCapitalStep !== null ? waterfallData.steps[hoveredCapitalStep] : null;
                return (
                  <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs min-h-[42px] transition-all">
                    {activeStep ? (
                      <>
                        <div className="flex items-center gap-2 truncate mr-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: activeStep.color }} />
                          <span className="font-bold text-white">{activeStep.name}</span>
                          <span className="text-slate-400 text-[11px] hidden sm:inline truncate">— {activeStep.description}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px]">Impact:</span>
                            <span className={`font-bold ${activeStep.isTotal ? 'text-white' : activeStep.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {activeStep.isTotal ? '' : activeStep.delta >= 0 ? '+' : ''}{formatEgp(activeStep.delta)} EGP
                            </span>
                          </div>
                          {!activeStep.isTotal && (
                            <div className="hidden md:flex items-center gap-1 text-slate-400 text-[10px]">
                              <span>Level:</span>
                              <span className="text-cyan-300 font-bold">{formatEgp(activeStep.end)} EGP</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full text-slate-400 text-[11px]">
                        <span>Hover over any step to inspect its capital formation impact</span>
                        <span className="font-mono text-purple-300 font-medium">
                          Ending Capital: {formatEgp(waterfallData.endingEquity)} EGP
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Scale Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-end sm:self-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCapitalScaleMode('full')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                    capitalScaleMode === 'full'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Scale from 0 EGP to full Net Asset Value"
                >
                  Full Scale (from 0)
                </button>
                <button
                  type="button"
                  onClick={() => setCapitalScaleMode('zoom')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                    capitalScaleMode === 'zoom'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Magnify the P&L bridge to highlight step gains and losses"
                >
                  P&L Bridge Zoom
                </button>
              </div>
            </div>

            {/* Stepped Waterfall Chart Container */}
            <div className="overflow-x-auto pt-2 pb-2">
              <div className="min-w-[700px] sm:min-w-full space-y-2">
                {(() => {
                  const activeScale = capitalScaleMode === 'full' ? waterfallData.fullScale : waterfallData.zoomScale;
                  const { yMin, yRange } = activeScale;
                  const valToPercent = (v: number) => Math.max(0, Math.min(100, ((v - yMin) / yRange) * 76 + 2));

                  return (
                    <>
                      {/* Fixed-height Plot Canvas (Bars, Badges, Connectors, Zero Baseline) */}
                      <div className="relative h-64 sm:h-72 w-full pt-8 pb-1 px-3">
                        {/* Zero Reference Baseline */}
                        {yMin <= 0 && (
                          <div
                            className="absolute left-0 right-0 border-t border-dashed border-slate-700/70 pointer-events-none z-0 flex items-center justify-end pr-2"
                            style={{ bottom: `${valToPercent(0)}%` }}
                          >
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                              0 EGP
                            </span>
                          </div>
                        )}

                        {/* Pixel-Perfect Mathematical SVG Connector Lines (Anchored directly to bar top/bottom edges) */}
                        <svg className="absolute top-8 bottom-1 left-3 right-3 pointer-events-none z-0">
                          {waterfallData.steps.slice(0, -1).map((step, i) => {
                            const x1 = ((i + 0.5) / waterfallData.steps.length) * 100;
                            const x2 = ((i + 1.5) / waterfallData.steps.length) * 100;
                            const y = 100 - valToPercent(step.end);
                            return (
                              <line
                                key={`capital-conn-${i}`}
                                x1={`${x1}%`}
                                y1={`${y}%`}
                                x2={`${x2}%`}
                                y2={`${y}%`}
                                stroke="#64748b"
                                strokeWidth="1.5"
                                strokeDasharray="4,4"
                                opacity="0.85"
                              />
                            );
                          })}
                        </svg>

                        {/* Stepped Columns */}
                        <div className="w-full h-full flex items-stretch justify-between relative z-10 gap-2 sm:gap-3">
                          {waterfallData.steps.map((step, idx) => {
                            const isPositiveDelta = step.delta >= 0;
                            const isHovered = hoveredCapitalStep === idx;
                            const minBarPercent = 3.5;

                            let barBottom = 0;
                            let barHeight = 0;
                            let visualTop = 0;

                            if (step.isTotal) {
                              // Pillar starting from 0 up to total value
                              const baseBottom = valToPercent(yMin <= 0 ? 0 : yMin);
                              const naturalTop = valToPercent(step.end);
                              barBottom = baseBottom;
                              barHeight = Math.max(minBarPercent, naturalTop - barBottom);
                              visualTop = naturalTop;
                            } else if (step.delta === 0) {
                              // Zero delta step - flat line
                              const naturalLevel = valToPercent(step.start);
                              barBottom = Math.max(0, naturalLevel - 0.5);
                              barHeight = 1.2;
                              visualTop = naturalLevel;
                            } else if (isPositiveDelta) {
                              // Positive gain: steps UP from start to end
                              barBottom = valToPercent(step.start);
                              const naturalTop = valToPercent(step.end);
                              barHeight = Math.max(minBarPercent, naturalTop - barBottom);
                              visualTop = naturalTop;
                            } else {
                              // Negative loss: steps DOWN from start to end
                              const naturalTop = valToPercent(step.start);
                              const naturalBottom = valToPercent(step.end);
                              barHeight = Math.max(minBarPercent, naturalTop - naturalBottom);
                              barBottom = naturalTop - barHeight;
                              visualTop = naturalTop;
                            }

                            return (
                              <div
                                key={`capital-step-${step.step}-${step.name}`}
                                onMouseEnter={() => setHoveredCapitalStep(idx)}
                                onMouseLeave={() => setHoveredCapitalStep(null)}
                                className="flex-1 flex flex-col justify-end items-center relative h-full group cursor-pointer"
                              >
                                {/* Tooltip Overlay */}
                                <div
                                  className={`absolute top-0 z-30 hidden group-hover:flex flex-col bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-2xl backdrop-blur-md text-[11px] w-48 sm:w-56 pointer-events-none transition-all duration-150
                                    ${idx === 0 ? 'left-0' : idx === waterfallData.steps.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}
                                  `}
                                >
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                                    <span className="font-bold text-white text-xs truncate">{step.name}</span>
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono"
                                      style={{
                                        backgroundColor: `${step.color}25`,
                                        color: step.color,
                                      }}
                                    >
                                      {step.isTotal ? (idx === 0 ? 'START' : 'TOTAL') : step.category}
                                    </span>
                                  </div>
                                  <p className="text-slate-400 text-[10px] leading-relaxed mb-1.5">{step.description}</p>
                                  <div className="border-t border-slate-800/80 pt-1 space-y-0.5 font-mono">
                                    <div className="flex justify-between text-slate-300">
                                      <span className="text-slate-400">Step Delta:</span>
                                      <span className={`font-bold ${step.isTotal ? 'text-white' : isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {step.isTotal ? '' : isPositiveDelta ? '+' : ''}{formatEgp(step.delta)} EGP
                                      </span>
                                    </div>
                                    {!step.isTotal && (
                                      <>
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                          <span>Start Level:</span>
                                          <span className="text-slate-300">{formatEgp(step.start)} EGP</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                          <span>Resulting Level:</span>
                                          <span className="text-cyan-300 font-bold">{formatEgp(step.end)} EGP</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Impact Value Badge positioned strictly ABOVE the bar */}
                                <div
                                  className="absolute text-center w-full px-0.5 pointer-events-none z-20 flex justify-center"
                                  style={{
                                    bottom: `calc(${visualTop}% + 6px)`,
                                  }}
                                >
                                  <span
                                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold leading-none shadow-md backdrop-blur-sm border whitespace-nowrap transition-all duration-150 ${
                                      isHovered ? 'ring-2 ring-white/50 brightness-110 scale-105' : ''
                                    } ${
                                      idx === 0
                                        ? 'bg-blue-950/90 text-blue-300 border-blue-700/60 shadow-blue-950/40'
                                        : step.isTotal
                                        ? 'bg-purple-950/90 text-purple-300 border-purple-700/60 shadow-purple-950/40'
                                        : step.delta === 0
                                        ? 'bg-slate-900/90 text-slate-400 border-slate-700/60 shadow-slate-950/40'
                                        : isPositiveDelta
                                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/40'
                                        : 'bg-rose-950/90 text-rose-300 border-rose-700/60 shadow-rose-950/40'
                                    }`}
                                  >
                                    {step.isTotal
                                      ? formatEgp(step.delta)
                                      : step.delta === 0
                                      ? '0.00'
                                      : `${isPositiveDelta ? '+' : ''}${formatEgp(step.delta)}`}{' '}
                                    <span className="text-[9px] opacity-75 ml-0.5">EGP</span>
                                  </span>
                                </div>

                                {/* Stepped Floating / Pillar Bar */}
                                <div
                                  className={`w-9 sm:w-14 rounded-md transition-all duration-200 shadow-lg relative flex items-center justify-center ${
                                    isHovered
                                      ? 'brightness-125 ring-2 ring-white/50 scale-[1.03] shadow-cyan-900/30'
                                      : 'group-hover:brightness-110'
                                  }`}
                                  style={{
                                    position: 'absolute',
                                    bottom: `${barBottom}%`,
                                    height: `${barHeight}%`,
                                    backgroundColor: step.color,
                                  }}
                                >
                                  <div className="absolute inset-0 bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition" />
                                  {step.delta === 0 && (
                                    <div className="w-full h-0.5 bg-slate-400 rounded-full" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* X-Axis Step Labels Row - Dedicated Bottom Section */}
                      <div className="w-full flex items-start justify-between gap-2 sm:gap-3 pt-2.5 px-3 border-t border-slate-800">
                        {waterfallData.steps.map((step, idx) => (
                          <div
                            key={`label-${step.step}-${step.name}`}
                            onMouseEnter={() => setHoveredCapitalStep(idx)}
                            onMouseLeave={() => setHoveredCapitalStep(null)}
                            className="flex-1 text-center min-w-0 px-0.5 cursor-pointer"
                          >
                            <span
                              className={`text-[10px] sm:text-xs font-semibold block truncate leading-tight transition ${
                                hoveredCapitalStep === idx ? 'text-white font-bold' : 'text-slate-300'
                              }`}
                            >
                              {step.name}
                            </span>
                            <span className="text-[9px] text-slate-400 block font-mono mt-0.5 truncate">
                              {step.isTotal ? (idx === 0 ? 'Start' : 'NAV Total') : `Step ${idx}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Financial Bridge Legend & Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 text-[11px]">
              {waterfallData.steps.map((s, idx) => (
                <div
                  key={`legend-${s.name}`}
                  onMouseEnter={() => setHoveredCapitalStep(idx)}
                  onMouseLeave={() => setHoveredCapitalStep(null)}
                  className={`p-2 rounded-lg bg-slate-950/60 border transition-all cursor-pointer ${
                    hoveredCapitalStep === idx ? 'border-slate-500 bg-slate-900/80 ring-1 ring-white/20' : 'border-slate-800/80'
                  } space-y-0.5`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-semibold text-slate-300 truncate">{s.name}</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-white">
                    {s.isTotal ? '' : s.delta >= 0 ? '+' : ''}{formatEgp(s.delta)} EGP
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {s.isTotal ? (idx === 0 ? 'Base Capital' : 'NAV Target') : `Level: ${formatEgp(s.end)}`}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* VIEW 2: Closed Positions Stepped Waterfall Bridge */
          closedTrades.length === 0 ? (
            <div className="py-14 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
              <Receipt className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No closed positions found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Close active stock positions to generate sequential trade-by-trade stepped waterfall steps.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Controls bar: Scale toggle & description */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="text-xs text-slate-400">
                  Trade-by-trade stepped bridge demonstrating how each closed exit and open position contributed to capital growth:
                </p>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setClosedScaleMode('zoom')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                      closedScaleMode === 'zoom'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Magnify the P&L bridge to highlight step gains and losses"
                  >
                    P&amp;L Bridge Zoom
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosedScaleMode('full')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                      closedScaleMode === 'full'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Scale from 0 EGP to full Net Asset Value"
                  >
                    Full Scale (from 0)
                  </button>
                </div>
              </div>

              {/* Interactive Step Inspector Strip for Closed Positions */}
              {(() => {
                const activeStep = hoveredClosedStep !== null ? closedPositionsWaterfallData.steps[hoveredClosedStep] : null;
                return (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs min-h-[40px] transition-all">
                    {activeStep ? (
                      <>
                        <div className="flex items-center gap-2 truncate mr-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: activeStep.color }} />
                          <span className="font-bold text-white">
                            {activeStep.stepNumber === 0
                              ? 'Initial Capital'
                              : activeStep.isTotal
                              ? 'Total Capital'
                              : activeStep.ticker}
                          </span>
                          <span className="text-slate-400 text-[11px] hidden sm:inline truncate">— {activeStep.companyName}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px]">
                              {activeStep.isTotal
                                ? activeStep.stepNumber === 0
                                ? 'Initial Capital:'
                                : 'Ending Capital:'
                                : activeStep.ticker === 'OPEN POSITIONS'
                                ? 'Unrealized P&L:'
                                : 'Trade P&L:'}
                            </span>
                            <span
                              className={`font-bold ${
                                activeStep.isTotal
                                  ? activeStep.stepNumber === 0
                                    ? 'text-blue-300'
                                    : 'text-purple-300'
                                  : activeStep.delta >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {activeStep.isTotal ? '' : activeStep.delta >= 0 ? '+' : ''}
                              {formatEgp(activeStep.delta)} EGP
                            </span>
                          </div>
                          {!activeStep.isTotal && (
                            <div className="hidden md:flex items-center gap-1 text-slate-400 text-[10px]">
                              <span>Capital Level:</span>
                              <span className="text-cyan-300 font-bold">{formatEgp(activeStep.end)} EGP</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full text-slate-400 text-[11px]">
                        <span>Hover over any step to inspect its capital impact, holding period, and cumulative capital level</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-blue-300 font-medium">Initial: {formatEgp(waterfallData.initialCapital)} EGP</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-purple-300 font-medium">Total: {formatEgp(waterfallData.endingEquity)} EGP</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stepped Horizontal Scrollable Canvas */}
              <div className="overflow-x-auto pt-2 pb-2">
                <div
                  className="space-y-2"
                  style={{
                    minWidth: `${Math.max(680, closedPositionsWaterfallData.steps.length * 108)}px`,
                  }}
                >
                  {(() => {
                    const activeScale = closedScaleMode === 'full' ? closedPositionsWaterfallData.fullScale : closedPositionsWaterfallData.zoomScale;
                    const { yMin, yRange } = activeScale;
                    const valToPercent = (v: number) => Math.max(0, Math.min(100, ((v - yMin) / yRange) * 76 + 2));

                    return (
                      <>
                        {/* Fixed-height Plot Canvas */}
                        <div className="relative h-64 sm:h-72 w-full pt-8 pb-1 px-3">
                          {/* Zero Reference Baseline */}
                          {yMin <= 0 && (
                            <div
                              className="absolute left-0 right-0 border-t border-dashed border-slate-600/70 pointer-events-none z-0 flex items-center justify-end pr-2"
                              style={{ bottom: `${valToPercent(0)}%` }}
                            >
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                                0.00 EGP Baseline
                              </span>
                            </div>
                          )}

                          {/* Mathematical SVG Connector Lines Overlay (Anchored directly to bar top/bottom edges) */}
                          <svg className="absolute top-8 bottom-1 left-3 right-3 pointer-events-none z-0">
                            {closedPositionsWaterfallData.steps.slice(0, -1).map((step, i) => {
                              const x1 = ((i + 0.5) / closedPositionsWaterfallData.steps.length) * 100;
                              const x2 = ((i + 1.5) / closedPositionsWaterfallData.steps.length) * 100;
                              const y = 100 - valToPercent(step.end);
                              return (
                                <line
                                  key={`closed-conn-${i}`}
                                  x1={`${x1}%`}
                                  y1={`${y}%`}
                                  x2={`${x2}%`}
                                  y2={`${y}%`}
                                  stroke="#64748b"
                                  strokeWidth="1.5"
                                  strokeDasharray="4,4"
                                  opacity="0.85"
                                />
                              );
                            })}
                          </svg>

                          {/* Stepped Position Columns */}
                          <div className="w-full h-full flex items-stretch justify-between relative z-10 gap-1.5">
                            {closedPositionsWaterfallData.steps.map((step, idx) => {
                              const isPositiveDelta = step.delta >= 0;
                              const isHovered = hoveredClosedStep === idx;
                              const minBarPercent = 2.5;

                              let barBottom = 0;
                              let barHeight = 0;
                              let visualTop = 0;

                              if (step.isTotal) {
                                // Base pillar (Initial Capital) or Final pillar (Total Capital)
                                barBottom = valToPercent(yMin <= 0 ? 0 : yMin);
                                const naturalLevel = valToPercent(step.end);
                                barHeight = Math.max(minBarPercent, naturalLevel - barBottom);
                                visualTop = naturalLevel;
                              } else if (isPositiveDelta) {
                                // Positive realized trade gain: steps UP from start to end level
                                barBottom = valToPercent(step.start);
                                const naturalTop = valToPercent(step.end);
                                barHeight = Math.max(minBarPercent, naturalTop - barBottom);
                                visualTop = naturalTop;
                              } else {
                                // Negative realized trade loss: starts at step.start and drops DOWN to step.end
                                const naturalTop = valToPercent(step.start);
                                const naturalBottom = valToPercent(step.end);
                                barHeight = Math.max(minBarPercent, naturalTop - naturalBottom);
                                barBottom = naturalTop - barHeight;
                                visualTop = naturalTop;
                              }

                              return (
                                <div
                                  key={`trade-step-${step.stepNumber}-${step.ticker}`}
                                  onMouseEnter={() => setHoveredClosedStep(idx)}
                                  onMouseLeave={() => setHoveredClosedStep(null)}
                                  className="flex-1 flex flex-col items-center justify-end h-full relative group px-1 cursor-pointer"
                                >
                                  {/* Detailed Hover Tooltip - Clamped safely inside chart container */}
                                  <div
                                    className={`absolute top-0 z-30 hidden group-hover:flex flex-col bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-2xl backdrop-blur-md text-[11px] w-52 pointer-events-none transition-all duration-150
                                      ${idx === 0 ? 'left-1' : idx >= closedPositionsWaterfallData.steps.length - 2 ? 'right-1' : 'left-1/2 -translate-x-1/2'}
                                    `}
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                                      <span className="font-bold text-white text-xs truncate">{step.ticker}</span>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                                          step.stepNumber === 0
                                            ? 'bg-blue-500/20 text-blue-300'
                                            : step.isTotal
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : isPositiveDelta
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-rose-500/20 text-rose-400'
                                        }`}
                                      >
                                        {step.stepNumber === 0 ? 'FIRST STEP' : step.isTotal ? 'LAST STEP' : isPositiveDelta ? 'GAIN' : 'LOSS'}
                                      </span>
                                    </div>
                                    <p className="text-slate-400 text-[10px] mt-0.5 truncate">{step.companyName}</p>

                                    <div className="mt-1.5 space-y-1 font-mono">
                                      <div className="flex justify-between text-slate-300">
                                        <span>
                                          {step.stepNumber === 0
                                            ? 'Initial Capital:'
                                            : step.isTotal
                                            ? 'Total Capital:'
                                            : step.ticker === 'OPEN POSITIONS'
                                            ? 'Floating P&L:'
                                            : 'Trade P&L:'}
                                        </span>
                                        <span
                                          className={`font-bold ${
                                            step.stepNumber === 0
                                              ? 'text-blue-300'
                                              : step.isTotal
                                              ? 'text-purple-300'
                                              : isPositiveDelta
                                              ? 'text-emerald-400'
                                              : 'text-rose-400'
                                          }`}
                                        >
                                          {step.isTotal ? '' : isPositiveDelta ? '+' : ''}
                                          {formatEgp(step.delta)} EGP
                                        </span>
                                      </div>
                                      {!step.isTotal ? (
                                        <>
                                          <div className="flex justify-between text-slate-400 text-[10px]">
                                            <span>Cumulative Level:</span>
                                            <span className="text-cyan-300 font-bold">
                                              {formatEgp(step.end)} EGP
                                            </span>
                                          </div>
                                          {step.holdingDays > 0 && (
                                            <div className="flex justify-between text-slate-400 text-[10px]">
                                              <span>Holding Days:</span>
                                              <span>{step.holdingDays} days</span>
                                            </div>
                                          )}
                                          <div className="flex justify-between text-slate-500 text-[10px]">
                                            <span>Date / Period:</span>
                                            <span>{step.sellDate}</span>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                          <span>
                                            {step.stepNumber === 0 ? 'Starting Status:' : 'Closed Trades:'}
                                          </span>
                                          <span>
                                            {step.stepNumber === 0 ? 'Baseline Capital' : `${closedTrades.length} positions`}
                                          </span>
                                        </div>
                                      )}
                                      {step.fees > 0 && (
                                        <div className="flex justify-between text-amber-400/80 text-[10px]">
                                          <span>Commissions:</span>
                                          <span>{formatEgp(step.fees)} EGP</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Impact Label positioned strictly ABOVE the bar */}
                                  <div
                                    className="absolute text-center w-full px-0.5 pointer-events-none z-20 flex justify-center"
                                    style={{
                                      bottom: `calc(${visualTop}% + 6px)`,
                                    }}
                                  >
                                    <span
                                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold leading-none shadow-md backdrop-blur-sm border whitespace-nowrap transition-all duration-150 ${
                                        isHovered ? 'ring-2 ring-white/50 brightness-110 scale-105' : ''
                                      } ${
                                        step.stepNumber === 0
                                          ? 'bg-blue-950/90 text-blue-300 border-blue-700/60 shadow-blue-950/40'
                                          : step.isTotal
                                          ? 'bg-purple-950/90 text-purple-300 border-purple-700/60 shadow-purple-950/40'
                                          : isPositiveDelta
                                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/40'
                                          : 'bg-rose-950/90 text-rose-300 border-rose-700/60 shadow-rose-950/40'
                                      }`}
                                    >
                                      {step.isTotal
                                        ? formatEgp(step.delta)
                                        : `${isPositiveDelta ? '+' : ''}${formatEgp(step.delta)}`}
                                    </span>
                                  </div>

                                  {/* Floating / Pillar Stepped Bar */}
                                  <div
                                    className={`w-8 sm:w-11 rounded-lg transition-all duration-200 shadow-md relative flex items-center justify-center cursor-pointer ${
                                      isHovered ? 'brightness-125 ring-2 ring-white/40 scale-[1.02]' : 'group-hover:brightness-110'
                                    }`}
                                    style={{
                                      position: 'absolute',
                                      bottom: `${barBottom}%`,
                                      height: `${barHeight}%`,
                                      backgroundColor: step.color,
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* X-Axis Step Labels Row - Dedicated Bottom Section */}
                        <div className="w-full flex items-start justify-between gap-1.5 pt-2.5 px-3 border-t border-slate-800">
                          {closedPositionsWaterfallData.steps.map((step, idx) => (
                            <div
                              key={`closed-label-${step.stepNumber}-${step.ticker}`}
                              onMouseEnter={() => setHoveredClosedStep(idx)}
                              onMouseLeave={() => setHoveredClosedStep(null)}
                              className="flex-1 text-center min-w-0 px-0.5 cursor-pointer"
                            >
                              <span
                                className={`text-[10px] sm:text-xs font-semibold block truncate leading-tight transition ${
                                  hoveredClosedStep === idx ? 'text-white font-bold' : 'text-slate-300'
                                }`}
                              >
                                {step.stepNumber === 0
                                  ? 'Initial Capital'
                                  : step.isTotal
                                  ? 'Total Capital'
                                  : step.ticker}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-mono mt-0.5 truncate">
                                {step.stepNumber === 0
                                  ? 'First Step'
                                  : step.isTotal
                                  ? 'Last Step'
                                  : step.ticker === 'OPEN POSITIONS'
                                  ? 'Open Step'
                                  : `Step #${step.stepNumber}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

                  {/* Scannable Breakdown Cards below the Closed Positions Waterfall */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Initial Capital</span>
                      <span className="font-mono font-bold text-blue-400">
                        {formatEgp(waterfallData.initialCapital)} EGP
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Total Realized Trades</span>
                      <span className="font-mono font-bold text-slate-200">
                        {closedTrades.length} Positions ({stats.winningTrades}W / {stats.losingTrades}L)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Net Realized P&amp;L</span>
                      <span className={`font-mono font-bold ${closedPositionsWaterfallData.netRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {closedPositionsWaterfallData.netRealized >= 0 ? '+' : ''}{formatEgp(closedPositionsWaterfallData.netRealized)} EGP
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Total Capital Now + Realized</span>
                      <span className="font-mono font-bold text-purple-300">
                        {formatEgp(waterfallData.endingEquity)} EGP
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

      {/* SECTION E: MONTHLY REALIZED P&L HISTOGRAM */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Monthly Realized Gain / Loss Histogram</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Realized cash returns booked per calendar month (Net of brokerage commissions)
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
          {sortedMonths.map((m) => {
            const data = monthlyPnl[m];
            const isProfit = data.gain >= 0;
            const maxMonthVal = Math.max(...sortedMonths.map((mon) => Math.abs(monthlyPnl[mon].gain)), 1000);
            const barHeight = Math.min(100, Math.max(15, (Math.abs(data.gain) / maxMonthVal) * 100));

            return (
              <div key={m} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-semibold text-slate-300">{m}</span>
                <div className="w-full h-24 flex items-end justify-center py-1">
                  <div
                    className={`w-8 rounded-t-lg transition-all ${
                      isProfit ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ height: `${barHeight}%` }}
                    title={`${m}: ${formatEgp(data.gain)} EGP`}
                  />
                </div>
                <div className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfit ? '+' : ''}{formatEgp(data.gain)} EGP
                </div>
                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <div>{data.count} trades</div>
                  {data.fees > 0 && <div className="text-amber-400/80">Fees: {formatEgp(data.fees)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION F: MONTHLY PERFORMANCE & END-OF-MONTH POSITIONS AUDIT (REPORT 2) */}
      <MonthlyPerformanceReport
        closedTrades={closedTrades}
        positions={positions}
      />
    </div>
  );
};
