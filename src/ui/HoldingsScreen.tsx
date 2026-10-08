import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { PortfolioMetrics, Position } from '../types';
import { StockLogo } from '../components/StockLogo';
import { positionPnl } from './HomeScreen';
import { formatEgp, formatPercent, formatSigned, sectorColorVar, toneClass } from './format';

interface HoldingsScreenProps {
  positions: Position[];
  metrics: PortfolioMetrics;
  onSellPosition: (position: Position) => void;
  onEditPosition: (position: Position) => void;
  onCorrectLedger: (position: Position) => void;
  onAddNewTrade: () => void;
  onBuyMore: (position: Position) => void;
  onOpenPriceAlerts?: () => void;
}

type SortKey = 'value' | 'pnl' | 'name';

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'value', label: 'Value' },
  { id: 'pnl', label: 'P&L %' },
  { id: 'name', label: 'Name' },
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const HoldingsScreen: React.FC<HoldingsScreenProps> = ({
  positions,
  metrics,
  onSellPosition,
  onEditPosition,
  onCorrectLedger,
  onAddNewTrade,
  onBuyMore,
  onOpenPriceAlerts,
}) => {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('value');
  const [openId, setOpenId] = useState<string | null>(null);

  const total = metrics.totalValue > 0 ? metrics.totalValue : 0;
  const sectors = useMemo(() => Array.from(new Set(positions.map((position) => position.sector))), [positions]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return positions
      .filter((position) => {
        const matches = !needle || position.ticker.toLowerCase().includes(needle) || position.companyName.toLowerCase().includes(needle);
        return matches && (sector === 'ALL' || position.sector === sector);
      })
      .map((position) => ({ position, ...positionPnl(position) }))
      .sort((a, b) => {
        if (sort === 'pnl') return b.percent - a.percent;
        if (sort === 'name') return a.position.ticker.localeCompare(b.position.ticker);
        return b.marketValue - a.marketValue;
      });
  }, [positions, query, sector, sort]);

  const equitiesValue = positions.reduce((sum, position) => sum + position.shares * position.currentPrice, 0);
  const cashShare = total > 0 ? (metrics.cashBalance / total) * 100 : 0;
  const hasAny = positions.length > 0;

  return (
    <div className="ui-stack">
      {hasAny && (
        <section aria-label="Allocation">
          <div className="ui-bar" role="img" aria-label={`Cash ${cashShare.toFixed(1)} percent, equities ${(100 - cashShare).toFixed(1)} percent`}>
            <div style={{ width: `${cashShare}%`, background: 'var(--ui-gray)' }} />
            {positions.map((position) => (
              <div
                key={position.id}
                title={position.ticker}
                style={{
                  width: `${total > 0 ? ((position.shares * position.currentPrice) / total) * 100 : 0}%`,
                  background: sectorColorVar(position.sector),
                }}
              />
            ))}
          </div>
          <p className="ui-sm" style={{ marginTop: 6 }}>
            Cash {cashShare.toFixed(1)}% · equities {formatEgp(equitiesValue, 0)} EGP ({(100 - cashShare).toFixed(1)}%)
          </p>
        </section>
      )}

      <div style={{ position: 'relative' }}>
        <Search size={16} aria-hidden style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ui-text-2)' }} />
        <input
          className="ui-search"
          style={{ paddingLeft: 36 }}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ticker or company"
          aria-label="Search holdings"
        />
      </div>

      {sectors.length > 1 && (
        <div className="ui-chips" role="group" aria-label="Sector filter">
          {['ALL', ...sectors].map((item) => (
            <button key={item} type="button" className="ui-chip sub" aria-pressed={sector === item} onClick={() => setSector(item)}>
              {item === 'ALL' ? 'All sectors' : item}
            </button>
          ))}
        </div>
      )}

      <div className="ui-chips" role="group" aria-label="Sort holdings">
        {SORTS.map((item) => (
          <button key={item.id} type="button" className="ui-chip sub" aria-pressed={sort === item.id} onClick={() => setSort(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="ui-card" style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600 }}>{hasAny ? 'No holdings match your filters.' : 'No open positions yet.'}</p>
          <p className="ui-sm" style={{ margin: '4px 0 12px' }}>
            {hasAny ? 'Clear the search or sector filter to see everything.' : 'Add your first trade to start tracking a position.'}
          </p>
          {!hasAny && <button type="button" className="ui-btn primary" onClick={onAddNewTrade}>Add trade</button>}
        </div>
      ) : (
        <div className="ui-holdings-list ui-stack">
          {rows.map(({ position, marketValue, pnl, percent }) => {
            const open = openId === position.id;
            const cost = position.shares * position.avgBuyPrice;
            const weight = total > 0 ? (marketValue / total) * 100 : 0;
            const targetHit = !!position.targetPrice && position.currentPrice >= position.targetPrice;
            const stopHit = !!position.stopLoss && position.currentPrice <= position.stopLoss;
            return (
              <div key={position.id} className="ui-card ui-holding">
                <button type="button" className="ui-row" aria-expanded={open} onClick={() => setOpenId(open ? null : position.id)}>
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
                        {position.shares.toLocaleString('en-US')} sh · avg {formatEgp(position.avgBuyPrice)}
                      </span>
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                    <span style={{ textAlign: 'right' }}>
                      <span className="ui-mono" style={{ display: 'block' }}>{formatEgp(marketValue)}</span>
                      <span className={`ui-mono ui-sm ${toneClass(pnl)}`} style={{ display: 'block' }}>
                        {formatSigned(pnl, 0)} · {formatPercent(percent, 1)}
                      </span>
                    </span>
                    <ChevronDown size={18} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, color: 'var(--ui-text-2)' }} />
                  </span>
                </button>

                {open && (
                  <div className="ui-holding-body">
                    <p className="ui-sm">{position.companyName} · {position.sector}</p>
                    <dl className="ui-detail-grid">
                      <div><dt>Current price</dt><dd className="ui-mono">{formatEgp(position.currentPrice)}</dd></div>
                      <div>
                        <dt>Today</dt>
                        <dd className={`ui-mono ${toneClass(position.dayChangePercent)}`}>
                          {finite(position.dayChangePercent) ? formatPercent(position.dayChangePercent) : '—'}
                        </dd>
                      </div>
                      <div><dt>Cost basis</dt><dd className="ui-mono">{formatEgp(cost + (position.totalFees ?? 0))}</dd></div>
                      <div><dt>Buy fees</dt><dd className="ui-mono">{formatEgp(position.totalFees ?? 0)}</dd></div>
                      <div><dt>Share of portfolio</dt><dd className="ui-mono">{weight.toFixed(1)}%</dd></div>
                      <div><dt>First bought</dt><dd className="ui-mono">{position.buyDate}</dd></div>
                    </dl>
                    {(position.targetPrice || position.stopLoss) && (
                      <div className="ui-chips">
                        {position.targetPrice ? (
                          <span className="ui-pill" style={{ color: targetHit ? 'var(--ui-pos)' : undefined }}>
                            {targetHit ? 'Target hit' : 'Target'} {formatEgp(position.targetPrice)}
                          </span>
                        ) : null}
                        {position.stopLoss ? (
                          <span className="ui-pill" style={{ color: stopHit ? 'var(--ui-neg)' : undefined }}>
                            {stopHit ? 'Stop breached' : 'Stop'} {formatEgp(position.stopLoss)}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <div className="ui-actions">
                      <button type="button" className="ui-btn primary" onClick={() => onBuyMore(position)} aria-label={`Buy more ${position.ticker}`}>Buy more</button>
                      <button type="button" className="ui-btn danger" onClick={() => onSellPosition(position)} aria-label={`Sell ${position.ticker}`}>Sell</button>
                      <button type="button" className="ui-btn" onClick={() => onEditPosition(position)} aria-label={`Edit ${position.ticker} position`}>Edit</button>
                      {onOpenPriceAlerts && (
                        <button type="button" className="ui-btn" onClick={onOpenPriceAlerts} aria-label="Set target or stop alert">Alerts</button>
                      )}
                      <button type="button" className="ui-btn" onClick={() => onCorrectLedger(position)} aria-label={`Review source ledger for ${position.ticker}`}>Ledger</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
