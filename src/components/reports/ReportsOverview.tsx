import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Crosshair,
  Layers3,
  Minus,
  Plus,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import type { ReportsMode } from '../../services/reportsWorkspace';
import { DisclosurePresence } from '../PremiumMotion';

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

type ReportsPreviewId =
  | 'portfolio-state'
  | 'trading-quality'
  | 'risk-costs'
  | 'concentration'
  | 'current-month';

type FullReportMode = Exclude<ReportsMode, 'overview'>;

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
  onOpenReport: (mode: FullReportMode) => void;
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

interface PreviewActionsProps {
  previewId: ReportsPreviewId;
  expanded: boolean;
  destination: FullReportMode;
  onToggle: (previewId: ReportsPreviewId) => void;
  onOpenReport: (mode: FullReportMode) => void;
}

const PreviewActions: React.FC<PreviewActionsProps> = ({
  previewId,
  expanded,
  destination,
  onToggle,
  onOpenReport,
}) => (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
    <button
      type="button"
      className="premium-action premium-action-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
      aria-expanded={expanded}
      aria-controls={`reports-preview-${previewId}`}
      onClick={() => onToggle(previewId)}
    >
      {expanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {expanded ? 'Show less' : 'Inspect'}
    </button>

    {expanded && (
      <button
        type="button"
        className="premium-action premium-action-primary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
        aria-label={`Open full ${destination} report`}
        onClick={() => onOpenReport(destination)}
      >
        Open full report
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

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
  onOpenReport,
}) => {
  const [expandedPreview, setExpandedPreview] = useState<ReportsPreviewId | null>(null);
  const totalPnl = realizedPnlEgp + unrealizedPnlEgp;
  const expectancyState = expectancyEgp ?? 0;

  const togglePreview = (previewId: ReportsPreviewId) => {
    setExpandedPreview((current) => (current === previewId ? null : previewId));
  };

  const portfolioExpanded = expandedPreview === 'portfolio-state';
  const tradingExpanded = expandedPreview === 'trading-quality';
  const riskExpanded = expandedPreview === 'risk-costs';
  const concentrationExpanded = expandedPreview === 'concentration';
  const monthExpanded = expandedPreview === 'current-month';

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
              NAV and today&apos;s movement first; expand only when the P&amp;L composition deserves inspection.
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

        <DisclosurePresence isOpen={portfolioExpanded} className="mt-4">
          <div
            id="reports-preview-portfolio-state"
            data-reports-preview-expanded="portfolio-state"
            className="premium-inset-glass rounded-xl p-3.5"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
            <div className={`premium-type-helper mt-3 ${pnlText(totalPnl)}`}>
              Combined realized + unrealized P&amp;L: {signedEgp(totalPnl)} EGP.
            </div>
          </div>
        </DisclosurePresence>

        <PreviewActions
          previewId="portfolio-state"
          expanded={portfolioExpanded}
          destination="analytics"
          onToggle={togglePreview}
          onOpenReport={onOpenReport}
        />
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

          <div className="mt-4">
            <div className="premium-type-metadata">Win Rate</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{winRate.toFixed(1)}%</div>
          </div>

          <DisclosurePresence isOpen={tradingExpanded} className="mt-4">
            <div
              id="reports-preview-trading-quality"
              data-reports-preview-expanded="trading-quality"
              className="premium-inset-glass rounded-xl p-3.5"
            >
              <div className="grid grid-cols-2 gap-3">
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
              <div className="premium-type-helper mt-3">
                Closed-trade quality uses the existing Trading statistics authority.
              </div>
            </div>
          </DisclosurePresence>

          <PreviewActions
            previewId="trading-quality"
            expanded={tradingExpanded}
            destination="trading"
            onToggle={togglePreview}
            onOpenReport={onOpenReport}
          />
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

          <div className="mt-4">
            <div className="premium-type-metadata">Max Drawdown</div>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
              {maxDrawdownPercent == null ? '—' : formatPercent(Math.abs(maxDrawdownPercent))}
            </div>
            {maxDrawdownEgp != null && (
              <div className="premium-type-helper mt-0.5">{formatEgp(Math.abs(maxDrawdownEgp))} EGP peak-to-trough</div>
            )}
          </div>

          <DisclosurePresence isOpen={riskExpanded} className="mt-4">
            <div
              id="reports-preview-risk-costs"
              data-reports-preview-expanded="risk-costs"
              className="premium-inset-glass rounded-xl p-3.5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="premium-type-metadata">Brokerage Fees</div>
                  <div className="mt-1 font-mono text-lg font-bold text-amber-300">{formatEgp(totalFees)} EGP</div>
                  <div className="premium-type-helper mt-0.5">Open + closed fees</div>
                </div>
                <div>
                  <div className="premium-type-metadata">P&amp;L composition</div>
                  <div className="premium-type-helper mt-1">
                    Realized {signedEgp(realizedPnlEgp)} EGP · Unrealized {signedEgp(unrealizedPnlEgp)} EGP
                  </div>
                </div>
              </div>
            </div>
          </DisclosurePresence>

          <PreviewActions
            previewId="risk-costs"
            expanded={riskExpanded}
            destination="analytics"
            onToggle={togglePreview}
            onOpenReport={onOpenReport}
          />
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

          <div className="mt-4">
            <div className="premium-type-metadata">Largest Holding</div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
              {largestHolding ? largestHolding.name : '—'}
            </div>
            <div className="premium-type-helper mt-0.5">
              {largestHolding ? formatPercent(largestHolding.percentage) : 'No holdings'}
            </div>
          </div>

          <DisclosurePresence isOpen={concentrationExpanded} className="mt-4">
            <div
              id="reports-preview-concentration"
              data-reports-preview-expanded="concentration"
              className="premium-inset-glass rounded-xl p-3.5"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="premium-type-metadata">Largest Sector</div>
                  <div className="mt-1 truncate font-mono text-lg font-bold text-blue-300">
                    {largestSector ? largestSector.name : '—'}
                  </div>
                  <div className="premium-type-helper mt-0.5">
                    {largestSector ? formatPercent(largestSector.percentage) : 'No sectors'}
                  </div>
                </div>
                <div>
                  <div className="premium-type-metadata">Portfolio mix</div>
                  <div className="premium-type-helper mt-1">Top 3: {formatPercent(topThreeConcentration)}</div>
                  <div className="premium-type-helper mt-0.5">Cash: {formatPercent(cashSharePercent)}</div>
                </div>
              </div>
            </div>
          </DisclosurePresence>

          <PreviewActions
            previewId="concentration"
            expanded={concentrationExpanded}
            destination="allocation"
            onToggle={togglePreview}
            onOpenReport={onOpenReport}
          />
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

          <DisclosurePresence isOpen={monthExpanded} className="mt-4">
            <div
              id="reports-preview-current-month"
              data-reports-preview-expanded="current-month"
              className="premium-inset-glass rounded-xl p-3.5"
            >
              <div className="grid grid-cols-3 gap-2">
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
            </div>
          </DisclosurePresence>

          <PreviewActions
            previewId="current-month"
            expanded={monthExpanded}
            destination="monthly"
            onToggle={togglePreview}
            onOpenReport={onOpenReport}
          />
        </section>
      </div>
    </div>
  );
};

export const ReportsOverview = React.memo(ReportsOverviewComponent);
