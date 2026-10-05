import React from 'react';
import {
  Activity,
  CalendarDays,
  Crosshair,
  Layers3,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';

interface AllocationDiagnostic {
  name: string;
  percentage: number;
}

interface CurrentMonthDiagnostic {
  label: string;
  totalPnlEgp: number;
  realizedPnlEgp: number;
  holdingPnlEgp: number;
  closedTrades: number;
  winRate: number | null;
}

interface ReportsOverviewProps {
  portfolioValue: number;
  dayChangeEgp: number | null;
  dayChangePercent: number | null;
  realizedPnlEgp: number;
  unrealizedPnlEgp: number;
  cashBalance: number;
  winRate: number;
  profitFactor: number;
  expectancyEgp: number | null;
  totalTrades: number;
  maxDrawdownPercent: number | null;
  maxDrawdownEgp: number | null;
  totalFees: number;
  largestHolding: AllocationDiagnostic | null;
  largestSector: AllocationDiagnostic | null;
  topThreeConcentration: number;
  cashSharePercent: number;
  currentMonth: CurrentMonthDiagnostic;
}

const EGP_FORMATTER = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (value: number) => EGP_FORMATTER.format(value);
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatRatio = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '∞');

const pnlGlow = (value: number) =>
  value > 0.01
    ? 'premium-glow-win'
    : value < -0.01
      ? 'premium-glow-loss'
      : 'premium-glow-breakeven';

const pnlText = (value: number) =>
  value > 0.01 ? 'text-emerald-300' : value < -0.01 ? 'text-rose-300' : 'text-slate-200';

const signedEgp = (value: number) => `${value > 0 ? '+' : ''}${formatEgp(value)}`;

