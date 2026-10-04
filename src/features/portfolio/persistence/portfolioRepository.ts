import {
  flushPendingWriteQueue,
  forceFullSyncToFirestore,
  loadPortfolioFromFirestore,
  subscribeToPortfolioFromFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
} from '../../../services/firestoreStorage';
import { getSupabaseBrowserClient } from '../../../data/supabase';

export const portfolioRepository = {
  load: loadPortfolioFromFirestore,
  saveSnapshot: forceFullSyncToFirestore,
  subscribe: subscribeToPortfolioFromFirestore,
  updatePositions: updateFirestorePositions,
  updateTickers: updateFirestoreTickers,
  flushPendingWrites: flushPendingWriteQueue,
  getSession: async () => {
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    return session;
  },
} as const;
