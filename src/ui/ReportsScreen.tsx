import React, { useState } from 'react';
import type { ClosedTrade, PerformanceStats, PortfolioMetrics, Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import type { ReportsMode } from '../services/reportsWorkspace';
import { PerformanceReports } from '../features/reports';
import { MetricsScreen } from './MetricsScreen';

type ReportsView = 'metrics' | 'charts' | 'trading' | 'allocation' | 'monthly';

const VIEWS: Array<{ id: ReportsView; label: string; legacyMode?: ReportsMode }> = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'charts', label: 'Charts', legacyMode: 'analytics' },
  { id: 'trading', label: 'Trading', legacyMode: 'trading' },
  { id: 'allocation', label: 'Allocation', legacyMode: 'allocation' },
  { id: 'monthly', label: 'Monthly', legacyMode: 'monthly' },
];

interface ReportsScreenProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance: number;
  capitalDeposits: number;
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  historicalLoading?: boolean;
  chartsReady?: boolean;
}

/**
 * Reports opens on the new Metrics page. The deeper chart workspaces are the
 * existing ones, selected through the same chip row.
 */
export const ReportsScreen: React.FC<ReportsScreenProps> = (props) => {
  const [view, setView] = useState<ReportsView>('metrics');
  const active = VIEWS.find((item) => item.id === view) ?? VIEWS[0];

  return (
    <div className="ui-stack">
      <div className="ui-chips" role="tablist" aria-label="Report view">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="ui-chip"
            aria-selected={view === item.id}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {active.id === 'metrics' ? (
        <MetricsScreen
          stats={props.stats}
          closedTrades={props.closedTrades}
          positions={props.positions}
          metrics={props.metrics}
          cashBalance={props.cashBalance}
          capitalDeposits={props.capitalDeposits}
          transactions={props.transactions}
          historicalPrices={props.historicalPrices}
          historicalLoading={props.historicalLoading}
        />
      ) : (
        <PerformanceReports {...props} controlledMode={active.legacyMode} />
      )}
    </div>
  );
};