const ReportsOverviewComponent: React.FC<ReportsOverviewProps> = ({
  portfolioValue,
  dayChangeEgp,
  dayChangePercent,
  realizedPnlEgp,
  unrealizedPnlEgp,
  cashBalance,
  winRate,
  profitFactor,
  expectancyEgp,
  totalTrades,
  maxDrawdownPercent,
  maxDrawdownEgp,
  totalFees,
  largestHolding,
  largestSector,
  topThreeConcentration,
  cashSharePercent,
  currentMonth,
}) => {
  const totalPnl = realizedPnlEgp + unrealizedPnlEgp;
  const expectancyState = expectancyEgp ?? 0;

  return (
    <div className="premium-flow-major" data-reports-diagnostic-overview="true">
      <section
        className={`premium-card premium-semantic-card ${pnlGlow(totalPnl)} premium-hierarchy-h2 premium-pad-h2 rounded-2xl`}
        data-hierarchy="h2"
        aria-labelledby="reports-overview-portfolio-state"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-cyan-300">
              <Activity className="h-4 w-4" />
              <span className="premium-type-metric-label">Portfolio State</span>
            </div>
            <h3 id="reports-overview-portfolio-state" className="premium-type-section-title mt-1.5">
              Current portfolio snapshot
            </h3>
            <p className="premium-type-helper mt-1">
              NAV, current P&amp;L composition and cash context without opening the full Analytics workspace.
            </p>
          </div>

          <div className="min-w-0 text-left lg:text-right">
            <div className="premium-type-metadata">Portfolio NAV</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2 lg:justify-end">
              <span className="premium-type-metric premium-type-metric-hero font-mono text-slate-50">
                {formatEgp(portfolioValue)}
              </span>
              <span className="premium-type-unit">EGP</span>
            </div>
            {dayChangeEgp != null && dayChangePercent != null && (
              <div className={`mt-1 font-mono text-sm font-semibold ${pnlText(dayChangeEgp)}`}>
                Today {signedEgp(dayChangeEgp)} EGP · {dayChangePercent > 0 ? '+' : ''}{dayChangePercent.toFixed(2)}%
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="premium-subpanel rounded-xl p-3">
            <div className="premium-type-metadata">Realized P&amp;L</div>
            <div className={`mt-1 font-mono font-bold ${pnlText(realizedPnlEgp)}`}>
              {signedEgp(realizedPnlEgp)} EGP
            </div>
          </div>
          <div className="premium-subpanel rounded-xl p-3">
            <div className="premium-type-metadata">Unrealized P&amp;L</div>
            <div className={`mt-1 font-mono font-bold ${pnlText(unrealizedPnlEgp)}`}>
              {signedEgp(unrealizedPnlEgp)} EGP
            </div>
          </div>
          <div className="premium-subpanel rounded-xl p-3">
            <div className="premium-type-metadata flex items-center gap-1.5">
              <WalletCards className="h-3.5 w-3.5" />
              Cash Available
            </div>
            <div className="mt-1 font-mono font-bold text-blue-300">{formatEgp(cashBalance)} EGP</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section
          className={`premium-card premium-semantic-card ${pnlGlow(expectancyState)} premium-hierarchy-h3 premium-pad-h3 rounded-2xl`}
          data-hierarchy="h3"
          aria-labelledby="reports-overview-trading-quality"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-purple-300">
                <Crosshair className="h-4 w-4" />
                <span className="premium-type-metric-label">Trading Quality</span>
              </div>
              <h3 id="reports-overview-trading-quality" className="premium-type-section-title mt-1.5">
                Am I trading well?
              </h3>
            </div>
            <span className="premium-chip rounded-lg px-2 py-1 text-[11px] text-slate-300">{totalTrades} closed</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <div className="premium-type-metadata">Win Rate</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-300">{winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="premium-type-metadata">Profit Factor</div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-300">{formatRatio(profitFactor)}x</div>
            </div>
            <div>
              <div className="premium-type-metadata">Expectancy</div>
              <div className={`mt-1 font-mono text-lg font-bold ${pnlText(expectancyState)}`}>
                {expectancyEgp == null ? '—' : `${signedEgp(expectancyEgp)} EGP`}
              </div>
            </div>
          </div>
        </section>

        <section
          className="premium-card premium-material-tone-amber premium-hierarchy-h3 premium-pad-h3 rounded-2xl"
          data-hierarchy="h3"
          aria-labelledby="reports-overview-risk-costs"
        >
          <div className="flex items-center gap-2 text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            <span className="premium-type-metric-label">Risk &amp; Costs</span>
          </div>
          <h3 id="reports-overview-risk-costs" className="premium-type-section-title mt-1.5">
            Drawdown and execution friction
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="premium-type-metadata">Max Drawdown</div>
              <div className="mt-1 font-mono text-lg font-bold text-rose-300">
                {maxDrawdownPercent == null ? '—' : formatPercent(Math.abs(maxDrawdownPercent))}
              </div>
              {maxDrawdownEgp != null && (
                <div className="premium-type-helper mt-0.5">{formatEgp(Math.abs(maxDrawdownEgp))} EGP peak-to-trough</div>
              )}
            </div>
            <div>
              <div className="premium-type-metadata">Brokerage Fees</div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-300">{formatEgp(totalFees)} EGP</div>
              <div className="premium-type-helper mt-0.5">Open + closed fees</div>
            </div>
          </div>

          <div className="premium-type-helper mt-3">
            Realized {signedEgp(realizedPnlEgp)} EGP · Unrealized {signedEgp(unrealizedPnlEgp)} EGP
          </div>
        </section>

        <section
          className="premium-card premium-material-tone-cyan premium-hierarchy-h3 premium-pad-h3 rounded-2xl"
          data-hierarchy="h3"
          aria-labelledby="reports-overview-concentration"
        >
          <div className="flex items-center gap-2 text-cyan-300">
            <Layers3 className="h-4 w-4" />
            <span className="premium-type-metric-label">Concentration</span>
          </div>
          <h3 id="reports-overview-concentration" className="premium-type-section-title mt-1.5">
            Where is capital concentrated?
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="premium-type-metadata">Largest Holding</div>
              <div className="mt-1 font-mono text-lg font-bold text-cyan-300">
                {largestHolding ? largestHolding.name : '—'}
              </div>
              <div className="premium-type-helper mt-0.5">
                {largestHolding ? formatPercent(largestHolding.percentage) : 'No holdings'}
              </div>
            </div>
            <div>
              <div className="premium-type-metadata">Largest Sector</div>
              <div className="mt-1 truncate font-mono text-lg font-bold text-blue-300">
                {largestSector ? largestSector.name : '—'}
              </div>
              <div className="premium-type-helper mt-0.5">
                {largestSector ? formatPercent(largestSector.percentage) : 'No sectors'}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="premium-chip rounded-lg px-2 py-1 text-xs text-slate-300">
              Top 3: {formatPercent(topThreeConcentration)}
            </span>
            <span className="premium-chip rounded-lg px-2 py-1 text-xs text-slate-300">
              Cash: {formatPercent(cashSharePercent)}
            </span>
          </div>
        </section>

        <section
          className={`premium-card premium-semantic-card ${pnlGlow(currentMonth.totalPnlEgp)} premium-hierarchy-h3 premium-pad-h3 rounded-2xl`}
          data-hierarchy="h3"
          aria-labelledby="reports-overview-current-month"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-violet-300">
                <CalendarDays className="h-4 w-4" />
                <span className="premium-type-metric-label">Current Month</span>
              </div>
              <h3 id="reports-overview-current-month" className="premium-type-section-title mt-1.5">
                {currentMonth.label}
              </h3>
            </div>
            <span className="premium-chip rounded-lg px-2 py-1 text-[11px] text-slate-300">
              {currentMonth.closedTrades} closed
            </span>
          </div>

          <div className={`mt-3 font-mono text-2xl font-bold ${pnlText(currentMonth.totalPnlEgp)}`}>
            {signedEgp(currentMonth.totalPnlEgp)} EGP
          </div>
          <div className="premium-type-helper mt-1">Visible monthly audit P&amp;L: liquidated + holdings.</div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <div className="premium-type-metadata">Liquidated</div>
              <div className={`mt-1 font-mono text-sm font-bold ${pnlText(currentMonth.realizedPnlEgp)}`}>
                {signedEgp(currentMonth.realizedPnlEgp)}
              </div>
            </div>
            <div>
              <div className="premium-type-metadata">Holdings</div>
              <div className={`mt-1 font-mono text-sm font-bold ${pnlText(currentMonth.holdingPnlEgp)}`}>
                {signedEgp(currentMonth.holdingPnlEgp)}
              </div>
            </div>
            <div>
              <div className="premium-type-metadata">Win Rate</div>
              <div className="mt-1 font-mono text-sm font-bold text-emerald-300">
                {currentMonth.winRate == null ? '—' : formatPercent(currentMonth.winRate)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const ReportsOverview = React.memo(ReportsOverviewComponent);
