import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, EGXTicker, PriceAlertSettings, TriggeredPriceAlert, PriceAlertTriggerType } from '../types';
import {
  getAlertSettings,
  saveAlertSettings,
  getAlertHistory,
  saveAlertHistory,
  clearAlertHistory as clearStorageHistory,
  getNotificationPermission,
  requestNotificationPermission,
  dispatchPriceNotification,
  isNotificationSupported,
} from '../services/notificationService';
import { EGXScheduleStatus } from '../services/marketPriceSync';

export function usePriceAlerts(
  positions: Position[],
  tickers: EGXTicker[],
  scheduleStatus: EGXScheduleStatus
) {
  const [settings, setSettings] = useState<PriceAlertSettings>(() => getAlertSettings());
  const [alertHistory, setAlertHistory] = useState<TriggeredPriceAlert[]>(() => getAlertHistory());
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [isSupported] = useState<boolean>(() => isNotificationSupported());

  // Ref to prevent multiple triggers in immediate succession during price stream
  const positionsRef = useRef(positions);
  const settingsRef = useRef(settings);
  const scheduleStatusRef = useRef(scheduleStatus);
  positionsRef.current = positions;
  settingsRef.current = settings;
  scheduleStatusRef.current = scheduleStatus;

  // Sync state changes to storage
  const updateSettings = useCallback((newSettings: Partial<PriceAlertSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveAlertSettings(updated);
      return updated;
    });
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  const clearHistory = useCallback(() => {
    clearStorageHistory();
    setAlertHistory([]);
  }, []);

  const markAllRead = useCallback(() => {
    setAlertHistory(prev => {
      const updated = prev.map(a => ({ ...a, read: true }));
      saveAlertHistory(updated);
      return updated;
    });
  }, []);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (permission !== 'granted') {
      const p = await handleRequestPermission();
      if (p !== 'granted') return false;
    }

    const testAlert = {
      ticker: 'COMI',
      companyName: 'Commercial International Bank',
      type: 'TARGET_HIT' as PriceAlertTriggerType,
      currentPrice: 94.50,
      thresholdPrice: 94.00,
      distancePercent: 0.53,
    };

    const success = await dispatchPriceNotification(testAlert, true);
    if (success) {
      const now = new Date();
      const newAlert: TriggeredPriceAlert = {
        id: `alert-test-${Date.now()}`,
        ...testAlert,
        timestamp: now.toISOString(),
        timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setAlertHistory(prev => {
        const next = [newAlert, ...prev];
        saveAlertHistory(next);
        return next;
      });
    }
    return success;
  }, [permission, handleRequestPermission]);

  // Core Price Alert Evaluation Engine
  const evaluateAlerts = useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.enabled) return;

    // Check Cairo Market Hours restriction if enabled
    const isCairoActive = scheduleStatusRef.current?.isSessionActive;
    if (currentSettings.cairoHoursOnly && !isCairoActive) {
      // Market closed, skip background price alerts
      return;
    }

    const currentPositions = positionsRef.current;
    const newAlerts: TriggeredPriceAlert[] = [];

    for (const pos of currentPositions) {
      if (!pos.currentPrice || pos.currentPrice <= 0) continue;

      const currentPrice = pos.currentPrice;
      const targetPrice = pos.targetPrice;
      const stopLoss = pos.stopLoss;

      // 1. Target Price Evaluation
      if (targetPrice && targetPrice > 0 && currentSettings.notifyOnTarget) {
        if (currentPrice >= targetPrice) {
          const distancePercent = ((currentPrice - targetPrice) / targetPrice) * 100;
          const dispatched = await dispatchPriceNotification({
            ticker: pos.ticker,
            companyName: pos.companyName,
            type: 'TARGET_HIT',
            currentPrice,
            thresholdPrice: targetPrice,
            distancePercent,
            shares: pos.shares,
            notes: pos.notes,
          });

          if (dispatched) {
            const now = new Date();
            newAlerts.push({
              id: `alert-tgt-${pos.ticker}-${Date.now()}`,
              ticker: pos.ticker,
              companyName: pos.companyName,
              type: 'TARGET_HIT',
              currentPrice,
              thresholdPrice: targetPrice,
              distancePercent,
              timestamp: now.toISOString(),
              timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              read: false,
              shares: pos.shares,
              notes: pos.notes,
            });
          }
        } else if (currentSettings.notifyOnProximity) {
          // Approaching Target Price (e.g. within 1.5%)
          const distanceToTargetPercent = ((targetPrice - currentPrice) / targetPrice) * 100;
          if (distanceToTargetPercent > 0 && distanceToTargetPercent <= currentSettings.proximityPercent) {
            const dispatched = await dispatchPriceNotification({
              ticker: pos.ticker,
              companyName: pos.companyName,
              type: 'TARGET_APPROACHING',
              currentPrice,
              thresholdPrice: targetPrice,
              distancePercent: distanceToTargetPercent,
              shares: pos.shares,
              notes: pos.notes,
            });

            if (dispatched) {
              const now = new Date();
              newAlerts.push({
                id: `alert-tgt-prox-${pos.ticker}-${Date.now()}`,
                ticker: pos.ticker,
                companyName: pos.companyName,
                type: 'TARGET_APPROACHING',
                currentPrice,
                thresholdPrice: targetPrice,
                distancePercent: distanceToTargetPercent,
                timestamp: now.toISOString(),
                timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                read: false,
                shares: pos.shares,
                notes: pos.notes,
              });
            }
          }
        }
      }

      // 2. Stop-Loss Evaluation
      if (stopLoss && stopLoss > 0 && currentSettings.notifyOnStopLoss) {
        if (currentPrice <= stopLoss) {
          const distancePercent = ((currentPrice - stopLoss) / stopLoss) * 100;
          const dispatched = await dispatchPriceNotification({
            ticker: pos.ticker,
            companyName: pos.companyName,
            type: 'STOP_LOSS_HIT',
            currentPrice,
            thresholdPrice: stopLoss,
            distancePercent,
            shares: pos.shares,
            notes: pos.notes,
          });

          if (dispatched) {
            const now = new Date();
            newAlerts.push({
              id: `alert-sl-${pos.ticker}-${Date.now()}`,
              ticker: pos.ticker,
              companyName: pos.companyName,
              type: 'STOP_LOSS_HIT',
              currentPrice,
              thresholdPrice: stopLoss,
              distancePercent,
              timestamp: now.toISOString(),
              timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              read: false,
              shares: pos.shares,
              notes: pos.notes,
            });
          }
        } else if (currentSettings.notifyOnProximity) {
          // Approaching Stop Loss (e.g. within 1.5%)
          const distanceToSlPercent = ((currentPrice - stopLoss) / stopLoss) * 100;
          if (distanceToSlPercent > 0 && distanceToSlPercent <= currentSettings.proximityPercent) {
            const dispatched = await dispatchPriceNotification({
              ticker: pos.ticker,
              companyName: pos.companyName,
              type: 'STOP_LOSS_APPROACHING',
              currentPrice,
              thresholdPrice: stopLoss,
              distancePercent: distanceToSlPercent,
              shares: pos.shares,
              notes: pos.notes,
            });

            if (dispatched) {
              const now = new Date();
              newAlerts.push({
                id: `alert-sl-prox-${pos.ticker}-${Date.now()}`,
                ticker: pos.ticker,
                companyName: pos.companyName,
                type: 'STOP_LOSS_APPROACHING',
                currentPrice,
                thresholdPrice: stopLoss,
                distancePercent: distanceToSlPercent,
                timestamp: now.toISOString(),
                timeFormatted: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                read: false,
                shares: pos.shares,
                notes: pos.notes,
              });
            }
          }
        }
      }
    }

    if (newAlerts.length > 0) {
      setAlertHistory(prev => {
        const merged = [...newAlerts, ...prev];
        saveAlertHistory(merged);
        return merged;
      });
    }
  }, []);

  // Run alert check whenever positions change (e.g. price sync updates)
  useEffect(() => {
    evaluateAlerts();
  }, [positions, evaluateAlerts]);

  const unreadCount = alertHistory.filter(a => !a.read).length;

  return {
    settings,
    updateSettings,
    alertHistory,
    clearHistory,
    markAllRead,
    unreadCount,
    permission,
    isSupported,
    requestPermission: handleRequestPermission,
    sendTestNotification,
  };
}
