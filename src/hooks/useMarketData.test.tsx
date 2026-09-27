// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('../services/marketPriceSync', async importOriginal => ({
  ...await importOriginal<typeof import('../services/marketPriceSync')>(),
  fetchTradingViewEGXPrices: mocks.fetch,
}));
vi.mock('../services/firestoreStorage', () => ({ savePriceTickToFirestore: mocks.save }));
import { useMarketData } from './useMarketData';
import type { Position } from '../types';

let root: Root;
const update = vi.fn();
const position = { id: 'p', ticker: 'TEST', shares: 7, currentPrice: 9 } as Position;
function Harness({ ready, positions = [position] }: { ready: boolean; positions?: Position[] }) {
  useMarketData(positions, [], update, undefined, undefined, ready);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T08:01:00Z'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  mocks.fetch.mockReset().mockResolvedValue({ quotes: { TEST: { ticker: 'TEST', price: 10, change: 1, changePercent: 10 } }, discoveredTickers: [] });
  mocks.save.mockReset().mockResolvedValue(true);
  update.mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('market sync lifecycle', () => {
  it('waits for remote hydration and applies quotes to the loaded share count', async () => {
    await act(async () => root.render(<Harness ready={false} positions={[]} />));
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => root.render(<Harness ready />));
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0][0]).toMatchObject({ shares: 7, currentPrice: 10 });
  });
  it('retries a failed startup without requiring manual sync or hard refresh', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('temporary failure'));
    await act(async () => root.render(<Harness ready />));
    expect(update).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
  });
  it('refreshes when a suspended tab becomes visible again', async () => {
    await act(async () => root.render(<Harness ready />));
    await act(async () => vi.advanceTimersByTimeAsync(61_000));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
