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
  positionsRef.current = positions;
  tickersRef.current = tickers;
  onLivePricesSyncedRef.current = onLivePricesSynced;

  // This is a UI countdown only. It does not trigger market-data requests or Firestore writes.
  useEffect(() => {
    const updateSchedule = () => setScheduleStatus(getEGXSessionStatus());
    updateSchedule();
    const timer = setInterval(updateSchedule, 10000);
    return () => clearInterval(timer);
  }, []);

  const syncLivePrices = useCallback(async (manual = false, forceSave = false) => {
    if (isSyncingPrices) return { success: false, error: 'Price sync already in progress.' };

    setIsSyncingPrices(true);
    setSyncError(null);

    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices();

      if (Object.keys(quotes).length === 0) {
        throw new Error('No price quotes returned from TradingView.');
      }

      const { updatedPositions, updatedTickers, hasChanges } = applyLivePricesToPortfolio(
        positionsRef.current,
        tickersRef.current,
        quotes,
        discoveredTickers
      );

      if (hasChanges) {
        onUpdatePositions(updatedPositions);
        if (onUpdateTickers && updatedTickers.length > 0) {
          onUpdateTickers(updatedTickers);
        }
      }

      // TradingView is delayed market data and is supporting data for the ledger/performance app.
      // Persist it at most once per 15 minutes, except for an explicit manual/closing save.
      await savePriceTickToFirestore(
        hasChanges ? updatedPositions : positionsRef.current,
        hasChanges ? updatedTickers : tickersRef.current,
        manual || forceSave
      );

      if (onLivePricesSyncedRef.current) {
        onLivePricesSyncedRef.current(updatedPositions, updatedTickers, manual);
      }

      const now = new Date();
      setLastPriceSyncTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
      return { success: true, count: Object.keys(quotes).length };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to fetch prices from TradingView';
      console.error('Market Price Sync Error:', errMsg);
      setSyncError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsSyncingPrices(false);
    }
  }, [isSyncingPrices, onUpdatePositions, onUpdateTickers]);

  const hasInitialSyncedRef = useRef(false);
  const lastClosingSyncKeyRef = useRef<string>('');

  // One initial valuation refresh when the app opens. This is intentionally not a live poll.
  useEffect(() => {
    if (hasInitialSyncedRef.current) return;
    hasInitialSyncedRef.current = true;
    void syncLivePrices(false, false);
  }, [syncLivePrices]);

  // TradingView is delayed data. Keep the app on a strict 15-minute cadence rather than polling
  // every few seconds. The timeout is aligned to the next quarter-hour boundary.
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

        const cairoFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        });
        const parts = cairoFormatter.formatToParts(new Date());
        const getVal = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
        const year = getVal('year');
        const month = getVal('month');
        const day = getVal('day');
        const hour = getVal('hour');
        const minute = getVal('minute');
        const cairoDayMinutes = hour * 60 + minute;
        const todayClosingKey = `${year}-${month}-${day}-1515`;

        // One closing valuation after 3:15 PM Cairo time on a trading day.
        const isClosingWindow = cairoDayMinutes >= 915 && cairoDayMinutes <= 930;
        if (isClosingWindow && lastClosingSyncKeyRef.current !== todayClosingKey) {
          lastClosingSyncKeyRef.current = todayClosingKey;
          console.log('[MarketData] 3:15 PM Cairo closing valuation refresh.');
          await syncLivePrices(false, true);
        } else if (status.isSessionActive) {
          await syncLivePrices(false, false);
        }

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
    syncLivePrices: (manual = true) => syncLivePrices(manual, manual),
  };
}
