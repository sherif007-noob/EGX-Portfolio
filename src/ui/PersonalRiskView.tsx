import React, { useMemo } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import type { ClosedTrade, Position } from '../types';
import { formatEgp, toneClass } from './format';
import { calculatePersonalRisk } from './personalRiskModel';

type Props = {
  positions: Position[];
  closedTrades: ClosedTrade[];
  cashBalance: number;
  nav: number;
  pendingIpoValue?: number;
  onOpenHoldings?: () => void;
  accountingBalanced?: boolean;
};

const money = (value: number) => `${formatEgp(value)} EGP`;
const percent = (value: number | null) => value == null ? '—' : `${value.toFixed(1)}%`;
const statusLabels = {
  covered:'Stop set',missing:'No stop',breached:'Stop at/above quote',
  invalid:'Invalid stop/cost',unpriced:'No valid quote',
} as const;

export function PersonalRiskView({positions,closedTrades,cashBalance,nav,pendingIpoValue=0,onOpenHoldings,accountingBalanced=true}: Props) {
  const risk = useMemo(()=>calculatePersonalRisk(
    positions,cashBalance,nav,closedTrades,pendingIpoValue,
  ),[positions,cashBalance,nav,closedTrades,pendingIpoValue]);
  const covered = risk.stopCoverageCount > 0;
  const unprotected = risk.missingStopCount + risk.invalidStopCount + risk.breachedStopCount;
  return <section className="ui-personal-risk" aria-label="Personal portfolio risk">
    <header className="ui-report-section-title">
      <h3>Your risk right now</h3>
      <p className="ui-sm">Last stored quotes and your recorded stops—not a model portfolio or an index. Quotes may be stale.</p>
    </header>
    <div className="ui-risk-kpis">
      <div className="ui-risk-kpi">
        <span className="ui-sm">Downside to stops</span>
        <strong className="ui-mono">{covered?money(risk.currentDownsideToStops):'—'}</strong>
        <span className="ui-sm">{covered?`${percent(risk.currentDownsideToStopsNavPercent)} of NAV, covered positions only`:'No usable stops to estimate'}</span>
      </div>
      <div className="ui-risk-kpi">
        <span className="ui-sm">Stop-covered holdings</span>
        <strong className="ui-mono">{percent(risk.stopCoveragePercent)}</strong>
        <span className="ui-sm">{risk.stopCoverageCount} of {positions.length} positions · market value basis</span>
      </div>
      <div className="ui-risk-kpi">
        <span className="ui-sm">Cash allocation</span>
        <strong className="ui-mono">{percent(risk.cashAllocationPercent)}</strong>
        <span className="ui-sm">{money(risk.cash)} available cash</span>
      </div>
    </div>

    {!accountingBalanced && <div className="ui-report-warning" role="status">
      <AlertCircle size={17}/><div><strong>Portfolio accounting does not reconcile</strong>
      <p>Check the ledger reconciliation before relying on these risk percentages. This view does not adjust balances to hide discrepancies.</p></div>
    </div>}
    {risk.unpricedCount > 0 && <div className="ui-report-warning" role="status">
      <AlertCircle size={17}/><div><strong>Incomplete price coverage</strong>
      <p>{risk.unpricedCount} position{risk.unpricedCount===1?' has':'s have'} no valid current quote. Concentration and stop percentages are based on priced positions and may understate exposure.</p></div>
    </div>}
    {risk.cash < 0 && <div className="ui-report-warning" role="status">
      <AlertCircle size={17}/><div><strong>Negative available cash</strong>
      <p>Check the broker ledger before interpreting the cash percentage as available buying power.</p></div>
    </div>}

    <section className="ui-report-section">
      <header className="ui-report-section-title">
        <h3>How concentrated am I?</h3>
        <p className="ui-sm">Weights use the current priced holdings value. Cash and reserved IPO capital are shown separately.</p>
      </header>
      <div className="ui-report-info-grid">
        <div className="ui-report-info"><span className="ui-sm">Largest holding</span>
          <strong>{risk.largestPosition?.ticker??'—'}</strong>
          <span className="ui-sm">{percent(risk.largestPosition?.holdingsSharePercent??null)} of priced holdings</span></div>
        <div className="ui-report-info"><span className="ui-sm">Top 3 holdings</span>
          <strong>{percent(risk.topThreeHoldingsPercent)}</strong>
          <span className="ui-sm">Combined share of priced holdings</span></div>
        <div className="ui-report-info"><span className="ui-sm">Largest sector</span>
          <strong>{risk.largestSector?.name??'—'}</strong>
          <span className="ui-sm">{percent(risk.largestSector?.holdingsPercent??null)} of priced holdings</span></div>
        <div className="ui-report-info"><span className="ui-sm">IPO capital reserved</span>
          <strong>{money(risk.pendingIpoValue)}</strong>
          <span className="ui-sm">Not available cash</span></div>
      </div>
      <div className="ui-risk-sectors" aria-label="Sector concentration">
        {risk.sectors.map((sector,i)=><div className="ui-risk-sector" key={sector.name}>
          <div className="ui-risk-sector-label">
            <span>{sector.name}</span><strong className="ui-mono">{percent(sector.holdingsPercent)}</strong>
          </div>
          <div className="ui-report-track"><span style={{width:`${Math.min(100,Math.max(0,sector.holdingsPercent))}%`,background:`var(--ui-allocation-${i%5})`}}/></div>
        </div>)}
        {!risk.sectors.length && <p className="ui-sm">No priced positions to rank yet.</p>}
      </div>
    </section>

    <section className="ui-report-section">
      <header className="ui-report-section-title ui-risk-stops-header">
        <div><h3>What happens if my stops trigger?</h3>
          <p className="ui-sm">Hypothetical fills at your entered stop prices, before future selling fees, gaps or slippage. Not a maximum-loss guarantee.</p>
        </div>
        {onOpenHoldings && <button className="ui-quiet-action" type="button" onClick={onOpenHoldings}>Manage stops</button>}
      </header>
      <div className="ui-report-info-grid">
        <div className="ui-report-info"><span className="ui-sm">Loss versus purchase cost at stops</span>
          <strong className="ui-mono">{covered?money(risk.capitalLossAtStops):'—'}</strong>
          <span className="ui-sm">Only holdings with usable stops; buy fees included</span></div>
        <div className="ui-report-info"><span className="ui-sm">Uncovered priced exposure</span>
          <strong className="ui-mono">{money(risk.uncoveredMarketValue)}</strong>
          <span className="ui-sm">{unprotected} missing, breached or invalid stops</span></div>
        <div className="ui-report-info"><span className="ui-sm">Covered exposure</span>
          <strong className="ui-mono">{money(risk.stopCoverageValue)}</strong>
          <span className="ui-sm">At current quotes</span></div>
        <div className="ui-report-info"><span className="ui-sm">Stop quality</span>
          <strong>{risk.missingStopCount} missing · {risk.breachedStopCount} breached</strong>
          <span className="ui-sm">{risk.invalidStopCount} invalid · {risk.unpricedCount} without quotes</span></div>
      </div>
      {(unprotected>0 || risk.unpricedCount>0) && <div className="ui-risk-notice">
        <ShieldAlert size={17}/><p><strong>This is not portfolio-wide downside.</strong> Stops that are missing, invalid, at/above the current quote, or cannot be priced are excluded from the downside calculation.</p>
      </div>}
      <div className="ui-risk-holdings" aria-label="Position stop-loss coverage">
        {risk.holdings.map(h => <div className="ui-risk-holding" key={h.id}>
          <span className="ui-risk-holding-main">
            <strong>{h.ticker}</strong><span className="ui-sm">{statusLabels[h.stopStatus]}</span>
          </span>
          <span className="ui-risk-holding-value">
            <strong>{h.quoteToStopDownside===null?'—':money(h.quoteToStopDownside)}</strong>
            <span className="ui-sm">{h.stopStatus==='invalid'?'Invalid recorded stop or cost':h.stopPrice!==null?`Stop ${formatEgp(h.stopPrice)}`:'No stop recorded'} · {h.marketValue===null?'Unpriced':money(h.marketValue)}</span>
          </span>
        </div>)}
        {!risk.holdings.length && <p className="ui-activity-empty">No open positions.</p>}
      </div>
    </section>

    <section className="ui-report-section">
      <header className="ui-report-section-title">
        <h3>Where has the pain come from?</h3>
        <p className="ui-sm">Separate closed-trade losses from current underwater positions. These are different measures, not interchangeable drawdowns.</p>
      </header>
      <div className="ui-report-info-grid">
        <div className="ui-report-info">
          <span className="ui-sm">Largest realized P&L drawdown</span>
          <strong className="ui-mono">{risk.realizedPeakToTrough===null?'—':money(risk.realizedPeakToTrough)}</strong>
          <span className="ui-sm">Peak-to-trough in cumulative closed-trade P&L, aggregated by exit day</span>
        </div>
        <div className="ui-report-info">
          <span className="ui-sm">Unrealized losses in losing holdings</span>
          <strong className={`ui-mono ${toneClass(-risk.underwaterHoldingsLoss)}`}>{money(risk.underwaterHoldingsLoss)}</strong>
          <span className="ui-sm">{risk.underwaterHoldingsCount} currently underwater positions, measured from entry cost</span>
        </div>
      </div>
      <p className="ui-report-note">Neither figure is historical peak-to-trough portfolio NAV drawdown. That requires a time series with adequate price and cash-flow coverage.</p>
    </section>
  </section>;
}
