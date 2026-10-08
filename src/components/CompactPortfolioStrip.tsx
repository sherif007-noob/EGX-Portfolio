import React from 'react';
import { egxSessionPresentation } from '../services/egxSessionPresentation';
import type { PortfolioMetrics } from '../types';

interface CompactPortfolioStripProps {
  metrics: PortfolioMetrics;
}

const formatEgp = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export const CompactPortfolioStrip: React.FC<CompactPortfolioStripProps> = ({ metrics }) => {
  const today = Number(metrics.dayChangeEgp || 0);
  const marketSession = egxSessionPresentation();
  const todayPercent = Number(metrics.dayChangePercent || 0);
  const isPositive = today > 0;
  const isNegative = today < 0;

  return (
    <section
      className="premium-panel premium-hierarchy-h4 mb-3 grid grid-cols-3 items-center gap-1 rounded-xl px-2.5 py-2 sm:px-3"
      data-portfolio-context-strip
      aria-label="Portfolio context"
    >
      <div className="min-w-0 border-r border-slate-700/50 pr-2">
        <div className="premium-type-metric-label">Value</div>
        <div className="truncate font-mono text-xs font-bold text-white sm:text-sm">
          {formatEgp(metrics.totalValue)} <span className="premium-type-unit">EGP</span>
        </div>
      </div>

      <div className="min-w-0 border-r border-slate-700/50 px-2">
        <div className="premium-type-metric-label">{marketSession.isCurrentSessionDay ? 'Today' : 'Market closed'}</div>
        <div
          className={`truncate font-mono text-xs font-bold sm:text-sm ${
            isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-amber-400'
          }`}
        >
          {marketSession.isCurrentSessionDay ? (
            <>{isPositive ? '+' : ''}{formatEgp(today)}
              <span className="ml-1 hidden text-[10px] font-semibold sm:inline">
                ({isPositive ? '+' : ''}{todayPercent.toFixed(2)}%)
              </span></>
          ) : <span className="text-[10px]">{marketSession.sessionCaption}</span>}
        </div>
      </div>

      <div className="min-w-0 pl-2">
        <div className="premium-type-metric-label">Cash</div>
        <div className="truncate font-mono text-xs font-bold text-cyan-300 sm:text-sm">
          {formatEgp(metrics.cashBalance)} <span className="premium-type-unit">EGP</span>
        </div>
      </div>
    </section>
  );
};
