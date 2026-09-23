import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="premium-status-surface premium-status-warning premium-fixed-overlay premium-fixed-mobile-span premium-fixed-bottom-safe fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-100"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-200 animate-pulse" />
      <span className="min-w-0 flex-1">Offline Mode — Cached EGX Portfolio & Directory active</span>
    </div>
  );
};
