import { useMemo } from 'react';
import type { PerformanceStats, PortfolioMetrics } from './types';
import { SimpleShell, ActivitySwitcher, ACTIVITY_TABS } from './ui/SimpleShell';
import { HomeScreen } from './ui/HomeScreen';
import { CompactPortfolioStrip } from './components/CompactPortfolioStrip';
import { PositionsTable } from './components/PositionsTable';
import { EditPositionModal } from './components/EditPositionModal';
import { ClosedCyclesView } from './components/ClosedCyclesView';
import { PerformanceReports } from './features/reports';
import { TradingJournal } from './components/TradingJournal';
import { TickerDirectoryView } from './components/TickerDirectoryView';
import { CashBalanceView } from './components/CashBalanceView';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PythonSchemaSyncModal } from './components/PythonSchemaSyncModal';
import { AddTradeModal } from './components/AddTradeModal';
import { BonusSharesModal } from './components/BonusSharesModal';
import { IpoSubscriptionModal } from './components/IpoSubscriptionModal';
import { SellPositionModal } from './components/SellPositionModal';
import { QuickCashModal } from './components/QuickCashModal';
import { PortfolioBackupModal } from './components/PortfolioBackupModal';
import { DataHealthCenterModal } from './components/DataHealthCenterModal';
import { TradeScreenshotModal } from './components/TradeScreenshotModal';
import { PriceAlertsModal } from './components/PriceAlertsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { usePortfolioState } from './features/portfolio';
import { useMarketData } from './hooks/useMarketData';
import { useGoogleSheetsSync } from './hooks/useGoogleSheetsSync';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { useSectorMomentumAlerts } from './hooks/useSectorMomentumAlerts';
import { useMarketRefresh } from './hooks/useMarketRefresh';
import { calculatePortfolioMetrics, calculatePerformanceStats } from './domain/performance';
import { deriveCanonicalCapitalDeposits } from './domain/accounting';
import { MotionSwap, SurfacePresence } from './components/PremiumMotion';
import { RotateCcw } from 'lucide-react';
import { useAppOverlayState } from './features/app-shell/useAppOverlayState';
import { useAppNotifications } from './features/app-shell/useAppNotifications';
import { usePortfolioNavigation } from './features/app-shell/usePortfolioNavigation';
import { useHistoricalPortfolioAnalytics } from './features/app-shell/useHistoricalPortfolioAnalytics';
import { useLivePriceSheetMirror } from './features/app-shell/useLivePriceSheetMirror';
import { usePortfolioWorkflows } from './features/app-shell/usePortfolioWorkflows';

