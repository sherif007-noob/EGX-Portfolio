import 'dotenv/config';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import { resolveTradingViewInstrument } from '../src/services/tradingViewSymbolResolver';

type HistoryBar = [number, number, number, number, number, number?];

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function readCount(): number {
  const parsed = Number(process.env.EGX_1M_DIAGNOSTIC_BAR_COUNT || 5000);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.min(Math.trunc(parsed), 20000);
}

function summarizeBars(bars: HistoryBar[]) {
  const valid = bars
    .filter((bar) => Number.isFinite(Number(bar?.[0])) && Number.isFinite(Number(bar?.[4])) && Number(bar[4]) > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  const timestamps = valid.map((bar) => Number(bar[0]));
  const positiveDeltas = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index])
    .filter((delta) => Number.isFinite(delta) && delta > 0)
    .sort((a, b) => a - b);

  return {
    bars: valid.length,
    first: valid.length ? new Date(timestamps[0] * 1000).toISOString() : null,
    last: valid.length ? new Date(timestamps[timestamps.length - 1] * 1000).toISOString() : null,
    minimumObservedGapSeconds: positiveDeltas[0] ?? null,
    medianObservedGapSeconds: positiveDeltas.length
      ? positiveDeltas[Math.floor(positiveDeltas.length / 2)]
      : null,
  };
}

async function main() {
  const tickers = (process.env.EGX_1M_DIAGNOSTIC_TICKERS || 'ACTF,NAPR,ORAS,QNBA')
    .split(',')
    .map(normalizeTicker)
    .filter(Boolean);
  const count = readCount();

  console.log(`TradingView 1-minute diagnostic: tickers=${tickers.join(',')} requestedBars=${count}`);
  console.log('This diagnostic is read-only and does not write to Supabase.');

  const session = await createSession();
  try {
    const chart = await createChart(session);

    for (const ticker of tickers) {
      try {
        const resolution = await resolveTradingViewInstrument(chart, { ticker });
        const series = await createSeries(session, chart, resolution.resolved, '1', count);
        try {
          const summary = summarizeBars((series.history || []) as HistoryBar[]);
          console.log(JSON.stringify({
            ticker,
            resolvedSymbol: resolution.symbol,
            resolutionMethod: resolution.method,
            requestedBars: count,
            ...summary,
          }));
        } finally {
          await series.close();
        }
      } catch (error) {
        console.error(JSON.stringify({
          ticker,
          error: error instanceof Error ? error.message : String(error),
        }));
        process.exitCode = 1;
      }
    }
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
