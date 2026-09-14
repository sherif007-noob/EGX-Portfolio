import { useState, useEffect, useCallback } from 'react';
import { GoogleSheetsConfig, Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import {
  initAuth,
  logout,
  getAccessToken,
  clearExpiredToken,
  googleSignIn,
} from '../services/firebaseAuth';
import {
  syncAllPortfolioToSheet,
  syncStockPricesToSheet,
  fetchServiceAccountStatus,
} from '../services/googleSheets';
import { User } from 'firebase/auth';

const STORAGE_KEY_SHEETS = 'egx_pwa_sheets_config_v1';

export function useGoogleSheetsSync(
  positions: Position[],
  closedTrades: ClosedTrade[],
  transactions: TradeTransaction[],
  cashBalance: number,
  tickers: EGXTicker[]
) {
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHEETS);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isSyncingToSheets, setIsSyncingToSheets] = useState(false);
  const [sheetsSyncFeedback, setSheetsSyncFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isSheetsTokenExpired, setIsSheetsTokenExpired] = useState<boolean>(false);
  const [isServiceAccountActive, setIsServiceAccountActive] = useState<boolean>(false);

  // Save sheets config to localStorage
  useEffect(() => {
    if (sheetsConfig) {
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsConfig));
    } else {
      localStorage.removeItem(STORAGE_KEY_SHEETS);
    }
  }, [sheetsConfig]);

  // Check Service Account status on load
  useEffect(() => {
    fetchServiceAccountStatus().then((status) => {
      setIsServiceAccountActive(status.configured);
    });
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setAuthUser(user);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Perform full two-way sync or export to Google Sheets
  const syncToSheets = useCallback(async () => {
    const token = await getAccessToken();

    if (!sheetsConfig?.spreadsheetId) {
      setSheetsSyncFeedback({
        type: 'error',
        message: 'No Google Spreadsheet linked. Please configure a Spreadsheet ID in Google Sheets setup.',
      });
      return { success: false, message: 'No spreadsheet linked' };
    }

    setIsSyncingToSheets(true);
    setSheetsSyncFeedback(null);

    try {
      const result = await syncAllPortfolioToSheet(
        sheetsConfig.spreadsheetId,
        positions,
        closedTrades,
        transactions,
        tickers,
        token
      );

      if (result.success) {
        setIsSheetsTokenExpired(false);
        setSheetsSyncFeedback({
          type: 'success',
          message: `Portfolio successfully synced to Google Sheets (${transactions.length} trades, ${positions.length} holdings).`,
        });
      } else {
        if (result.isAuthError) {
          clearExpiredToken();
          setIsSheetsTokenExpired(true);
          setSheetsSyncFeedback({
            type: 'error',
            message: 'Google Sheets session requires authentication or Service Account setup. Please check settings.',
          });
        } else {
          setSheetsSyncFeedback({
            type: 'error',
            message: result.message || 'Failed to sync with Google Sheets.',
          });
        }
      }
      return result;
    } catch (err: any) {
      const isAuth = Boolean(err?.isAuthError || err?.message?.includes('Auth') || err?.message?.includes('401'));
      if (isAuth) {
        clearExpiredToken();
        setIsSheetsTokenExpired(true);
      }
      const errMsg = err?.message || 'Error syncing with Google Sheets';
      setSheetsSyncFeedback({ type: 'error', message: errMsg });
      return { success: false, message: errMsg };
    } finally {
      setIsSyncingToSheets(false);
    }
  }, [sheetsConfig, positions, closedTrades, transactions, tickers]);

  // Push live prices only to Google Sheets (Ticker Directory & Active Positions)
  const syncPricesOnlyToSheets = useCallback(
    async (overrideTickers?: EGXTicker[], overridePositions?: Position[]) => {
      const activeTickers = overrideTickers || tickers;
      const activePositions = overridePositions || positions;
      const token = await getAccessToken();

      if (!sheetsConfig?.spreadsheetId) {
        return { success: false, message: 'No spreadsheet linked', updatedTabs: [] as string[] };
      }

      try {
        const result = await syncStockPricesToSheet(
          sheetsConfig.spreadsheetId,
          activeTickers,
          activePositions,
          token
        );
        if (result.isAuthError) {
          clearExpiredToken();
          setIsSheetsTokenExpired(true);
        }
        return result;
      } catch (err: any) {
        const isAuth = Boolean(err?.isAuthError || err?.message?.includes('Auth') || err?.message?.includes('401'));
        if (isAuth) {
          clearExpiredToken();
          setIsSheetsTokenExpired(true);
        }
        return { success: false, message: err?.message || 'Failed syncing prices', updatedTabs: [] as string[] };
      }
    },
    [sheetsConfig, tickers, positions]
  );

  // Update sheets config
  const updateSheetsConfig = useCallback((newConfig: GoogleSheetsConfig | null) => {
    setSheetsConfig(newConfig);
  }, []);

  // Sign in / Sign out helpers
  const handleLogin = useCallback(async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setAuthUser(result.user);
        setIsSheetsTokenExpired(false);
      }
      return result;
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    clearExpiredToken();
    setAuthUser(null);
  }, []);

  return {
    sheetsConfig,
    authUser,
    isSyncingToSheets,
    sheetsSyncFeedback,
    isSheetsTokenExpired,
    isServiceAccountActive,
    syncToSheets,
    syncPricesOnlyToSheets,
    updateSheetsConfig,
    handleLogin,
    handleLogout,
  };
}
