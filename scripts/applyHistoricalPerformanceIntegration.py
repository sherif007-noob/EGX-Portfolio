from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

react_old = "import React, { useState, useMemo, useCallback, useRef } from 'react';"
react_new = "import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';"
if react_old not in text:
    raise SystemExit('React import anchor not found')
text = text.replace(react_old, react_new, 1)

service_old = "import { calculateBuyImpact, calculateSellAccounting, calculateHoldingDays } from './services/portfolioAccounting';"
service_new = """import { calculateBuyImpact, calculateSellAccounting, calculateHoldingDays } from './services/portfolioAccounting';
import { getHistoricalPricesForTransactions } from './services/historicalPriceStore';
import { buildPerformanceEngineResult } from './services/performanceEngine';"""
if service_old not in text:
    raise SystemExit('Service import anchor not found')
text = text.replace(service_old, service_new, 1)

stats_old = """  const stats: PerformanceStats = useMemo(() => {
    return calculatePerformanceStats(closedTrades, positions);
  }, [closedTrades, positions]);"""
stats_new = """  const [historicalDrawdown, setHistoricalDrawdown] = useState<{
    maxDrawdownEgp: number;
    maxDrawdownPercent: number;
  } | null>(null);

  useEffect(() => {
    if (activeTab !== 'reports') return;

    let cancelled = false;
    setHistoricalDrawdown(null);

    const loadHistoricalPerformance = async () => {
      const hasMarketTransactions = transactions.some((tx) => tx.ticker.trim().toUpperCase() !== 'CASH');
      if (!hasMarketTransactions) return;

      try {
        const historicalPrices = await getHistoricalPricesForTransactions(transactions);
        const result = buildPerformanceEngineResult(transactions, historicalPrices);
        const hasCompleteCurve =
          result.dataQuality.valuationDays >= 2 &&
          result.dataQuality.incompleteDays === 0 &&
          result.dataQuality.missingTickers.length === 0;

        if (!cancelled && hasCompleteCurve) {
          setHistoricalDrawdown({
            maxDrawdownEgp: result.maxDrawdownEgp,
            maxDrawdownPercent: result.maxDrawdownPercent,
          });
        }
      } catch (error) {
        if (!cancelled) setHistoricalDrawdown(null);
        console.warn('Historical performance data is unavailable; drawdown will remain N/A.', error);
      }
    };

    void loadHistoricalPerformance();
    return () => {
      cancelled = true;
    };
  }, [activeTab, transactions]);

  const stats: PerformanceStats = useMemo(() => {
    const baseStats = calculatePerformanceStats(closedTrades, positions);
    return historicalDrawdown ? { ...baseStats, ...historicalDrawdown } : baseStats;
  }, [closedTrades, positions, historicalDrawdown]);"""
if stats_old not in text:
    raise SystemExit('Performance stats anchor not found')
text = text.replace(stats_old, stats_new, 1)

path.write_text(text, encoding='utf-8')
