import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PortfolioCompositionSnapshot } from './PortfolioCompositionSnapshot';

describe('simple portfolio composition view',()=>{
  it('renders one compact current financial snapshot with correct labels and total',()=>{
    const html=renderToStaticMarkup(<PortfolioCompositionSnapshot
      marketValue={900} availableCash={100} ipoHeld={400} nav={1400}/>);
    expect(html).toContain('Portfolio composition');
    expect(html).toContain('Holdings');
    expect(html).toContain('IPO reserved');
    expect(html).toContain('Available cash');
    expect(html).toContain('Total NAV');
    expect(html).toContain('1,400.00');
    expect(html).toContain('role="img"');
    expect(html).not.toContain('Return chart');
    expect(html).not.toContain('TWR');
  });
  it('reports an accounting discrepancy rather than concealing it in the bar',()=>{
    const html=renderToStaticMarkup(<PortfolioCompositionSnapshot
      marketValue={900} availableCash={100} ipoHeld={400} nav={1500}/>);
    expect(html).toContain('NAV and its components differ');
    expect(html).toContain('no amount has been automatically adjusted');
    expect(html).not.toContain('ui-composition-bar" role="img"');
  });
  it('moves composition into Reports Overview and retires the NAV chart selector',()=>{
    const reports=readFileSync(new URL('./SimpleReportsView.tsx',import.meta.url),'utf8');
    const homeChart=readFileSync(new URL('./HomeChart.tsx',import.meta.url),'utf8');
    expect(reports).toContain('<PortfolioCompositionSnapshot');
    expect(reports).toContain("mode==='overview'");
    expect(homeChart).not.toContain("label: 'NAV breakdown'");
    expect(homeChart).not.toContain("mode === 'val'");
    expect(homeChart).not.toContain("mode==='val'");
    expect(homeChart).toContain("{ value: 'dep', label: 'vs Deposits' }");
    expect(homeChart).toContain("['ret', 'dep', 'bm'].includes");
    expect(homeChart).toContain("Total return · selected range");
  });
});
