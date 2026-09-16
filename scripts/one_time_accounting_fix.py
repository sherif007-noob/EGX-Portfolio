from pathlib import Path
import re

hook = Path('src/hooks/usePortfolioState.ts')
s = hook.read_text()

old = '''          const txMap = new Map<string, TradeTransaction>();
          if (Array.isArray(remoteData.transactions)) {
            remoteData.transactions.forEach((tx) => {
              if (tx?.id) txMap.set(tx.id, normalizeTransaction(tx));
            });
          }
          transactions.forEach((tx) => {
            if (tx?.id && !txMap.has(tx.id)) txMap.set(tx.id, normalizeTransaction(tx));
          });

          let loadedTransactions = Array.from(txMap.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          if (loadedTransactions.length === 0) loadedTransactions = transactions;
'''
new = '''          let loadedTransactions = Array.isArray(remoteData.transactions)
            ? remoteData.transactions.map(normalizeTransaction).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              )
            : [];
'''
assert old in s, 'initial merge block not found'
s = s.replace(old, new, 1)

old = '''            if (loadedPositions.length > 0) setPositions(loadedPositions);
            if (loadedClosed.length > 0) setClosedTrades(loadedClosed);
            if (loadedTransactions.length > 0) setTransactions(loadedTransactions);
            if (typeof remoteData.cashBalance === 'number' && remoteData.cashBalance >= 0) setCashBalance(remoteData.cashBalance);
'''
new = '''            setPositions(loadedPositions);
            setClosedTrades(loadedClosed);
            setTransactions(loadedTransactions);
            if (typeof remoteData.cashBalance === 'number' && remoteData.cashBalance >= 0) setCashBalance(remoteData.cashBalance);
'''
assert old in s, 'subscription block not found'
s = s.replace(old, new, 1)

old = '''      if (remote) {
        const txMap = new Map<string, TradeTransaction>();
        (remote.transactions || []).forEach((t) => { if (t?.id) txMap.set(t.id, normalizeTransaction(t)); });
        transactions.forEach((t) => { if (t?.id && !txMap.has(t.id)) txMap.set(t.id, normalizeTransaction(t)); });
        mergedTxs = Array.from(txMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (Array.isArray(remote.positions) && remote.positions.length > 0) mergedPositions = remote.positions;
        if (Array.isArray(remote.closedTrades) && remote.closedTrades.length > 0) mergedClosed = remote.closedTrades;
        if (typeof remote.cashBalance === 'number' && remote.cashBalance >= 0) mergedCash = remote.cashBalance;
        if (typeof remote.capitalDeposits === 'number' && remote.capitalDeposits >= 0) mergedCapital = remote.capitalDeposits;
'''
new = '''      if (remote) {
        mergedTxs = Array.isArray(remote.transactions)
          ? remote.transactions.map(normalizeTransaction).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          : [];
        mergedPositions = Array.isArray(remote.positions) ? remote.positions : [];
        mergedClosed = Array.isArray(remote.closedTrades) ? remote.closedTrades : [];
        if (typeof remote.cashBalance === 'number' && remote.cashBalance >= 0) mergedCash = remote.cashBalance;
        if (typeof remote.capitalDeposits === 'number' && remote.capitalDeposits >= 0) mergedCapital = remote.capitalDeposits;
'''
assert old in s, 'force sync block not found'
s = s.replace(old, new, 1)
hook.write_text(s)

fs = Path('src/services/firestoreStorage.ts')
s = fs.read_text()
old = "  const patch = { positions: sanitizeForFirestore(positions), tickers: sanitizeForFirestore(tickers), lastPriceWriteAt: new Date().toISOString(), updatedAt: new Date().toISOString() };"
new = "  const patch = { positions: sanitizeForFirestore(positions), tickers: sanitizeForFirestore(tickers), lastPriceWriteAt: new Date().toISOString() };"
assert old in s, 'price tick patch not found'
fs.write_text(s.replace(old, new, 1))

app = Path('src/App.tsx')
s = app.read_text()
s = s.replace("import { getIsQuotaExceeded } from './services/firestoreStorage';", "import { getIsQuotaExceeded, forceFullSyncToFirestore } from './services/firestoreStorage';")
s = s.replace("import { RotateCcw } from 'lucide-react';", "import { RotateCcw } from 'lucide-react';\nimport { reconcilePortfolioFromLedger } from './services/portfolioReconciliation';\nimport { calculateBuyImpact, calculateSellAccounting, calculateHoldingDays } from './services/portfolioAccounting';")

