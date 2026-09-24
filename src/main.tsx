import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { SupabaseAuthGate } from './components/SupabaseAuthGate.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <SupabaseAuthGate />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
);

