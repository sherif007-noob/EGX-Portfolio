import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const provider = new GoogleAuthProvider();
provider.addScope(SHEETS_SCOPE);
provider.addScope(DRIVE_READONLY_SCOPE);

let isSigningIn = false;
let cachedAccessToken: string | null = null;

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
      // Do not clear the Google Sheets token on initial unauthenticated state,
      // only clear when explicit logout is called.
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Sign-In');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_sheets_access_token', credential.accessToken);
    localStorage.setItem('google_sheets_token_timestamp', Date.now().toString());
    return { user: result.user, accessToken: cachedAccessToken };
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
  const timestampStr = localStorage.getItem('google_sheets_token_timestamp');
  if (!timestampStr) return false;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  // Consider expired if older than 55 minutes (3300 seconds)
  return Date.now() - timestamp > 55 * 60 * 1000;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (isTokenExpired()) {
    clearExpiredToken();
    return null;
  }
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
};
