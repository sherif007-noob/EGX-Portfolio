import React, { useMemo } from 'react';
import { egxSessionPresentation } from '../services/egxSessionPresentation';
import { ChevronRight } from 'lucide-react';
import type { PerformanceStats, PortfolioMetrics, Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import { StockLogo } from '../components/StockLogo';
import { HomeChart } from './HomeChart';
import { formatEgp, formatPercent, formatSigned, sectorColorVar, toneClass } from './format';

interface HomeScreenProps {
  metrics: PortfolioMetrics;
  stats: PerformanceStats;
  positions: Position[];
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  capitalDeposits: number;
  historicalLoading?: boolean;
  onOpenPositions: () => void;
  onOpenReports: () => void;
  onQuickAddCash?: () => void;
}

const HOLDINGS_PREVIEW = 5;

/** Unrealized P&L net of buy fees, matching how the legacy summary reports it. */
export function positionPnl(position: Position) {
  const marketValue = position.shares * position.currentPrice;
  const cost = position.shares * position.avgBuyPrice + (position.totalFees ?? 0);
  const pnl = marketValue - cost;
  return { marketValue, pnl, percent: cost > 0 ? (pnl / cost) * 100 : 0 };
}

const Tile: React.FC<{ label: string; value: number; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="ui-tile" style={{ ['--tile' as string]: color }}>
    <div className="ui-sm">
      <span className="ui-dot" style={{ ['--dot' as string]: color }} />
      {label}
    </div>
    <div className={`ui-mono ${toneClass(value)}`} style={{ fontSize: '1.2rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
      {formatSigned(value)}
    </div>
    <div className="ui-sm">{sub}</div>
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
  metrics,
  stats,
  positions,
  transactions,
  historicalPrices,
  capitalDeposits,
  historicalLoading = false,
  onOpenPositions,
  onOpenReports,
  onQuickAddCash,
}) => {
  const today = Number(metrics.dayChangeEgp || 0);
  const marketSession = egxSessionPresentation();
  const holdings = useMemo(
    () =>
      positions
        .map((position) => ({ position, ...positionPnl(position) }))
        .sort((a, b) => b.marketValue - a.marketValue),
    [positions],
  );
  const cashShare = metrics.totalValue > 0 ? (metrics.cashBalance / metrics.totalValue) * 100 : 0;
  const pending = metrics.pendingIpoSubscriptionsEgp ?? 0;

  return (
    <div className="ui-home-grid">
      <div className="ui-stack">
        <section className="ui-hero" aria-label="Portfolio value">
          <div className="ui-sm">Portfolio value</div>
          <div className="ui-mono" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.25rem)', fontWeight: 600, lineHeight: 1.15 }}>
            {formatEgp(metrics.totalValue)} <span className="ui-sm">EGP</span>
          </div>
          <span
            className={`ui-mono ${marketSession.isCurrentSessionDay ? toneClass(today) : 'ui-muted'}`}
            style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: '0.8125rem',
              background: 'rgba(148, 163, 184, 0.14)',
            }}
          >
            {marketSession.isCurrentSessionDay ? `${formatSigned(today)} today · ${formatPercent(metrics.dayChangePercent)}` : `${marketSession.description} · ${marketSession.sessionCaption}`}
          </span>
        </section>

        <HomeChart
          transactions={transactions}
          historicalPrices={historicalPrices}
          capitalDeposits={capitalDeposits}
          positions={positions}
          currentCashBalance={metrics.cashBalance}
          historicalLoading={historicalLoading}
        />

        <button type="button" className="ui-row ui-link" onClick={onOpenReports}>
          <span>Performance metrics</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="ui-stack">
        <div className="ui-tile-grid" aria-label="Profit and loss overview">
          <Tile
            label="Realized P&L"
            value={metrics.realizedPnlEgp}
            sub={`${stats.totalTrades} closed trade${stats.totalTrades === 1 ? '' : 's'}`}
            color="var(--ui-teal)"
          />
          <Tile
            label="Unrealized P&L"
            value={metrics.unrealizedPnlEgp}
            sub={`${formatPercent(metrics.unrealizedPnlPercent)} · net of fees`}
            color="var(--ui-blue)"
          />
        </div>

        <section className="ui-home-panel" aria-label="Holdings">
          <div className="ui-section-h" style={{ marginTop: 4 }}>
            <span>Holdings</span>
            <button type="button" className="ui-link ui-sm" onClick={onOpenPositions}>
              See all{holdings.length > HOLDINGS_PREVIEW ? ` (${holdings.length})` : ''}
            </button>
          </div>
          {holdings.length === 0 ? (
            <p className="ui-sm" style={{ padding: '12px 0' }}>No open positions yet.</p>
          ) : (
            holdings.slice(0, HOLDINGS_PREVIEW).map(({ position, marketValue, pnl, percent }) => (
              <button key={position.id} type="button" className="ui-row" onClick={onOpenPositions} aria-label={`Open holdings list to find ${position.ticker}`}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {position.logoUrl ? (
                    <StockLogo ticker={position.ticker} companyName={position.companyName} sector={position.sector} logoUrl={position.logoUrl} size="md" />
                  ) : (
                    <span className="ui-avatar" style={{ ['--av' as string]: sectorColorVar(position.sector) }} aria-hidden="true">
                      {position.ticker.slice(0, 2)}
                    </span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{position.ticker}</span>
                    <span className="ui-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {position.companyName}
                    </span>
                  </span>
                </span>
                <span style={{ textAlign: 'right', flex: 'none' }}>
                  <span className="ui-mono" style={{ display: 'block' }}>{formatEgp(marketValue)}</span>
                  <span className={`ui-mono ui-sm ${toneClass(pnl)}`} style={{ display: 'block' }}>
                    {formatSigned(pnl, 0)} · {formatPercent(percent, 1)}
                  </span>
                </span>
              </button>
            ))
          )}
        </section>

        <section className="ui-home-panel" aria-label="Cash and costs">
          <div className="ui-section-h">
            <span>Cash and costs</span>
            {onQuickAddCash && (
              <button type="button" className="ui-link ui-sm" onClick={onQuickAddCash}>Add or withdraw</button>
            )}
          </div>
          <div className="ui-row">
            <span><span className="ui-dot" style={{ ['--dot' as string]: 'var(--ui-gray)' }} />Cash</span>
            <span className="ui-mono">{formatEgp(metrics.cashBalance)} <span className="ui-sm">{cashShare.toFixed(1)}%</span></span>
          </div>
          <div className="ui-row">
            <span><span className="ui-dot" style={{ ['--dot' as string]: 'var(--ui-amber)' }} />Fees paid</span>
            <span className="ui-mono">{formatEgp(metrics.totalFeesPaid ?? 0)}</span>
          </div>
          {pending > 0 && (
            <div className="ui-row">
              <span><span className="ui-dot" style={{ ['--dot' as string]: 'var(--ui-purple)' }} />IPO reserved</span>
              <span className="ui-mono">{formatEgp(pending)}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
