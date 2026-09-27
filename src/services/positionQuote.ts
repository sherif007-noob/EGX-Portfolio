import { egxCairoSessionClock } from './egxTradingSession';
import { INTRADAY_POLICY } from './intradayPolicy';
import type { Position, EGXTicker } from '../types';

/** One price precedence rule for hydration and ledger reconstruction. */
export function selectPositionQuote(position?: Position, ticker?: EGXTicker, fallback = 0) {
  const positionValid = Number.isFinite(position?.currentPrice) && position!.currentPrice > 0;
  const tickerValid = Number.isFinite(ticker?.lastPrice) && ticker!.lastPrice > 0;
  const positionTime = Date.parse(position?.priceUpdatedAt ?? '') || 0;
  const tickerTime = Date.parse(ticker?.priceUpdatedAt ?? '') || 0;
  if (tickerValid && (!positionValid || tickerTime > positionTime)) {
    return { currentPrice: ticker!.lastPrice, dayChange: ticker!.change,
      dayChangePercent: ticker!.changePercent, priceUpdatedAt: ticker!.priceUpdatedAt };
  }
  return { currentPrice: positionValid ? position!.currentPrice : fallback,
    dayChange: position?.dayChange, dayChangePercent: position?.dayChangePercent,
    priceUpdatedAt: position?.priceUpdatedAt };
}

/** Only a complete, contemporaneous scanner snapshot can anchor live NAV. */
export function trustedLivePrices(positions: Position[], sessionDate: string, now = new Date()) {
  const prices: Record<string, number> = {};
  const clock = egxCairoSessionClock(now);
  let snapshot: number | undefined;
  for (const position of positions) {
    const timestamp = Date.parse(position.priceUpdatedAt ?? '');
    if (!Number.isFinite(timestamp) || timestamp > now.getTime() || !Number.isFinite(position.currentPrice) || position.currentPrice <= 0) return {};
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
    const value = (name: string) => parts.find(p => p.type === name)?.value;
    if (`${value('year')}-${value('month')}-${value('day')}` !== sessionDate) return {};
    if (snapshot !== undefined && timestamp !== snapshot) return {};
    if (clock.isRegularSession && now.getTime() - timestamp > 20 * 60_000) return {};
    if (clock.dateKey === sessionDate && clock.minuteOfDay >= INTRADAY_POLICY.sessionEndMinutes &&
      egxCairoSessionClock(new Date(timestamp)).minuteOfDay < INTRADAY_POLICY.sessionEndMinutes) return {};
    snapshot = timestamp;
    prices[position.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '')] = position.currentPrice;
  }
  return prices;
}
