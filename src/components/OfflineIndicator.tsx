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
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md border border-amber-400/30 animate-pulse"
      >
        <WifiOff className="w-4 h-4 shrink-0 text-amber-200" />
        <span>Offline Mode — Cached EGX Portfolio & Directory active</span>
      </div>
    );
  }

  return (
    <div
      id="quota-banner"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900/90 px-4 py-2.5 text-xs font-medium text-amber-300 shadow-2xl backdrop-blur-md border border-amber-500/30"
    >
      <Database className="w-4 h-4 shrink-0 text-amber-400" />
      <span>Firestore Quota Buffering: Writes queued in LocalStorage</span>
      <button
        id="retry-quota-flush-btn"
        onClick={handleManualFlush}
        disabled={isFlushing}
        className="ml-2 flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        title="Attempt to flush queued writes"
      >
        <RefreshCw className={`w-3 h-3 ${isFlushing ? 'animate-spin' : ''}`} />
        <span>Sync</span>
      </button>
    </div>
  );
};

