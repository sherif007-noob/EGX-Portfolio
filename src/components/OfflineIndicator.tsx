import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Database, RefreshCw } from 'lucide-react';
import { subscribeToQuotaStatus, forceRetrySync } from '../services/firestoreStorage';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  useEffect(() => {
    return subscribeToQuotaStatus((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
  }, []);

  const handleManualFlush = async () => {
    setIsFlushing(true);
    try {
      await forceRetrySync();
    } finally {
      setIsFlushing(false);
    }
  };

  if (isOnline && !isQuotaExceeded) return null;

  if (!isOnline) {
    return (
      <div
        id="offline-banner"
        className="premium-status-surface premium-status-warning premium-fixed-overlay premium-fixed-mobile-span premium-fixed-bottom-safe fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-100"
      >
        <WifiOff className="w-4 h-4 shrink-0 text-amber-200 animate-pulse" />
        <span className="min-w-0 flex-1">Offline Mode — Cached EGX Portfolio & Directory active</span>
      </div>
    );
  }

  return (
    <div
      id="quota-banner"
      className="premium-status-surface premium-status-warning premium-fixed-overlay premium-fixed-mobile-span premium-fixed-bottom-safe fixed bottom-4 left-4 z-50 flex flex-wrap items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-300 sm:flex-nowrap"
    >
      <Database className="w-4 h-4 shrink-0 text-amber-400" />
      <span className="min-w-0 flex-1">Firestore Quota Buffering: Writes queued in LocalStorage</span>
      <button
        id="retry-quota-flush-btn"
        onClick={handleManualFlush}
        disabled={isFlushing}
        className="premium-action premium-action-warning ml-0 shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-50 sm:ml-2"
        title="Attempt to flush queued writes"
      >
        <RefreshCw className={`w-3 h-3 ${isFlushing ? 'animate-spin' : ''}`} />
        <span>Sync</span>
      </button>
    </div>
  );
};

