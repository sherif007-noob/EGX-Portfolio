import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, EGXTicker } from '../types';
import {
  fetchTradingViewEGXPrices,
  applyLivePricesToPortfolio,
  getEGXSessionStatus,
  EGXScheduleStatus,
} from '../services/marketPriceSync';
import { savePriceTickToFirestore } from '../services/firestoreStorage';

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

  // Ref to track positions and tickers without stale closure dependencies
  const positionsRef = useRef(positions);
  const tickersRef = useRef(tickers);
  const onLivePricesSyncedRef = useRef(onLivePricesSynced);
  positionsRef.current = positions;
  tickersRef.current = tickers;
  onLivePricesSyncedRef.current = onLivePricesSynced;

  // Refresh EGX market session countdown timer every 10 seconds
  useEffect(() => {
    const updateSchedule = () => {
      setScheduleStatus(getEGXSessionStatus());
    };
    updateSchedule();
    const timer = setInterval(updateSchedule, 10000);
    return () => clearInterval(timer);
  }, []);

  // Perform Live Market Price Sync & Firestore persistence
  const syncLivePrices = useCallback(async (manual = false, isTick = false, forceSave = false) => {
    setIsSyncingPrices(true);
    setSyncError(null);

    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices();

      if (Object.keys(quotes).length > 0) {
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

        // Persist price updates to Firebase Firestore:
        // - Always force write on manual refresh or 3:15 PM closing session
        // - Throttle write during regular 15-minute session ticks
        if (manual || forceSave || isTick) {
          await savePriceTickToFirestore(
            hasChanges ? updatedPositions : positionsRef.current,
            hasChanges ? updatedTickers : tickersRef.current,
            manual || forceSave
          );
        }

        if (onLivePricesSyncedRef.current) {
          onLivePricesSyncedRef.current(updatedPositions, updatedTickers, manual);
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setLastPriceSyncTime(timeStr);
        return { success: true, count: Object.keys(quotes).length };
      } else {
        throw new Error('No price quotes returned from TradingView.');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to fetch live prices from TradingView';
      console.error('Market Price Sync Error:', errMsg);
      setSyncError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsSyncingPrices(false);
    }
  }, [onUpdatePositions, onUpdateTickers]);

  const hasInitialSyncedRef = useRef(false);
  const lastClosingSyncKeyRef = useRef<string>('');

  // Initial price sync on mount if session is active or on start
  useEffect(() => {
    if (hasInitialSyncedRef.current) return;
    hasInitialSyncedRef.current = true;
    syncLivePrices(false);
  }, [syncLivePrices]);

  // Scheduled interval sync during active Cairo trading hours & 3:15 PM closing update
  useEffect(() => {
    const checkScheduleAndSync = () => {
      const status = getEGXSessionStatus();
      setScheduleStatus(status);

      // Check for 3:15 PM Cairo closing price update (15:15 to 15:25)
      const now = new Date();
      const cairoDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = cairoDateFormatter.formatToParts(now);
      const getVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
      const year = getVal('year');
      const month = getVal('month');
      const day = getVal('day');
      const hour = getVal('hour');
      const minute = getVal('minute');
      const cairoDayMinutes = hour * 60 + minute;
      const todayClosingKey = `${year}-${month}-${day}-1515`;

      // If at or past 3:15 PM Cairo time (915 mins) on a trading day and closing sync has not run for today:
      if (cairoDayMinutes >= 915 && cairoDayMinutes <= 930 && lastClosingSyncKeyRef.current !== todayClosingKey) {
        lastClosingSyncKeyRef.current = todayClosingKey;
        console.log('[MarketData] 3:15 PM EGX closing price update triggered — updating Firebase database...');
        syncLivePrices(false, true, true);
        return;
      }

      if (status.isSessionActive && status.millisUntilNextTick < 15000) {
        syncLivePrices(false, true, false);
      } else if (status.isSessionActive) {
        syncLivePrices(false, false, false);
      }
    };

    const interval = setInterval(checkScheduleAndSync, 20000);
    return () => clearInterval(interval);
  }, [syncLivePrices]);

  return {
    isSyncingPrices,
    lastPriceSyncTime,
    syncError,
    scheduleStatus,
    syncLivePrices,
  };
}
