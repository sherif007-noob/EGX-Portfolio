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
const CLOSING_HOUR_CAIRO = 15;
const CLOSING_MINUTE_CAIRO = 15;
const CLOSING_WINDOW_MINUTES = 15;

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
  const lastClosingSyncKeyRef = useRef<string | null>(null);
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

  const syncLivePrices = useCallback(async (manual = false, forcePersist = false) => {
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

      // Normal automatic persistence is throttled to 15 minutes. The dedicated 3:15 PM
      // Cairo closing event intentionally bypasses that throttle so the day's closing
      // valuation is persisted even when the preceding 15-minute sync was recent.
      await savePriceTickToFirestore(
        hasChanges ? updatedPositions : positionsRef.current,
        hasChanges ? updatedTickers : tickersRef.current,
        manual || forcePersist
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
    void syncLivePrices(false, false);
  }, [syncLivePrices]);

  // TradingView is delayed data. Keep automatic syncing on a strict 15-minute cadence,
  // aligned to quarter-hour boundaries. The 3:15 PM closing write is a separate deliberate
  // accounting event and is allowed even though the regular market session has ended.
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

        // Dedicated end-of-day closing valuation write. This intentionally uses forcePersist
        // so it cannot be suppressed by the normal 15-minute price-write throttle.
        const cairoParts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(new Date());
        const getPart = (type: string) => cairoParts.find((p) => p.type === type)?.value || '';
        const cairoHour = Number(getPart('hour'));
        const cairoMinute = Number(getPart('minute'));
        const cairoDateKey = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
        const cairoDayMinutes = cairoHour * 60 + cairoMinute;
        const closingStart = CLOSING_HOUR_CAIRO * 60 + CLOSING_MINUTE_CAIRO;
        const isClosingWindow = cairoDayMinutes >= closingStart && cairoDayMinutes < closingStart + CLOSING_WINDOW_MINUTES;

        if (isClosingWindow && lastClosingSyncKeyRef.current !== cairoDateKey) {
          lastClosingSyncKeyRef.current = cairoDateKey;
          console.log('[MarketData] 3:15 PM Cairo closing valuation write.');
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

  const syncLivePricesFromUi = useCallback(
    (manual = true) => syncLivePrices(manual, false),
    [syncLivePrices],
  );

  return {
    isSyncingPrices,
    lastPriceSyncTime,
    syncError,
    scheduleStatus,
    syncLivePrices: syncLivePricesFromUi,
  };
}
