import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import {
  KORA_RIGHTS_2026,
  sharesHeldAtRightsCutoff,
  previewRightsEntitlement,
  projectRightsLifecycle,
  theoreticalExRightsBridge,
} from './rightsOfferings';

function trade(id: string, type: 'BUY' | 'SELL', date: string, shares: number): TradeTransaction {
  return {
    id, type, date, shares, ticker:'KORA', companyName:'Korra',
    sector:'Other', price:5, fees:0, totalAmount:shares*5,
  };
}

describe('EGX KORA October 2026 rights detachment', () => {
  it('keeps exact official issue terms and never treats the reference right price as live', () => {
    expect(KORA_RIGHTS_2026.parentIsin).toBe('EGS07911C018');
    expect(KORA_RIGHTS_2026.rightsIsin).toBe('EGS924O1C014');
    expect(KORA_RIGHTS_2026.newSharesPerExistingShare).toBe(0.9);
    expect(KORA_RIGHTS_2026.subscriptionPriceEgp).toBe(0.205);
    expect(KORA_RIGHTS_2026.entitlementCutoffDate).toBe('2026-10-13');
    expect(KORA_RIGHTS_2026.exRightsDate).toBe('2026-10-14');
    expect(KORA_RIGHTS_2026.indicativeRightOpeningPriceEgp).toBe(2.32);
    expect(KORA_RIGHTS_2026.rightsTradingConditional).toBe(true);
  });

  it('replays original KORA trades through cutoff, ignoring sales after detachment', () => {
    const ledger=[
      trade('sep-buy','BUY','2026-09-01',1000),
      trade('sep-sell','SELL','2026-09-07',1000),
      trade('oct-buy','BUY','2026-10-01',650),
      trade('ex-sell','SELL','2026-10-14',300),
      trade('after-buy','BUY','2026-10-14',40),
    ];
    const before=structuredClone(ledger);
    expect(sharesHeldAtRightsCutoff(ledger,KORA_RIGHTS_2026)).toBe(650);
    expect(ledger).toEqual(before);
  });

  it('computes 585 theoretical rights and 119.925 EGP, with zero cash debit and zero new shares today', () => {
    const entitled=previewRightsEntitlement(KORA_RIGHTS_2026,650);
    expect(entitled).toMatchObject({
      heldOriginalShares:650, theoreticalRights:585, estimatedWholeRights:585,
      subscriptionCostEgp:119.925, indicativeRightsReferenceValueEgp:1357.2,
      cashDebitTodayEgp:0,newSharesAlreadyCredited:0,
      sharesAfterConfirmedFullExercise:1235,requiresBrokerConfirmation:true,
    });
  });

  it('preserves theoretical economic value across KORA 13→14 Oct detachment', () => {
    const indicative=theoreticalExRightsBridge(KORA_RIGHTS_2026,4.62,650);
    expect(indicative.valueType).toBe('THEORETICAL_ONLY');
    expect(indicative.preDetachEquityEgp).toBeCloseTo(3003,8);
    expect(indicative.theoreticalRights).toBe(585);
    expect(indicative.theoreticalExRightsSharePriceEgp).toBeCloseTo(2.5286842105,8);
    expect(indicative.theoreticalRightPriceEgp).toBeCloseTo(2.3236842105,8);
    expect(
      indicative.postDetachSharesValueEgp + indicative.detachedRightsValueEgp,
    ).toBeCloseTo(indicative.preDetachEquityEgp,8);
    // No physical stock or shares have been bought with subscription cash yet.
  });

  it('treats fractional entitlements as broker-confirmation pending, not a free fractional listed share', () => {
    const entitled=previewRightsEntitlement(KORA_RIGHTS_2026,1);
    expect(entitled.theoreticalRights).toBe(0.9);
    expect(entitled.estimatedWholeRights).toBe(0);
    expect(entitled.residualFractionalRights).toBeCloseTo(0.9);
    expect(entitled.subscriptionCostEgp).toBe(0);
  });

  it('records an exercise separately from the later credit of additional shares', () => {
    const operations=[
      {type:'EXERCISE_RIGHTS' as const, date:'2026-10-18',quantity:585,actualCashEgp:119.925},
    ];
    const pending=projectRightsLifecycle(KORA_RIGHTS_2026,585,operations);
    expect(pending).toEqual({
      availableRights:0,exercisedRights:585,pendingShares:585,
      creditedShares:0,cashMovementEgp:-119.925,
    });
    const credited=projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      ...operations,{type:'CREDIT_NEW_SHARES',date:'2026-11-20',quantity:585},
    ]);
    expect(credited.pendingShares).toBe(0);
    expect(credited.creditedShares).toBe(585);
  });

  it('allows separately recording a sale of rights without reducing original KORA shares', () => {
    const result=projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      {type:'SELL_RIGHTS',date:'2026-10-19',quantity:200,grossCashEgp:450,feesEgp:3},
    ]);
    expect(result).toMatchObject({
      availableRights:385,creditedShares:0,cashMovementEgp:447,
    });
  });

  it('rejects double selling/exercising, premature expiry, and credit before exercise', () => {
    expect(()=>projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      {type:'SELL_RIGHTS',date:'2026-10-19',quantity:400,grossCashEgp:900},
      {type:'EXERCISE_RIGHTS',date:'2026-10-19',quantity:200,actualCashEgp:41},
    ])).toThrow('Cannot exercise more rights than held');
    expect(()=>projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      {type:'CREDIT_NEW_SHARES',date:'2026-10-19',quantity:1},
    ])).toThrow('Cannot credit more new shares');
    expect(()=>projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      {type:'EXPIRE_RIGHTS',date:'2026-10-20',quantity:585},
    ])).toThrow('Do not mark rights expired');
    expect(()=>projectRightsLifecycle(KORA_RIGHTS_2026,585,[
      {type:'SELL_RIGHTS',date:'2026-10-14',quantity:1,grossCashEgp:2.32},
    ])).toThrow('announced trading dates');
  });

  it('does not classify rights as a bonus-share capital action', () => {
    expect(sharesHeldAtRightsCutoff([
      trade('holding','BUY','2026-10-01',650),
      {
        ...trade('rights-draft','BUY','2026-10-12',585),
        type:'CORPORATE_ACTION',
        corporateActionType:'RIGHTS_SUBSCRIPTION',
      },
    ],KORA_RIGHTS_2026)).toBe(650);
  });
});
