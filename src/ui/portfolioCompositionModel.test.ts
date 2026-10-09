import { describe, expect, it } from 'vitest';
import { portfolioCompositionModel } from './portfolioCompositionModel';

describe('Overview current NAV composition',()=>{
  it('displays the real ledger components without mistaking a deposit for profit',()=>{
    const snapshot=portfolioCompositionModel(900,100,400,1400);
    expect(snapshot.componentsTotal).toBe(1400);
    expect(snapshot.reconciliationDifference).toBe(0);
    expect(snapshot.hasAllocatableBar).toBe(true);
    expect(snapshot.shares.market).toBeCloseTo(900/1400*100,8);
    expect(snapshot.shares.cash).toBeCloseTo(100/1400*100,8);
    expect(snapshot.shares.ipo).toBeCloseTo(400/1400*100,8);
    expect(Object.values(snapshot.shares).reduce((a,b)=>a+b,0)).toBeCloseTo(100,8);
  });
  it('keeps a deposit as cash rather than manufacturing portfolio performance',()=>{
    const before=portfolioCompositionModel(900,100,400,1400);
    const after=portfolioCompositionModel(900,600,400,1900);
    expect(after.marketValue).toBe(before.marketValue);
    expect(after.availableCash-before.availableCash).toBe(500);
    expect(after.nav-before.nav).toBe(500);
    expect(after.reconciliationDifference).toBe(0);
  });
  it('does not mask mismatched cash/NAV balances by forcing percentages',()=>{
    const snapshot=portfolioCompositionModel(900,100,400,1500);
    expect(snapshot.hasAllocatableBar).toBe(false);
    expect(snapshot.reconciliationDifference).toBe(100);
    expect(Object.values(snapshot.shares)).toEqual([0,0,0]);
  });
  it('does not falsely render a positive-only proportion when available cash is negative',()=>{
    const snapshot=portfolioCompositionModel(900,-100,400,1200);
    expect(snapshot.hasAllocatableBar).toBe(false);
    expect(snapshot.availableCash).toBe(-100);
    expect(snapshot.nav).toBe(1200);
  });
});
