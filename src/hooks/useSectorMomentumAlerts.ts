import { useEffect, useRef, useState } from 'react';
import type { EGXScheduleStatus } from '../services/marketPriceSync';
import {
  detectSectorMomentumClusters,
  fetchSectorMomentumSnapshot,
  findSectorMomentumBaseline,
  type SectorClusterAlert,
  type SectorMomentumSnapshot,
} from '../services/sectorMomentum';
import { dispatchSectorMomentumNotification } from '../services/notificationService';

const STORAGE_KEY = 'egx_sector_momentum_snapshots_v1';
const POLL_MS = 60_000;
const KEEP_HISTORY_MS = 15 * 60_000;

function loadHistory(now: number): SectorMomentumSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (snapshot): snapshot is SectorMomentumSnapshot =>
        typeof snapshot?.capturedAt === 'number' &&
        Array.isArray(snapshot?.rows) &&
        now - snapshot.capturedAt <= KEEP_HISTORY_MS,
    );
  } catch {
    return [];
  }
}

function saveHistory(history: SectorMomentumSnapshot[], now: number) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = history
      .filter((snapshot) => now - snapshot.capturedAt <= KEEP_HISTORY_MS)
      .slice(-20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.debug('Sector momentum snapshot persistence skipped:', error);
  }
}

export function useSectorMomentumAlerts(scheduleStatus: EGXScheduleStatus) {
  const [latestClusters, setLatestClusters] = useState<SectorClusterAlert[]>([]);
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!scheduleStatus?.isSessionActive) return;

    let cancelled = false;

    const scan = async () => {
      if (inFlightRef.current || cancelled) return;
      inFlightRef.current = true;

      try {
        const current = await fetchSectorMomentumSnapshot();
        const history = loadHistory(current.capturedAt);
        const baseline = findSectorMomentumBaseline(history, current.capturedAt);
        const nextHistory = [...history, current];
        saveHistory(nextHistory, current.capturedAt);

        if (cancelled) return;
        setLastScannedAt(current.capturedAt);

        if (!baseline) {
          setLatestClusters([]);
          return;
        }

        const clusters = detectSectorMomentumClusters(baseline, current);
        setLatestClusters(clusters);

        for (const cluster of clusters) {
          await dispatchSectorMomentumNotification(cluster);
        }
      } catch (error) {
        console.warn('Sector momentum scan failed:', error);
      } finally {
        inFlightRef.current = false;
      }
    };

    void scan();
    const timer = window.setInterval(() => void scan(), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [scheduleStatus?.isSessionActive]);

  return { latestClusters, lastScannedAt };
}
