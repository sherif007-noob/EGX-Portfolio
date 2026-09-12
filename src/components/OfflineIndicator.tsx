import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md border border-amber-400/30 animate-pulse"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-200" />
      <span>Offline Mode — Cached EGX Portfolio & Directory active</span>
    </div>
  );
};
