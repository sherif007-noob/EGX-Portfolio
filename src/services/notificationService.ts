import { PriceAlertSettings, TriggeredPriceAlert, PriceAlertTriggerType } from '../types';

const SETTINGS_STORAGE_KEY = 'egx_price_alert_settings_v1';
const HISTORY_STORAGE_KEY = 'egx_price_alert_history_v1';
const DEDUPLICATION_STORAGE_KEY = 'egx_price_alert_dedup_v1';

export const DEFAULT_ALERT_SETTINGS: PriceAlertSettings = {
  enabled: true,
  notifyOnTarget: true,
  notifyOnStopLoss: true,
  notifyOnProximity: false,
  proximityPercent: 1.5,
  cairoHoursOnly: true,
  soundEnabled: true,
  vibrateEnabled: true,
};

/**
 * Retrieves stored user price alert settings
 */
export function getAlertSettings(): PriceAlertSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

/**
 * Persists user price alert settings
 */
export function saveAlertSettings(settings: PriceAlertSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save alert settings:', err);
  }
}

/**
 * Retrieves triggered alerts history from local storage
 */
export function getAlertHistory(): TriggeredPriceAlert[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Persists alert history, maintaining the latest 50 alerts
 */
export function saveAlertHistory(history: TriggeredPriceAlert[]): void {
  try {
    const trimmed = history.slice(0, 50);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save alert history:', err);
  }
}

/**
 * Clear alert history
 */
export function clearAlertHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    localStorage.removeItem(DEDUPLICATION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear alert history:', err);
  }
}

/**
 * Checks if browser supports Web Notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current notification permission status ('default' | 'granted' | 'denied')
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Requests Notification permission from browser
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Synthesizes audible alert tone using Web Audio API
 */
export function playAlertTone(type: PriceAlertTriggerType): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'TARGET_HIT' || type === 'TARGET_APPROACHING') {
      // Pleasant uplifting double chime (Major 5th chord: 523Hz -> 659Hz -> 784Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Second harmonic chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } else {
      // Urgent warning pulse for stop-loss
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // AudioContext autoplay restrictions may silently ignore
    console.debug('Audio alert playback skipped:', e);
  }
}

/**
 * Checks deduplication cache to prevent re-alerting for the exact same event on the same day
 */
function shouldTriggerAlert(ticker: string, type: PriceAlertTriggerType): boolean {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}_${ticker.toUpperCase()}_${type}`;
    const raw = localStorage.getItem(DEDUPLICATION_STORAGE_KEY);
    const dedupMap: Record<string, number> = raw ? JSON.parse(raw) : {};

    const lastTriggered = dedupMap[key];
    const now = Date.now();

    // If already triggered within the last 4 hours on the same trading day, suppress
    if (lastTriggered && now - lastTriggered < 4 * 60 * 60 * 1000) {
      return false;
    }

    dedupMap[key] = now;
    localStorage.setItem(DEDUPLICATION_STORAGE_KEY, JSON.stringify(dedupMap));
    return true;
  } catch {
    return true;
  }
}

/**
 * Dispatches a native PWA Push / Web Notification via Service Worker
 */
export async function dispatchPriceNotification(
  alert: Omit<TriggeredPriceAlert, 'id' | 'timestamp' | 'timeFormatted' | 'read'>,
  force = false
): Promise<boolean> {
  const settings = getAlertSettings();
  if (!settings.enabled && !force) return false;

  // Verify deduplication
  if (!force && !shouldTriggerAlert(alert.ticker, alert.type)) {
    return false;
  }

  // Play sound if enabled
  if (settings.soundEnabled) {
    playAlertTone(alert.type);
  }

  // Vibrate mobile devices if supported
  if (settings.vibrateEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (alert.type === 'TARGET_HIT' || alert.type === 'TARGET_APPROACHING') {
        navigator.vibrate([100, 50, 150]);
      } else {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } catch {}
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  let title = '';
  let body = '';

  const formatNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  switch (alert.type) {
    case 'TARGET_HIT':
      title = `🎯 Target Price Hit: ${alert.ticker} (${formatNum(alert.currentPrice)} EGP)`;
      body = `${alert.companyName} reached your profit target of ${formatNum(alert.thresholdPrice)} EGP! Current market: ${formatNum(alert.currentPrice)} EGP.`;
      break;
    case 'STOP_LOSS_HIT':
      title = `🛑 Stop-Loss Breached: ${alert.ticker} (${formatNum(alert.currentPrice)} EGP)`;
      body = `Warning: ${alert.companyName} dropped below your stop-loss of ${formatNum(alert.thresholdPrice)} EGP. Current market: ${formatNum(alert.currentPrice)} EGP.`;
      break;
    case 'TARGET_APPROACHING':
      title = `⚡ Approaching Target: ${alert.ticker} (${formatNum(alert.currentPrice)} EGP)`;
      body = `${alert.companyName} is within ${Math.abs(alert.distancePercent).toFixed(1)}% of your target price (${formatNum(alert.thresholdPrice)} EGP).`;
      break;
    case 'STOP_LOSS_APPROACHING':
      title = `⚠️ Approaching Stop-Loss: ${alert.ticker} (${formatNum(alert.currentPrice)} EGP)`;
      body = `${alert.companyName} is within ${Math.abs(alert.distancePercent).toFixed(1)}% of your stop-loss boundary (${formatNum(alert.thresholdPrice)} EGP).`;
      break;
  }

  const notificationOptions: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/apple-touch-icon.png',
    tag: `egx-price-${alert.ticker}-${alert.type}`,
    requireInteraction: alert.type === 'TARGET_HIT' || alert.type === 'STOP_LOSS_HIT',
    silent: !settings.soundEnabled,
    data: {
      url: '/',
      ticker: alert.ticker,
      type: alert.type,
      time: Date.now(),
    },
  };

  try {
    // 1. Primary: Use Service Worker Registration for background push fidelity
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
      } catch (swErr) {
        console.warn('Service worker notification fallback triggered:', swErr);
      }
    }

    // 2. Fallback: Direct Notification API
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.error('Failed to trigger push notification:', err);
    return false;
  }
}
