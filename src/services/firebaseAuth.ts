import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Enforce long-lived local persistence so sign-in never expires on tab close or PWA restart
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[FirebaseAuth] Could not enforce browserLocalPersistence:', err);
  });
}

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const provider = new GoogleAuthProvider();
provider.addScope(SHEETS_SCOPE);
provider.addScope(DRIVE_READONLY_SCOPE);

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let isAnonymousBlocked = false;

export const isAnonymousAuthBlocked = (): boolean => isAnonymousBlocked;

/**
 * Ensures there is an authenticated user (Google or Anonymous).
 * If no user is logged in, attempts anonymous auth or returns null if disabled.
 */
export const ensureAuthUser = async (): Promise<User | null> => {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        if (isAnonymousBlocked) {
          resolve(null);
          return;
        }
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (err: any) {
          if (err?.code === 'auth/admin-restricted-operation' || String(err).includes('admin-restricted-operation')) {
            isAnonymousBlocked = true;
            console.info('[FirebaseAuth] Anonymous auth is disabled in Firebase console. Sign in with Google to enable Cloud Sync.');
          } else {
            console.warn('[FirebaseAuth] Anonymous sign-in failed:', err);
          }
          resolve(null);
        }
      }
    });
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const storedToken = localStorage.getItem('google_sheets_access_token');
    if (storedToken) {
      cachedAccessToken = storedToken;
    }
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
    } else {
      if (!isAnonymousBlocked) {
        try {
          await signInAnonymously(auth);
        } catch (e: any) {
          if (e?.code === 'auth/admin-restricted-operation' || String(e).includes('admin-restricted-operation')) {
            isAnonymousBlocked = true;
          } else {
            console.warn('Anonymous auth initialization deferred:', e);
          }
        }
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';

    if (token) {
      cachedAccessToken = token;
      localStorage.setItem('google_sheets_access_token', token);
      localStorage.setItem('google_sheets_token_timestamp', Date.now().toString());
    }
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const clearExpiredToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('google_sheets_access_token');
  localStorage.removeItem('google_sheets_token_timestamp');
};

export const isTokenExpired = (): boolean => {
  return false;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const storedToken = localStorage.getItem('google_sheets_access_token');
  if (storedToken) {
    cachedAccessToken = storedToken;
    return storedToken;
  }
  return null;
};

export const logout = async () => {
  await signOut(auth);
  clearExpiredToken();
  // Immediately re-create anonymous session for local sync
  try {
    await signInAnonymously(auth);
  } catch {
    // ignore
  }
};
