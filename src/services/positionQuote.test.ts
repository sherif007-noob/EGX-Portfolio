import { describe, expect, it } from 'vitest';
import { selectPositionQuote, trustedLivePrices } from './positionQuote';
import type { Position, EGXTicker } from '../types';
const position = { currentPrice: 100, dayChange: 2, priceUpdatedAt: '2026-09-27T10:00:00Z' } as Position;
const ticker = { lastPrice: 90, change: -8, priceUpdatedAt: '2026-09-27T09:00:00Z' } as EGXTicker;
describe('valuation quote precedence', () => {
  it('does not overwrite a fresh position with a stale directory quote', () => {
    expect(selectPositionQuote(position, ticker)).toMatchObject({ currentPrice: 100, dayChange: 2, priceUpdatedAt: position.priceUpdatedAt });
  });
  it('uses a newer directory quote and its timestamp together', () => {
    expect(selectPositionQuote(position, { ...ticker, priceUpdatedAt: '2026-09-27T11:00:00Z' })).toMatchObject({ currentPrice: 90, dayChange: -8 });
  });
  it('does not let bundled untimestamped prices replace persisted prices', () => {
    expect(selectPositionQuote(position, { ...ticker, priceUpdatedAt: undefined }).currentPrice).toBe(100);
  });
});

it('rejects mixed scanner snapshots and previous-session prices as live NAV', () => {
  const one = { ...position, ticker: 'AAA' };
  const two = { ...position, ticker: 'BBB', priceUpdatedAt: '2026-09-27T09:00:00Z' };
  const now = new Date('2026-09-27T10:01:00Z');
  expect(trustedLivePrices([one, two], '2026-09-27', now)).toEqual({});
  expect(trustedLivePrices([one], '2026-09-28', now)).toEqual({});
  expect(trustedLivePrices([one, { ...two, priceUpdatedAt: one.priceUpdatedAt }], '2026-09-27', now)).toEqual({ AAA: 100, BBB: 100 });
});

it('does not stamp old same-day prices as a fresh live endpoint', () => {
  expect(trustedLivePrices([{ ...position, ticker: 'TEST' }], '2026-09-27', new Date('2026-09-27T11:00:00Z'))).toEqual({});
  expect(trustedLivePrices([{ ...position, ticker: 'TEST' }], '2026-09-27', new Date('2026-09-27T12:00:00Z'))).toEqual({});
});
