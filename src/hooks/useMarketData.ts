import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, EGXTicker } from '../types';
import {
  fetchTradingViewEGXPrices,
  applyLivePricesToPortfolio,
  getEGXSessionStatus,
  EGXScheduleStatus,
} from '../services/marketPriceSync';
import { savePriceTickToFirestore } from '../services/firestoreStorage';

const MARKET_SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function useMarketData(
  positions: Position[],
  tickers: EGXTicker[],
  onUpdatePositions: (updated: Position[]) => void,
  onUpdateTickers?: (updated: EGXTicker[]) => void,
  onLivePricesSynced?: (updatedPositions: Position[], updatedTickers: EGXTicker[], manual: boolean) => void
) {
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [lastPriceSyncTime, setLastPriceSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EGXScheduleStatus>(() => getEGXSessionStatus());

  const positionsRef = useRef(positions);
  const tickersRef = useRef(tickers);
  const onLivePricesSyncedRef = useRef(onLivePricesSynced);
  const isSyncingRef = useRef(false);
  positionsRef.current = positions;
  tickersRef.current = tickers;
  onLivePricesSyncedRef.current = onLivePricesSynced;

  // UI countdown only. It does not trigger market-data requests or Firestore writes.
  useEffect(() => {
    const updateSchedule = () => setScheduleStatus(getEGXSessionStatus());
    updateSchedule();
    const timer = setInterval(updateSchedule, 10000);
    return () => clearInterval(timer);
  }, []);

  const syncLivePrices = useCallback(async (manual = false) => {
    if (isSyncingRef.current) return { success: false, error: 'Price sync already in progress.' };

    isSyncingRef.current = true;
    setIsSyncingPrices(true);
    setSyncError(null);

    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices();
      if (Object.keys(quotes).length === 0) throw new Error('No price quotes returned from TradingView.');

      const { updatedPositions, updatedTickers, hasChanges } = applyLivePricesToPortfolio(
        positionsRef.current,
        tickersRef.current,
        quotes,
        discoveredTickers
      );

      if (hasChanges) {
        onUpdatePositions(updatedPositions);
        if (onUpdateTickers && updatedTickers.length > 0) onUpdateTickers(updatedTickers);
      }

      // TradingView is delayed market data and is supporting data for the ledger/performance app.
      // Automatic persistence is throttled to 15 minutes by firestoreStorage. Manual refreshes
      // may persist immediately when explicitly requested by the user.
      await savePriceTickToFirestore(
        hasChanges ? updatedPositions : positionsRef.current,
        hasChanges ? updatedTickers : tickersRef.current,
        manual
      );

      onLivePricesSyncedRef.current?.(updatedPositions, updatedTickers, manual);
      setLastPriceSyncTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      }));
      return { success: true, count: Object.keys(quotes).length };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to fetch prices from TradingView';
      console.error('Market Price Sync Error:', errMsg);
      setSyncError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      isSyncingRef.current = false;
      setIsSyncingPrices(false);
    }
  }, [onUpdatePositions, onUpdateTickers]);

  const hasInitialSyncedRef = useRef(false);

  // One initial valuation refresh when the app opens. This is intentionally not a live poll.
  useEffect(() => {
    if (hasInitialSyncedRef.current) return;
    hasInitialSyncedRef.current = true;
    void syncLivePrices(false);
  }, [syncLivePrices]);

  // TradingView is delayed data. Keep automatic syncing on a strict 15-minute cadence.
  // The timer is aligned to quarter-hour boundaries; there is no 20-second market poll.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextSync = () => {
      if (cancelled) return;
      const now = Date.now();
      const nextBoundary = Math.ceil((now + 1000) / MARKET_SYNC_INTERVAL_MS) * MARKET_SYNC_INTERVAL_MS;
      const delay = Math.max(1000, nextBoundary - now);

      timer = setTimeout(async () => {
        if (cancelled) return;
        const status = getEGXSessionStatus();
        setScheduleStatus(status);
        if (status.isSessionActive) await syncLivePrices(false);
        scheduleNextSync();
      }, delay);
    };

    scheduleNextSync();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [syncLivePrices]);

  return {
    isSyncingPrices,
    lastPriceSyncTime,
    syncError,
    scheduleStatus,
    syncLivePrices: (manual = true) => syncLivePrices(manual),
  };
}
