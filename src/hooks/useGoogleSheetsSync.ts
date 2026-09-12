import { useState, useEffect, useCallback } from 'react';
import { GoogleSheetsConfig, Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import {
  initAuth,
  logout,
  getAccessToken,
  isTokenExpired,
  clearExpiredToken,
  googleSignIn,
} from '../services/firebaseAuth';
import { syncAllPortfolioToSheet } from '../services/googleSheets';
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
  const [isSheetsTokenExpired, setIsSheetsTokenExpired] = useState<boolean>(() => isTokenExpired());

  // Save sheets config to localStorage
  useEffect(() => {
    if (sheetsConfig) {
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsConfig));
    } else {
      localStorage.removeItem(STORAGE_KEY_SHEETS);
    }
  }, [sheetsConfig]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setAuthUser(user);
      setIsSheetsTokenExpired(isTokenExpired());
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Check token expiry periodically
  useEffect(() => {
    const checkExpiry = () => {
      setIsSheetsTokenExpired(isTokenExpired());
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);
    window.addEventListener('focus', checkExpiry);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkExpiry);
    };
  }, []);

  // Perform full two-way sync or export to Google Sheets
  const syncToSheets = useCallback(async () => {
    const token = await getAccessToken();
    if (!token || isTokenExpired()) {
      setIsSheetsTokenExpired(true);
      setSheetsSyncFeedback({
        type: 'error',
        message: 'Google Sheets OAuth session has expired. Please re-authenticate via Google Sheets modal.',
      });
      return { success: false, message: 'Token expired' };
    }

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
            message: 'Google Sheets OAuth session has expired. Please re-authenticate via Google Sheets modal.',
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
    setIsSheetsTokenExpired(true);
  }, []);

  return {
    sheetsConfig,
    authUser,
    isSyncingToSheets,
    sheetsSyncFeedback,
    isSheetsTokenExpired,
    syncToSheets,
    updateSheetsConfig,
    handleLogin,
    handleLogout,
  };
}
