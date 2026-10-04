import { useEffect, useState } from 'react';
import type { ClosedTrade, EGXTicker, Position, TradeTransaction } from '../../../types';
import { VISUAL_REGRESSION_MODE } from '../../../utils/visualRegressionMode';
import {
  initialCapitalDeposits,
  initialCashBalance,
  initialClosedTrades,
  initialPositions,
  initialTickers,
  initialTransactions,
  persistPortfolioCompatibilityCache,
  rehydrateClosedTradeMetadata,
  rehydratePositionsWithTickers,
  rehydrateTransactionMetadata,
} from './portfolioCompatibility';

export function usePortfolioLocalState() {
  const [tickers, setTickers] = useState<EGXTicker[]>(initialTickers);
  const [capitalDeposits, setCapitalDeposits] = useState<number>(initialCapitalDeposits);
  const [transactions, setTransactions] = useState<TradeTransaction[]>(
    () => initialTransactions(tickers),
  );
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(initialClosedTrades);
  const [cashBalance, setCashBalance] = useState<number>(initialCashBalance);
  const [isInitialized, setIsInitialized] = useState(VISUAL_REGRESSION_MODE);

  useEffect(() => {
    persistPortfolioCompatibilityCache({
      positions,
      closedTrades,
      transactions,
      cashBalance,
      tickers,
      capitalDeposits,
    });
  }, [positions, closedTrades, transactions, cashBalance, tickers, capitalDeposits]);

  useEffect(() => {
    setPositions((previous) => rehydratePositionsWithTickers(previous, tickers));
    setTransactions((previous) => rehydrateTransactionMetadata(previous, tickers));
    setClosedTrades((previous) => rehydrateClosedTradeMetadata(previous, tickers));
  }, [tickers]);

  return {
    positions,
    setPositions,
    closedTrades,
    setClosedTrades,
    transactions,
    setTransactions,
    cashBalance,
    setCashBalance,
    tickers,
    setTickers,
    capitalDeposits,
    setCapitalDeposits,
    isInitialized,
    setIsInitialized,
  };
}

export type PortfolioLocalState = ReturnType<typeof usePortfolioLocalState>;