// Phase 10.8 exact-head validation trigger: complete modal/workflow consistency runtime source.
// Phase 10.9 exact-head validation trigger: responsive cross-app containment runtime source.
export default function App() {
  // Portfolio feature facade: state projections + explicit mutation/persistence operations.
  const {
    isInitialized,
    positions,
    updateMarketPositions,
    closedTrades,
    transactions,
    cashBalance,
    updateCashBalance,
    tickers,
    capitalDeposits,
    addTrade: executeAddTrade,
    sellPosition: executeSellPosition,
    addBonusShares: executeAddBonusShares,
    addIpoSubscription: executeAddIpoSubscription,
    allocateIpoSubscription: executeAllocateIpoSubscription,
    cancelIpoSubscription: executeCancelIpoSubscription,
    editPosition: executeEditPosition,
    editTransaction: executeEditTransaction,
    deleteTransaction: executeDeleteTransaction,
    addCashTransaction,
    editCashTransaction,
    deleteCashTransaction,
    reconcileLedger,
    importBackup,
    importOcrBatch,
    restoreLedgerSnapshot,
    updateTickers,
  } = usePortfolioState();

  const {
    activeTab,
    settledTab,
    setSettledTab,
    ledgerCorrectionFocus,
    setLedgerCorrectionFocus,
    handleTabChange,
    openPositionLedgerCorrection,
    openClosedCycleLedgerCorrection,
    openBrokerReconciliationLedger,
  } = usePortfolioNavigation(transactions);

  const {
    isSheetsModalOpen,
    setIsSheetsModalOpen,
    isSchemaModalOpen,
    setIsSchemaModalOpen,
    isAddTradeModalOpen,
    isBonusSharesModalOpen,
    setIsBonusSharesModalOpen,
    isIpoSubscriptionModalOpen,
    setIsIpoSubscriptionModalOpen,
    isQuickCashModalOpen,
    setIsQuickCashModalOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    isDataHealthModalOpen,
    setIsDataHealthModalOpen,
    isScreenshotModalOpen,
    setIsScreenshotModalOpen,
    isPriceAlertsModalOpen,
    setIsPriceAlertsModalOpen,
    sellingPosition,
    setSellingPosition,
    editingPosition,
    setEditingPosition,
    selectedTickerForTrade,
    openAddTrade,
    closeAddTrade,
  } = useAppOverlayState();

  const {
    toastNotification,
    showToast,
    undoState,
    setUndoState,
    executeUndo,
  } = useAppNotifications({ restoreLedgerSnapshot });

  // Google Sheets Sync Hook (Encapsulates OAuth, full sync, price sync, and token expiration)
  const {
    sheetsConfig,
    authUser,
    isSyncingToSheets,
    isSheetsTokenExpired,
    syncToSheets,
    syncPricesOnlyToSheets,
    updateSheetsConfig,
    handleLogout,
  } = useGoogleSheetsSync(positions, closedTrades, transactions, cashBalance, tickers);

  const handleLivePricesSynced = useLivePriceSheetMirror({
    sheetsConfig,
    syncPricesOnlyToSheets,
    showToast,
  });

  // Market Price Sync Hook (Encapsulates TradingView scanner & Cairo session scheduling)
  const {
    isSyncingPrices,
    lastPriceSyncTime,
    scheduleStatus,
    syncLivePrices,
  } = useMarketData(positions, tickers, updateMarketPositions, updateTickers, handleLivePricesSynced, isInitialized);

  // Price Target & Web Push Alerts Hook (PWA service worker push notifications & thresholds)
  const {
    settings: alertSettings,
    updateSettings: updateAlertSettings,
    alertHistory,
    clearHistory: clearAlertHistory,
    markAllRead: markAllAlertsRead,
    unreadCount: unreadAlertCount,
    permission: alertPermission,
    requestPermission: requestAlertPermission,
    sendTestNotification,
  } = usePriceAlerts(positions, tickers, scheduleStatus);

  // Live 5-10 minute sector-cluster detector (e.g. cement rotation).
  useSectorMomentumAlerts(scheduleStatus);


  // Performance Metrics & Indicators (Centralized calculation engine)
  const metrics: PortfolioMetrics = useMemo(() => {
    return calculatePortfolioMetrics(positions, cashBalance, closedTrades, tickers, transactions);
  }, [positions, cashBalance, closedTrades, tickers, transactions]);

  const analyticsCapitalDeposits = useMemo(
    () => deriveCanonicalCapitalDeposits(transactions, cashBalance, capitalDeposits),
    [transactions, cashBalance, capitalDeposits],
  );

  const marketRefresh = useMarketRefresh();
  const {
    historicalDrawdown,
    historicalPriceSeries,
    historicalAnalyticsLoading,
  } = useHistoricalPortfolioAnalytics({
    transactions,
    openingCapital: analyticsCapitalDeposits,
    isInitialized,
    marketRefresh,
  });


  const stats: PerformanceStats = useMemo(() => {
    const baseStats = calculatePerformanceStats(closedTrades, positions);
    return historicalDrawdown ? { ...baseStats, ...historicalDrawdown } : baseStats;
  }, [closedTrades, positions, historicalDrawdown]);

  const portfolioWorkflowActions = useMemo(() => ({
    addTrade: executeAddTrade,
    sellPosition: executeSellPosition,
    addBonusShares: executeAddBonusShares,
    addIpoSubscription: executeAddIpoSubscription,
    allocateIpoSubscription: executeAllocateIpoSubscription,
    cancelIpoSubscription: executeCancelIpoSubscription,
    editPosition: executeEditPosition,
    editTransaction: executeEditTransaction,
    deleteTransaction: executeDeleteTransaction,
    reconcileLedger,
    importOcrBatch,
    updateCashBalance,
  }), [
    executeAddTrade,
    executeSellPosition,
    executeAddBonusShares,
    executeAddIpoSubscription,
    executeAllocateIpoSubscription,
    executeCancelIpoSubscription,
    executeEditPosition,
    executeEditTransaction,
    executeDeleteTransaction,
    reconcileLedger,
    importOcrBatch,
    updateCashBalance,
  ]);

  const {
    handleAddPosition,
    handleConfirmSell,
    handleAddBonusShares,
    handleAddIpoSubscription,
    handleAllocateIpoSubscription,
    handleCancelIpoSubscription,
    handleSavePositionEdit,
    handleDeleteTransaction,
    handleEditTransaction,
    handleAIScreenshotAddTransaction,
    handleAIScreenshotAddBatchTransactions,
    handleSyncPrices,
    handlePushPricesToSheetDirectly,
    handleOverviewReconcile,
    handleCashBalanceUpdate,
    handleQuickCashBalanceUpdate,
  } = usePortfolioWorkflows({
    positions,
    closedTrades,
    transactions,
    cashBalance,
    capitalDeposits,
    portfolio: portfolioWorkflowActions,
    sheetsConfig,
    syncPricesOnlyToSheets,
    syncLivePrices,
    openSheetsModal: () => setIsSheetsModalOpen(true),
    showToast,
    setUndoState,
  });

  const handleQuickAddCash = () => setIsQuickCashModalOpen(true);

  return (
    <div className="premium-page min-h-[100dvh] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* App Header & Navigation */}
      <SimpleShell
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
        onOpenAddTrade={() => openAddTrade()}
        onOpenBonusShares={() => setIsBonusSharesModalOpen(true)}
        onOpenIpoSubscription={() => setIsIpoSubscriptionModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
        onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
        onQuickAddCash={handleQuickAddCash}
        unreadAlertCount={unreadAlertCount}
        isAlertsActive={alertSettings.enabled}
        isSheetsConnected={!!sheetsConfig}
        isTokenExpired={isSheetsTokenExpired}
        onSyncLivePrices={handleSyncPrices}
        isSyncingPrices={isSyncingPrices}
        onOpenSettings={() => setIsDataHealthModalOpen(true)}
      />

      {/* Undo Toast Notification */}
      <SurfacePresence isOpen={!!undoState} className="premium-fixed-overlay premium-fixed-mobile-span premium-fixed-bottom-above-status fixed bottom-6 right-6 z-50">
        {undoState && (
        <div className="w-full">
          <div className="premium-floating w-full px-4 py-3 rounded-xl border text-xs font-semibold flex items-center gap-3 text-slate-200">
            <span className="min-w-0 flex-1">{undoState.message}</span>
            <button
              onClick={executeUndo}
              className="premium-action premium-action-success shrink-0 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
          </div>
        </div>
        )}
      </SurfacePresence>

      {/* Price / Action Notification Toast */}
      <SurfacePresence isOpen={!!toastNotification} className="premium-fixed-overlay premium-fixed-mobile-span premium-fixed-top-after-header fixed top-20 right-4 z-50">
        {toastNotification && (
        <div className="w-full">
          <div
            className={`w-full px-4 py-2.5 rounded-lg shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
              toastNotification.type === 'success'
                ? 'premium-floating border-emerald-500/60 text-emerald-300'
                : toastNotification.type === 'info'
                ? 'premium-floating border-blue-500/60 text-blue-300'
                : 'premium-floating border-rose-500/60 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 shrink-0 rounded-full ${
                toastNotification.type === 'success'
                  ? 'bg-emerald-400'
                  : toastNotification.type === 'info'
                  ? 'bg-blue-400'
                  : 'bg-rose-400'
              }`}
            />
            <span className="min-w-0 flex-1">{toastNotification.message}</span>
          </div>
        </div>
      )}
      </SurfacePresence>

      {/* Main Container */}
      <main className="premium-safe-inline-main premium-flow-major ui-main-pad relative z-10 flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Home renders its own hero. Every other tab gets a compact context
            strip, and the activity views share one segmented switch. */}
        {activeTab !== 'overview' && <CompactPortfolioStrip metrics={metrics} />}
        {ACTIVITY_TABS.includes(activeTab) && (
          <ActivitySwitcher activeTab={activeTab} setActiveTab={handleTabChange} />
        )}

        {/* Ledger Reconciliation Alert if transactions exist but positions/closed cycles are empty */}
        {transactions.length > 0 && positions.length === 0 && (
          <div
            className="premium-panel premium-hierarchy-h4 premium-pad-h4 rounded-xl border-blue-500/35 text-blue-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            data-hierarchy="h4"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
              <span>
                <strong>{transactions.length} Trade Transactions in Ledger:</strong> Auto-reconcile to calculate open holdings, closed trade performance metrics, and cash balance.
              </span>
            </div>
            <button
              onClick={() => { void handleOverviewReconcile(); }}
              className="premium-action premium-action-primary px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap"
            >
              ⚡ Reconcile Portfolio Now
            </button>
          </div>
        )}

        {/* Tab Content Panels — Phase 10 page-closure composition; Closed Cycles source validation */}
        <MotionSwap
          motionKey={activeTab}
          variant="tab"
          className="premium-tab-stage"
          onEnterComplete={(completedTab) => {
            if (completedTab === activeTab) setSettledTab(activeTab);
          }}
        >
        {activeTab === 'overview' && (
          <HomeScreen
            metrics={metrics}
            stats={stats}
            positions={positions}
            transactions={transactions}
            historicalPrices={historicalPriceSeries}
            capitalDeposits={analyticsCapitalDeposits}
            historicalLoading={historicalAnalyticsLoading}
            onOpenPositions={() => handleTabChange('positions')}
            onOpenReports={() => handleTabChange('reports')}
            onQuickAddCash={handleQuickAddCash}
          />
        )}

        {activeTab === 'positions' && (
          <section
            className="premium-hierarchy-h0 premium-flow-related"
            data-hierarchy="h0"
            data-page="positions"
          >
            <div className="min-w-0">
              <h2 className="premium-type-section-title">EGX Portfolio Positions</h2>
              <p className="premium-type-helper mt-0.5">
                Track holdings, unrealized performance, price targets, and position actions.
              </p>
            </div>
            <PositionsTable
              positions={positions}
              onSellPosition={(pos) => setSellingPosition(pos)}
              onBuyMore={(pos) => openAddTrade(tickers.find((t) => t.ticker === pos.ticker) || null)}
              onEditPosition={(pos) => setEditingPosition(pos)}
              onCorrectLedger={openPositionLedgerCorrection}
              onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
              onAddNewTrade={() => openAddTrade()}
            />
          </section>
        )}

        {activeTab === 'closed_cycles' && (
          <ClosedCyclesView
            closedTrades={closedTrades}
            transactions={transactions}
            onCorrectLedger={openClosedCycleLedgerCorrection}
          />
        )}

        {activeTab === 'reports' && (
          <PerformanceReports
            stats={stats}
            closedTrades={closedTrades}
            positions={positions}
            metrics={metrics}
            cashBalance={cashBalance}
            capitalDeposits={analyticsCapitalDeposits}
            transactions={transactions}
            historicalPrices={historicalPriceSeries}
            historicalLoading={historicalAnalyticsLoading}
            chartsReady={settledTab === activeTab}
          />
        )}

        {activeTab === 'journal' && (
          <TradingJournal
            transactions={transactions}
            closedTrades={closedTrades}
            positions={positions}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            ledgerFocus={ledgerCorrectionFocus}
            onClearLedgerFocus={() => setLedgerCorrectionFocus(null)}
            onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
            onSyncToSheets={syncToSheets}
            isSyncingToSheets={isSyncingToSheets}
          />
        )}

        {activeTab === 'cash' && (
          <CashBalanceView
            cashBalance={cashBalance}
            totalPortfolioValue={metrics.totalValue}
            onUpdateCashBalance={handleCashBalanceUpdate}
            positions={positions}
            closedTrades={closedTrades}
            tradeTransactions={transactions}
            capitalDeposits={capitalDeposits}
            onAddCashTransaction={addCashTransaction}
            onEditCashTransaction={editCashTransaction}
            onDeleteCashTransaction={deleteCashTransaction}
            onReconcileLedger={handleOverviewReconcile}
          />
        )}

        {activeTab === 'directory' && (
          <TickerDirectoryView
            tickers={tickers}
            onSelectTickerForTrade={(ticker) => openAddTrade(ticker)}
            onOpenSchemaSync={() => setIsSchemaModalOpen(true)}
            onSyncLivePrices={handleSyncPrices}
            isSyncingPrices={isSyncingPrices}
            lastPriceSyncTime={lastPriceSyncTime}
            onPushPricesToSheet={handlePushPricesToSheetDirectly}
            isSheetsConnected={!!sheetsConfig?.spreadsheetId}
          />
        )}
        </MotionSwap>
      </main>

      {/* Modals & Dialogs */}
      <PriceAlertsModal
        isOpen={isPriceAlertsModalOpen}
        onClose={() => setIsPriceAlertsModalOpen(false)}
        positions={positions}
        settings={alertSettings}
        onUpdateSettings={updateAlertSettings}
        alertHistory={alertHistory}
        onClearHistory={clearAlertHistory}
        onMarkAllRead={markAllAlertsRead}
        permission={alertPermission}
        onRequestPermission={requestAlertPermission}
        onSendTestNotification={sendTestNotification}
        scheduleStatus={scheduleStatus}
        onEditPosition={(pos) => setEditingPosition(pos)}
      />

      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onSaveConfig={(cfg) => {
          updateSheetsConfig(cfg);
          showToast(`Google Sheets connection saved (${cfg.autoSync !== false ? 'Auto Sync ON' : 'Auto Sync OFF'})!`);
        }}
        onImportData={async (importedPositions, importedClosedTrades, config, importedTransactions) => {
          const result = await importBackup({
            positions: importedPositions,
            closedTrades: importedClosedTrades,
            transactions: importedTransactions || [],
            capitalDeposits,
            tickers,
          });
          if ('error' in result) {
            showToast(`Google Sheets import was not saved: ${result.error.message}`, 'error', 7000);
            return false;
          }
          updateSheetsConfig(config);
          showToast(`Imported and persisted ${result.snapshot.transactions.length} ledger records from Google Sheet "${config.sheetName || 'Transaction Logger'}"!`);
          return true;
        }}
        currentConfig={sheetsConfig || undefined}
        authUser={authUser}
        onAuthSuccess={() => {
          showToast('Signed in with Google Account successfully!', 'success');
        }}
        onLogout={async () => {
          await handleLogout();
          showToast('Signed out of Google Account.', 'info');
        }}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        tickers={tickers}
        onReconcileFromLedger={handleOverviewReconcile}
      />

      <PythonSchemaSyncModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        onUpdateTickers={updateTickers}
      />

      <AddTradeModal
        isOpen={isAddTradeModalOpen}
        onClose={closeAddTrade}
        onAddPosition={handleAddPosition}
        tickers={tickers}
        preselectedTicker={selectedTickerForTrade}
        cashBalance={cashBalance}
        existingPositions={positions}
        transactions={transactions}
        onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
      />

      <BonusSharesModal
        isOpen={isBonusSharesModalOpen}
        onClose={() => setIsBonusSharesModalOpen(false)}
        positions={positions}
        onSubmit={handleAddBonusShares}
      />

      <IpoSubscriptionModal
        isOpen={isIpoSubscriptionModalOpen}
        onClose={() => setIsIpoSubscriptionModalOpen(false)}
        tickers={tickers}
        transactions={transactions}
        cashBalance={cashBalance}
        onSubmit={handleAddIpoSubscription}
        onAllocate={handleAllocateIpoSubscription}
        onCancelSubscription={handleCancelIpoSubscription}
      />

      <TradeScreenshotModal
        isOpen={isScreenshotModalOpen}
        onClose={() => setIsScreenshotModalOpen(false)}
        tickers={tickers}
        onAddTransaction={handleAIScreenshotAddTransaction}
        onAddBatchTransactions={handleAIScreenshotAddBatchTransactions}
      />

      <EditPositionModal
        position={editingPosition}
        isOpen={!!editingPosition}
        onClose={() => setEditingPosition(null)}
        onSave={handleSavePositionEdit}
      />

      <SellPositionModal
        position={sellingPosition}
        isOpen={!!sellingPosition}
        onClose={() => setSellingPosition(null)}
        onConfirmSell={handleConfirmSell}
      />

      <QuickCashModal
        isOpen={isQuickCashModalOpen}
        onClose={() => setIsQuickCashModalOpen(false)}
        currentCash={cashBalance}
        onUpdateCash={handleQuickCashBalanceUpdate}
      />

      <PortfolioBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        cashBalance={cashBalance}
        capitalDeposits={capitalDeposits}
        tickers={tickers}
        onRestoreBackup={async (restored) => {
          const result = await importBackup(restored);
          if ('error' in result) {
            showToast(`Portfolio restore was not saved: ${result.error.message}`, 'error', 7000);
            return false;
          }
          showToast(`Portfolio ledger restored and persisted (${result.snapshot.transactions.length} transactions).`, 'success');
          return true;
        }}
        onReconcileLedger={handleOverviewReconcile}
        onOpenBrokerLedgerEvidence={(ticker, transactionIds, detail) => {
          setIsBackupModalOpen(false);
          openBrokerReconciliationLedger(ticker, transactionIds, detail);
        }}
        onOpenBrokerCashLedger={() => {
          setIsBackupModalOpen(false);
          handleTabChange('cash');
        }}
      />

      <DataHealthCenterModal
        isOpen={isDataHealthModalOpen}
        onClose={() => setIsDataHealthModalOpen(false)}
        heldTickers={positions.map((position) => position.ticker)}
      />

      {/* Offline PWA Indicator */}
      <OfflineIndicator />
    </div>
  );
}
