import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, EGXTicker } from '../types';
import {
  fetchTradingViewEGXPrices,
  applyLivePricesToPortfolio,
  getEGXSessionStatus,
  EGXScheduleStatus,
} from '../services/marketPriceSync';

export function useMarketData(
  positions: Position[],
  tickers: EGXTicker[],
  onUpdatePositions: (updated: Position[]) => void,
  onUpdateTickers?: (updated: EGXTicker[]) => void
) {
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [lastPriceSyncTime, setLastPriceSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EGXScheduleStatus>(() => getEGXSessionStatus());

  // Ref to track positions and tickers without stale closure dependencies
  const positionsRef = useRef(positions);
  const tickersRef = useRef(tickers);
  positionsRef.current = positions;
  tickersRef.current = tickers;

  // Refresh EGX market session countdown timer every 10 seconds
  useEffect(() => {
    const updateSchedule = () => {
      setScheduleStatus(getEGXSessionStatus());
    };
    updateSchedule();
    const timer = setInterval(updateSchedule, 10000);
    return () => clearInterval(timer);
  }, []);

  // Perform Live Market Price Sync
  const syncLivePrices = useCallback(async (manual = false) => {
    setIsSyncingPrices(true);
    setSyncError(null);

    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices();

      if (Object.keys(quotes).length > 0) {
        const { updatedPositions, updatedTickers } = applyLivePricesToPortfolio(
          positionsRef.current,
          tickersRef.current,
          quotes,
          discoveredTickers
        );

        onUpdatePositions(updatedPositions);
        if (onUpdateTickers && updatedTickers.length > 0) {
          onUpdateTickers(updatedTickers);
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

  // Initial price sync on mount if session is active or on start
  useEffect(() => {
    const initialSyncTimer = setTimeout(() => {
      syncLivePrices(false);
    }, 1500);
    return () => clearTimeout(initialSyncTimer);
  }, [syncLivePrices]);

  // Scheduled interval sync during active Cairo trading hours
  useEffect(() => {
    const checkScheduleAndSync = () => {
      const status = getEGXSessionStatus();
      setScheduleStatus(status);
      if (status.isSessionActive && status.millisUntilNextTick < 15000) {
        syncLivePrices(false);
      }
    };

    const interval = setInterval(checkScheduleAndSync, 30000);
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
