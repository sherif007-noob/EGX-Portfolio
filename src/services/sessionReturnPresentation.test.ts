import {describe,expect,it} from 'vitest';
import { sessionChangePercent } from './sessionReturnPresentation';

describe('broker-comparable session change percentage',()=>{
  it('shares the exact Home hero and tooltip reference capital after a deposit',()=>{
    const nav=125349.72;
    const gain=265.04;
    const percent=sessionChangePercent(gain,nav);
    expect(percent).not.toBeNull();
    expect(percent).toBeCloseTo(gain/(nav-gain)*100,10);
    expect(percent).toBeCloseTo(0.211886,3);
  });
  it('keeps a pure deposit out of return, even when NAV is much larger',()=>{
    expect(sessionChangePercent(0,130000)).toBe(0);
  });
  it('requires a valid reference capital, never produces an invented percentage',()=>{
    expect(sessionChangePercent(0,0)).toBeNull();
    expect(sessionChangePercent(300,200)).toBeNull();
    expect(sessionChangePercent(Number.NaN,1000)).toBeNull();
  });
});