pattern = re.compile(r"  // AI Screenshot Batch Transactions\n  const handleAIScreenshotAddBatchTransactions = \([\s\S]*?\n  };\n\n  // Manual trigger for Live Price Sync", re.M)
replacement = '''  // AI Screenshot Batch Transactions
  const handleAIScreenshotAddBatchTransactions = (
    parsedTxs: Array<{
      ticker: string;
      companyName: string;
      sector: Sector;
      type: 'BUY' | 'SELL';
      shares: number;
      price: number;
      date: string;
      fees: number;
      notes?: string;
    }>
  ) => {
    if (parsedTxs.length === 0) return;
    let workingTransactions = [...transactions];
    let workingReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);

    for (const parsedTx of parsedTxs) {
      const ticker = parsedTx.ticker.toUpperCase().trim();
      const shares = Number(parsedTx.shares);
      const price = Number(parsedTx.price);
      const fees = Number(parsedTx.fees) || 0;
      if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) continue;
      const maxTradeId = workingTransactions.reduce((max, t) => {
        const id = Number(t.tradeId);
        return Number.isFinite(id) && id > max ? id : max;
      }, 0);
      const tradeId = maxTradeId > 0 ? maxTradeId + 1 : workingTransactions.length + 1;

      if (parsedTx.type === 'BUY') {
        const impact = calculateBuyImpact(shares, price, fees);
        const tx: TradeTransaction = {
          id: `tx-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, tradeId, type: 'BUY', ticker,
          companyName: parsedTx.companyName || ticker, sector: parsedTx.sector, shares, price, date: parsedTx.date, fees,
          totalAmount: impact.cashOutflow, grossTradeValue: impact.grossCost, netCashImpact: -impact.cashOutflow,
          notes: parsedTx.notes || 'Logged via Screenshot Scanner',
        };
        workingTransactions = [tx, ...workingTransactions];
      } else {
        const position = workingReport.reconciledPositions.find((p) => p.ticker.toUpperCase() === ticker);
        if (!position || shares > position.shares) continue;
        const accounting = calculateSellAccounting(shares, price, fees, position.shares, position.shares * position.avgBuyPrice, position.totalFees || 0);
        const tx: TradeTransaction = {
          id: `tx-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, tradeId, type: 'SELL', ticker,
          companyName: position.companyName || parsedTx.companyName || ticker, sector: position.sector || parsedTx.sector,
          shares, price, date: parsedTx.date, fees, totalAmount: accounting.netProceeds, grossTradeValue: accounting.grossProceeds,
          netCashImpact: accounting.netProceeds, realizedPnlEgp: accounting.realizedPnlEgp,
          realizedPnlPercent: accounting.realizedPnlPercent, outcome: accounting.outcome,
          holdingDays: calculateHoldingDays(position.buyDate, parsedTx.date), notes: parsedTx.notes || 'Logged via Screenshot Scanner',
        };
        workingTransactions = [tx, ...workingTransactions];
      }
      workingReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);
    }

    const finalReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);
    setTransactions(workingTransactions);
    setPositions(finalReport.reconciledPositions);
    setClosedTrades(finalReport.reconciledClosedTrades);
    setCashBalance(finalReport.reconciledCashBalance);
    void forceFullSyncToFirestore({ positions: finalReport.reconciledPositions, closedTrades: finalReport.reconciledClosedTrades, transactions: workingTransactions, cashBalance: finalReport.reconciledCashBalance, capitalDeposits, tickers });
    showToast(`Successfully processed ${workingTransactions.length - transactions.length} transactions from screenshots!`, 'success');
  };

  // Manual trigger for Live Price Sync'''
assert pattern.search(s), 'OCR batch handler not found'
app.write_text(pattern.sub(replacement, s, count=1))

test = Path('src/services/portfolioReconciliation.test.ts')
ts = test.read_text()
if 'price update must not resurrect a deleted ledger transaction' not in ts:
    ts += '''\n\nit('price update must not resurrect a deleted ledger transaction', () => {\n  const buy = { id: 'buy-1', type: 'BUY', ticker: 'COMI', companyName: 'COMI', sector: 'Banking', shares: 100, price: 50, fees: 0, date: '2026-09-01', totalAmount: 5000 };\n  const sell = { id: 'sell-1', type: 'SELL', ticker: 'COMI', companyName: 'COMI', sector: 'Banking', shares: 40, price: 60, fees: 0, date: '2026-09-02', totalAmount: 2400 };\n  const withSell = reconcilePortfolioFromLedger([buy, sell], [], 5000);\n  expect(withSell.reconciledPositions[0].shares).toBe(60);\n  const afterDelete = reconcilePortfolioFromLedger([buy], [], 5000);\n  expect(afterDelete.reconciledPositions[0].shares).toBe(100);\n  expect(afterDelete.reconciledClosedTrades).toHaveLength(0);\n});\n'''
    test.write_text(ts)

Path('.github/workflows/one-time-accounting-fix.yml').unlink()
