import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const home=readFileSync(new URL('./HomeChart.tsx',import.meta.url),'utf8');
const hero=readFileSync(new URL('./HomeScreen.tsx',import.meta.url),'utf8');

describe('Return comparison without an extra chart mode',()=>{
  it('renders the NAV comparison as a separate, date-synchronized panel',()=>{
    expect(home).toContain("{ value: 'ret', label: 'Return' }");
    expect(home).toContain('setComparePortfolio(on=>!on)');
    expect(home).toContain('nav:points[index].equity');
    expect(home).toContain('syncId="medium-return-nav"');
    expect(home).toContain('Portfolio NAV comparison');
    expect(home).toContain('ui-chart-canvas-nav');
    expect(home).toContain('domain={[0,\'auto\']}');
    expect(home).toContain('P&amp;L excludes funding; NAV includes deposits and withdrawals.');
    expect(home).not.toContain('yAxisId="nav"');
    expect(home).not.toContain("key:'nav',label:'Portfolio NAV (EGP)'");
    expect(home).not.toContain("value: 'portfolioVsReturn'");
  });
  it('places transfer markers only at real daily dates, never invented intraday clocks',()=>{
    expect(home).toContain('row.nav');
    expect(home).toContain("timeframe!=='TODAY'&&visibleCapitalEvents");
    expect(home).toContain('visibleCapitalEvents.slice(-4).map');
    expect(home).toContain('Cash events are grouped by date, not plotted at an assumed intraday time.');
    expect(home).toContain('Deposit +{formatEgp(event.deposited)} EGP');
  });
  it('plots independently calculated TWR and MWR on a comparison overlay',()=>{
    expect(home).toContain("point.twrPercent");
    expect(home).toContain("point.mwrrPercent");
    expect(home).toContain("mode === 'twr' || mode === 'mwr'");
    expect(home).toContain("MWR − TWR");
    expect(home).toContain('ComposedChart');
    expect(home).toContain('money-weighting uses date-only timing');
  });
  it('keeps latest session gain in the hero even when the regular market is closed',()=>{
    expect(hero).toContain('marketSession.isRegularTradingHours');
    expect(hero).toContain('marketSession.lastSessionCaption');
    expect(hero).toContain('formatSigned(today)');
    expect(hero).toContain('formatPercent(metrics.dayChangePercent)');
    expect(hero).not.toContain('EGX closed');
  });
});
