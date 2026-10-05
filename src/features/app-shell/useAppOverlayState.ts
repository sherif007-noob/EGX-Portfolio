import { useCallback, useState } from 'react';
import type { EGXTicker, Position } from '../../types';

export function useAppOverlayState() {
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [isQuickCashModalOpen, setIsQuickCashModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isDataHealthModalOpen, setIsDataHealthModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [isPriceAlertsModalOpen, setIsPriceAlertsModalOpen] = useState(false);
  const [isCorporateActionsModalOpen, setIsCorporateActionsModalOpen] = useState(false);
  const [sellingPosition, setSellingPosition] = useState<Position | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedTickerForTrade, setSelectedTickerForTrade] = useState<EGXTicker | null>(null);

  const openAddTrade = useCallback((ticker: EGXTicker | null = null) => {
    setSelectedTickerForTrade(ticker);
    setIsAddTradeModalOpen(true);
  }, []);

  const closeAddTrade = useCallback(() => {
    setIsAddTradeModalOpen(false);
    setSelectedTickerForTrade(null);
  }, []);

  return {
    isSheetsModalOpen,
    setIsSheetsModalOpen,
    isSchemaModalOpen,
    setIsSchemaModalOpen,
    isAddTradeModalOpen,
    setIsAddTradeModalOpen,
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
    isCorporateActionsModalOpen,
    setIsCorporateActionsModalOpen,
    sellingPosition,
    setSellingPosition,
    editingPosition,
    setEditingPosition,
    selectedTickerForTrade,
    setSelectedTickerForTrade,
    openAddTrade,
    closeAddTrade,
  };
}
