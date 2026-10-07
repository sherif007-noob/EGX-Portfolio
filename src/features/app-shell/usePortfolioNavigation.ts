import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ClosedTrade, Position, TradeTransaction } from '../../types';
import type { NavigationTab } from '../../components/Header';
import type { JournalLedgerFocus } from '../../components/TradingJournal';
import {
  getActivePositionLedgerTransactionIds,
  getClosedCycleLedgerTransactionIds,
} from '../../domain/accounting';
import { runVisualTransition } from '../../utils/visualTransition';

export function usePortfolioNavigation(transactions: TradeTransaction[]) {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [settledTab, setSettledTab] = useState<NavigationTab>('overview');
  const [ledgerCorrectionFocus, setLedgerCorrectionFocus] = useState<JournalLedgerFocus | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (typeof window === 'undefined') return;

    // Tab switches are page-level navigation. Reset the document scroll after
    // React commits the new tab so removing the tall Overview hero cannot leave
    // the viewport anchored hundreds of pixels down the destination page.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  const handleTabChange = useCallback((nextTab: NavigationTab) => {
    if (nextTab !== 'journal') setLedgerCorrectionFocus(null);
    if (nextTab === activeTab) return;

    const desktopMotionTarget =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

    const update = () => runVisualTransition('tab', () => setActiveTab(nextTab));

    if (desktopMotionTarget) {
      React.startTransition(update);
      return;
    }

    setSettledTab(nextTab);
    update();
  }, [activeTab]);

  const openPositionLedgerCorrection = useCallback((position: Position) => {
    const transactionIds = getActivePositionLedgerTransactionIds(transactions, position.ticker);
    setLedgerCorrectionFocus({
      key: `position:${position.id}:${Date.now()}`,
      source: 'POSITION',
      ticker: position.ticker,
      transactionIds,
      title: `${position.ticker} open-position source executions`,
      detail: transactionIds.length > 0
        ? `Showing the ${transactionIds.length} execution(s) in the active weighted-average trade cycle.`
        : 'No explicit active-cycle IDs were resolved, so the journal is scoped to this ticker.',
    });
    handleTabChange('journal');
  }, [handleTabChange, transactions]);

  const openBrokerReconciliationLedger = useCallback((
    ticker: string,
    transactionIds: string[],
    detail: string,
  ) => {
    setLedgerCorrectionFocus({
      key: `broker:${ticker}:${Date.now()}`,
      source: 'BROKER_RECONCILIATION',
      ticker,
      transactionIds,
      title: `${ticker} broker reconciliation source ledger`,
      detail,
    });
    handleTabChange('journal');
  }, [handleTabChange]);

  const openClosedCycleLedgerCorrection = useCallback((
    cycle: ClosedTrade,
    renderedTransactionIds: string[],
  ) => {
    const canonicalIds = getClosedCycleLedgerTransactionIds(cycle);
    const transactionIds = canonicalIds.length > 0 ? canonicalIds : renderedTransactionIds;
    setLedgerCorrectionFocus({
      key: `closed-cycle:${cycle.id}:${Date.now()}`,
      source: 'CLOSED_CYCLE',
      ticker: cycle.ticker,
      transactionIds,
      title: `${cycle.ticker} closed-cycle source executions`,
      detail: transactionIds.length > 0
        ? `Showing ${transactionIds.length} BUY/SELL source execution(s) linked to this derived cycle.`
        : 'No explicit source IDs were stored for this legacy cycle, so the journal is scoped to this ticker.',
    });
    handleTabChange('journal');
  }, [handleTabChange]);

  return {
    activeTab,
    settledTab,
    setSettledTab,
    ledgerCorrectionFocus,
    setLedgerCorrectionFocus,
    handleTabChange,
    openPositionLedgerCorrection,
    openClosedCycleLedgerCorrection,
    openBrokerReconciliationLedger,
  };
}
