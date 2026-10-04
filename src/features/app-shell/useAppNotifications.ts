import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClosedTrade, Position, TradeTransaction } from '../../types';

export type ToastKind = 'success' | 'error' | 'info';

export interface UndoState {
  previousState: {
    positions: Position[];
    closedTrades: ClosedTrade[];
    transactions: TradeTransaction[];
    cashBalance: number;
    capitalDeposits: number;
  };
  message: string;
}

interface UseAppNotificationsOptions {
  restoreLedgerSnapshot: (restore: {
    transactions: TradeTransaction[];
    capitalDeposits: number;
    positions?: Position[];
  }) => Promise<any>;
}

export function useAppNotifications({ restoreLedgerSnapshot }: UseAppNotificationsOptions) {
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: ToastKind;
  } | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastKind = 'success',
    duration = 5000,
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastNotification({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastNotification(null);
      toastTimerRef.current = null;
    }, duration);
  }, []);

  const executeUndo = useCallback(async () => {
    if (!undoState) return;
    const { previousState, message } = undoState;
    const result = await restoreLedgerSnapshot({
      transactions: previousState.transactions,
      capitalDeposits: previousState.capitalDeposits,
      positions: previousState.positions,
    });
    if ('error' in result) {
      showToast(`Undo was not saved: ${result.error.message}`, 'error', 6000);
      return;
    }
    setUndoState(null);
    showToast(`Restored state: ${message}`, 'success', 4000);
  }, [restoreLedgerSnapshot, showToast, undoState]);

  return {
    toastNotification,
    setToastNotification,
    showToast,
    undoState,
    setUndoState,
    executeUndo,
  };
}
