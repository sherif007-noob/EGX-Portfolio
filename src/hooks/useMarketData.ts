import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, EGXTicker } from '../types';
import {
  fetchTradingViewEGXPrices,
  applyLivePricesToPortfolio,
  getEGXSessionStatus,
  EGXScheduleStatus,
} from '../services/marketPriceSync';
import { savePriceTickToFirestore } from '../services/firestoreStorage';
import { VISUAL_REGRESSION_MODE } from '../utils/visualRegressionMode';
import { cairoDateKey, isEgxTradingDay } from '../services/egxTradingCalendar';

const MARKET_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const CLOSING_HOUR_CAIRO = 15;
const CLOSING_MINUTE_CAIRO = 15;
const CLOSING_WINDOW_MINUTES = 15;

const VISUAL_SCHEDULE_STATUS: EGXScheduleStatus = {
  isSessionActive: false,
  cairoTimeString: '12:00 PM',
  cairoDateString: '09/30/2026',
  millisUntilNextTick: 15 * 60 * 1000,
  nextTickLabel: '12:15 PM',
};

export function useMarketData(
  positions: Position[],
  tickers: EGXTicker[],
  onUpdatePositions: (updated: Position[]) => void,
  onUpdateTickers?: (updated: EGXTicker[]) => void,
  onLivePricesSynced?: (updatedPositions: Position[], updatedTickers: EGXTicker[], manual: boolean) => void,
  ready = true
) {
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [lastPriceSyncTime, setLastPriceSyncTime] = useState<string | null>(VISUAL_REGRESSION_MODE ? '11:45:00 AM' : null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EGXScheduleStatus>(() => VISUAL_REGRESSION_MODE ? VISUAL_SCHEDULE_STATUS : getEGXSessionStatus());

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
    if (VISUAL_REGRESSION_MODE) return;
    const updateSchedule = () => setScheduleStatus(getEGXSessionStatus());
    updateSchedule();
    const timer = setInterval(updateSchedule, 10000);
    return () => clearInterval(timer);
  }, []);

  const syncLivePrices = useCallback(async (manual = false, forcePersist = false) => {
    if (VISUAL_REGRESSION_MODE) return { success: false, error: 'Live sync disabled in visual regression mode.' };
    if (!ready) return { success: false, error: 'Portfolio is still loading.' };
    // The scanner does not expose a trustworthy session timestamp. Refreshing
    // it on a verified closure would only re-stamp the last trading close as
    // if it were an active market quote (the Oct 8 false freshness incident).
    if (!isEgxTradingDay(cairoDateKey())) {
      return { success: false, error: 'EGX is closed. Last-session prices remain available; no new quote session was recorded.' };
    }
    if (isSyncingRef.current) return { success: false, error: 'Price sync already in progress.' };

    isSyncingRef.current = true;
    setIsSyncingPrices(true);
    setSyncError(null);

    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices(tickersRef.current);
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
  }, [onUpdatePositions, onUpdateTickers, ready]);

  const lastSuccessfulSyncRef = useRef(0);

  // Wait for the authoritative portfolio before fetching/applying quotes. Failed
  // startup requests retry, and suspended/offline tabs recover without a reload.
  useEffect(() => {
    if (VISUAL_REGRESSION_MODE || !ready) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (cancelled || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      // Auto startup/resume sync must not re-stamp yesterday's scanner prices as today's market session.
      // Manual Sync remains available for an explicit user request.
      if (!isEgxTradingDay(cairoDateKey())) return;
      if (Date.now() - lastSuccessfulSyncRef.current < 60_000) return;
      clearTimeout(retry);
      const result = await syncLivePrices(false, false);
      if (cancelled) return;
      if (result.success) lastSuccessfulSyncRef.current = Date.now();
      else retry = setTimeout(refresh, 30_000);
    };
    void refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ready, syncLivePrices]);

  // TradingView is delayed data. Keep automatic syncing on a strict 15-minute cadence,
  // aligned to quarter-hour boundaries. The 3:15 PM closing write is a separate deliberate
  // accounting event and is allowed even though the regular market session has ended.
  useEffect(() => {
    if (VISUAL_REGRESSION_MODE) return;

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

        const actualTradingDay = isEgxTradingDay(cairoDateKey);
        if (actualTradingDay && isClosingWindow && lastClosingSyncKeyRef.current !== cairoDateKey) {
          console.log('[MarketData] 3:15 PM Cairo closing valuation write.');
          const result = await syncLivePrices(false, true);
          if (result.success) lastClosingSyncKeyRef.current = cairoDateKey;
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
