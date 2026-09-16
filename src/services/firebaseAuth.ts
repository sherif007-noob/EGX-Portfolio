import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Keep the Google-authenticated Firebase session across reloads and PWA restarts.
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

// Anonymous Firebase users must never be used for the cloud portfolio because
// Supabase ownership is keyed to the user's Google-authenticated Firebase UID.
export const isAnonymousAuthBlocked = (): boolean => true;

/**
 * Returns the currently authenticated Firebase user.
 *
 * Do not create an anonymous user here. Doing so would generate a different UID
 * and make the migrated Supabase portfolio appear empty.
 */
export const ensureAuthUser = async (): Promise<User | null> => {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      if (user) {
        console.info('[FirebaseAuth] Authenticated Firebase UID:', user.uid);
      } else {
        console.warn('[FirebaseAuth] No Google-authenticated Firebase user is available.');
      }
      resolve(user);
    };

    unsubscribe = onAuthStateChanged(auth, (user) => finish(user));
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
      console.info('[FirebaseAuth] Auth state:', user.isAnonymous ? 'anonymous' : 'Google-authenticated', 'UID:', user.uid);
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
    } else {
      console.info('[FirebaseAuth] Auth state: signed out');
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

    console.info('[FirebaseAuth] Google sign-in successful. Firebase UID:', result.user.uid);
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
  console.info('[FirebaseAuth] Signed out. No anonymous session will be created.');
};
