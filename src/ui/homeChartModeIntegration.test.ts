import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const home=readFileSync(new URL('./HomeChart.tsx',import.meta.url),'utf8');
const hero=readFileSync(new URL('./HomeScreen.tsx',import.meta.url),'utf8');

describe('Return comparison without an extra chart mode',()=>{
  it('preserves one Return mode with an inline opt-in NAV comparison',()=>{
    expect(home).toContain("{ value: 'ret', label: 'Return' }");
    expect(home).toContain('setComparePortfolio(on=>!on)');
    expect(home).toContain("key:'nav',label:'Portfolio NAV (EGP)'");
    expect(home).toContain('yAxisId="nav"');
    expect(home).toContain('yAxisId="primary"');
    expect(home).toContain('NAV (blue, right scale)');
    expect(home).not.toContain("value: 'portfolioVsReturn'");
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
