import { describe, expect, it } from 'vitest';
import { calculateIpoOrderQuote } from './ipoOrderQuote';

describe('IPO quote from shares and price per share', () => {
  it('derives full EGP commitment and 25% cash hold from shares, never vice versa', () => {
    const quote = calculateIpoOrderQuote(4_000, 25, 25);
    expect(quote).toEqual({
      requestedShares: 4_000,
      offerPrice: 25,
      requestedAmount: 100_000,
      holdPercent: 25,
      reservedAmount: 25_000,
    });
  });
  it('retains exact whole shares with fractional-piastre quotes and rounds only money', () => {
    const quote = calculateIpoOrderQuote(4_001, 0.73, 25);
    expect(quote.requestedShares).toBe(4_001);
    expect(quote.requestedAmount).toBe(2_920.73);
    expect(quote.reservedAmount).toBe(730.18);
  });
  it('defaults only when explicitly supplied with a 100% hold', () => {
    const quote = calculateIpoOrderQuote(100, 24.5, 100);
    expect(quote.reservedAmount).toBe(quote.requestedAmount);
  });
  it.each([
    [0, 25, 25],
    [-2, 25, 25],
    [2.5, 25, 25],
    [Number.NaN, 25, 25],
    [2, 0, 25],
    [2, -1, 25],
    [2, 25, 0],
    [2, 25, 101],
    [2, 25, Number.NaN],
  ])('rejects invalid IPO order shares=%s price=%s hold=%s', (shares,price,hold) => {
    expect(() => calculateIpoOrderQuote(shares,price,hold)).toThrow();
  });
});
