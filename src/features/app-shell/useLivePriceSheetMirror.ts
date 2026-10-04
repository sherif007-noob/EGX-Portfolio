import { useCallback, useRef } from 'react';
import type { EGXTicker, GoogleSheetsConfig, Position } from '../../types';
import type { ToastKind } from './useAppNotifications';

interface UseLivePriceSheetMirrorOptions {
  sheetsConfig: GoogleSheetsConfig | null;
  syncPricesOnlyToSheets: (
    overrideTickers?: EGXTicker[],
    overridePositions?: Position[],
  ) => Promise<{ success: boolean; updatedTabs?: string[]; message?: string }>;
  showToast: (message: string, type?: ToastKind, duration?: number) => void;
}

export function useLivePriceSheetMirror({
  sheetsConfig,
  syncPricesOnlyToSheets,
  showToast,
}: UseLivePriceSheetMirrorOptions) {
  const sheetsConfigRef = useRef(sheetsConfig);
  sheetsConfigRef.current = sheetsConfig;
  const lastSheetAutoPushRef = useRef(0);

  return useCallback(async (
    updatedPositions: Position[],
    updatedTickers: EGXTicker[],
    manual: boolean,
  ) => {
    const config = sheetsConfigRef.current;
    if (!config?.spreadsheetId) return;

    const now = Date.now();
    const shouldPush =
      manual ||
      (config.autoSync !== false && now - lastSheetAutoPushRef.current > 45_000);

    if (!shouldPush) return;

    lastSheetAutoPushRef.current = now;
    try {
      const res = await syncPricesOnlyToSheets(updatedTickers, updatedPositions);
      if (res.success && manual && res.updatedTabs && res.updatedTabs.length > 0) {
        showToast(
          `Live prices updated & synced to Excel / Google Sheet (${res.updatedTabs.join(' & ')})!`,
          'success',
          4500,
        );
      }
    } catch (error) {
      console.warn('Auto-sync prices to Google Sheet failed:', error);
    }
  }, [showToast, syncPricesOnlyToSheets]);
}
