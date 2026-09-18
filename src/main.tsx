import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SupabaseAuthGate } from './components/SupabaseAuthGate.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SupabaseAuthGate />
    </ErrorBoundary>
  </StrictMode>,
);

