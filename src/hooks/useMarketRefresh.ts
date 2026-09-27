import { useEffect, useState } from 'react';

/** Refresh market history independently of whether a quote changed price. */
export function useMarketRefresh() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine !== false) {
        setRevision(value => value + 1);
      }
    };
    const timer = setInterval(refresh, 5 * 60_000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return revision;
}
