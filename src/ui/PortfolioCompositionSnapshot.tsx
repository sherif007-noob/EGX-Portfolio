import React, { useMemo } from 'react';
import { portfolioCompositionModel } from './portfolioCompositionModel';
import { formatEgp } from './format';

interface Props {
  marketValue: number;
  availableCash: number;
  ipoHeld: number;
  nav: number;
}

export function PortfolioCompositionSnapshot({marketValue,availableCash,ipoHeld,nav}:Props) {
  const composition=useMemo(
    ()=>portfolioCompositionModel(marketValue,availableCash,ipoHeld,nav),
    [marketValue,availableCash,ipoHeld,nav],
  );
  const sections=[
    { key:'holdings',label:'Holdings',value:composition.marketValue,share:composition.shares.market,className:'holdings' },
    { key:'ipo',label:'IPO reserved',value:composition.ipoHeld,share:composition.shares.ipo,className:'ipo' },
    { key:'cash',label:'Available cash',value:composition.availableCash,share:composition.shares.cash,className:'cash' },
  ];
  return <section className="ui-composition-snapshot" aria-label="Current portfolio composition">
    <div className="ui-composition-heading">
      <h3>Portfolio composition</h3>
      <span className="ui-sm">Current snapshot</span>
    </div>
    <p className="ui-sm ui-composition-hint">Where your NAV is currently held — not a return or profit chart.</p>
    {composition.hasAllocatableBar ? (
      <div className="ui-composition-bar" role="img"
        aria-label={sections.map(item=>`${item.label}: ${formatEgp(item.value)} EGP (${item.share.toFixed(1)}%)`).join('; ')}>
        {sections.filter(item=>item.share>0).map(item=>
          <span key={item.key} className={`ui-composition-segment ${item.className}`}
            style={{width:`${item.share}%`}} aria-hidden="true"/>)}
      </div>
    ) : (
      <p className="ui-sm">Composition proportions unavailable while the balances are being reconciled.</p>
    )}
    <div className="ui-composition-lines">
      {sections.map(item=><div className="ui-composition-line" key={item.key}>
        <span className="ui-composition-label">
          <span className={`ui-composition-dot ${item.className}`} aria-hidden="true"/>
          {item.label}
        </span>
        <strong className="ui-mono">{formatEgp(item.value)} <small>EGP</small></strong>
      </div>)}
    </div>
    <div className="ui-composition-total">
      <span>Total NAV</span>
      <strong className="ui-mono">{formatEgp(composition.nav)} <small>EGP</small></strong>
    </div>
    {Math.abs(composition.reconciliationDifference)>0.02 && (
      <p role="status" className="ui-composition-warning">
        NAV and its components differ by {formatEgp(composition.reconciliationDifference)} EGP.
        Check portfolio reconciliation; no amount has been automatically adjusted.
      </p>
    )}
  </section>;
}
