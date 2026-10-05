import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const modalFiles = [
  './AddTradeModal.tsx',
  './SellPositionModal.tsx',
  './EditPositionModal.tsx',
  './QuickCashModal.tsx',
  './PortfolioBackupModal.tsx',
  './GoogleSheetsModal.tsx',
  './PriceAlertsModal.tsx',
  './PythonSchemaSyncModal.tsx',
  './TradeScreenshotModal.tsx',
  './ConfirmDeleteModal.tsx',
  './CashBalanceView.tsx',
  './TradingJournal.tsx',
  './PWAInstallButton.tsx',
];

describe('Phase 10.8 modal and workflow consistency', () => {
  it('centralizes every premium modal in the shared body portal', () => {
    const motion = readRelative('./PremiumMotion.tsx');

    expect(motion).toContain('createPortal(modal, document.body)');
    expect(motion).toContain('role="dialog"');
    expect(motion).toContain('aria-modal="true"');
    expect(motion).toContain("document.body.style.overflow = 'hidden'");
    expect(motion).toContain('previouslyFocused.focus({ preventScroll: true })');
  });

  it('tracks the actual visual viewport for mobile keyboard safety', () => {
    const motion = readRelative('./PremiumMotion.tsx');

    expect(motion).toContain('window.visualViewport');
    expect(motion).toContain("visualViewport?.addEventListener('resize'");
    expect(motion).toContain("visualViewport?.addEventListener('scroll'");
    expect(motion).toContain("'--premium-modal-visual-height'");
    expect(motion).toContain('height: visualViewportRect.height');
  });

  it('uses one vertical scroll owner for every modal shell', () => {
    for (const file of modalFiles) {
      expect(readRelative(file)).toContain('premium-modal-backdrop-panel-scroll');
    }

    const css = readRelative('../styles/overlays.css');
    expect(css).toContain('overflow-y: hidden !important;');
    expect(css).toContain('scroll-padding-block: 1rem 5rem;');
    expect(css).toContain('-webkit-overflow-scrolling: touch;');
  });

  it('removes component-local modal portals now owned by PremiumModalMotion', () => {
    const cash = readRelative('./CashBalanceView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    expect(cash).not.toContain("import { createPortal } from 'react-dom'");
    expect(journal).not.toContain("import { createPortal } from 'react-dom'");
    expect(cash).not.toContain('createPortal((');
    expect(journal).not.toContain('createPortal((');
    const pwa = readRelative('./PWAInstallButton.tsx');
    expect(pwa).not.toContain("import { createPortal } from 'react-dom'");
    expect(pwa).toContain('<PremiumModalMotion');
  });

  it('keeps framed modal bodies independently scrollable', () => {
    const css = readRelative('../styles/overlays.css');
    const sheets = readRelative('./GoogleSheetsModal.tsx');
    const alerts = readRelative('./PriceAlertsModal.tsx');
    const screenshot = readRelative('./TradeScreenshotModal.tsx');

    expect(css).toContain('var(--premium-modal-visual-height, 100dvh)');
    expect(sheets).toContain('premium-modal-frame');
    expect(sheets).toContain('premium-modal-scroll-body');
    expect(alerts).toContain('premium-modal-frame');
    expect(alerts).toContain('premium-modal-scroll-body');
    expect(screenshot).toContain('premium-modal-frame');
    expect(screenshot).toContain('premium-modal-scroll-body');
  });

  it('keeps icon close affordances accessible across the long-form workflows', () => {
    expect(readRelative('./AddTradeModal.tsx')).toContain('aria-label="Close add trade"');
    expect(readRelative('./SellPositionModal.tsx')).toContain('aria-label="Close sell position"');
    expect(readRelative('./TradeScreenshotModal.tsx')).toContain(
      'aria-label="Close trade screenshot scanner"',
    );
    expect(readRelative('./CashBalanceView.tsx')).toContain(
      'aria-label="Close cash transaction editor"',
    );
    expect(readRelative('./TradingJournal.tsx')).toContain(
      'aria-label="Close transaction editor"',
    );
    expect(readRelative('./PWAInstallButton.tsx')).toContain(
      'aria-label="Close install guide"',
    );
  });

  it('keeps destructive and primary action hierarchy unchanged', () => {
    expect(readRelative('./ConfirmDeleteModal.tsx')).toContain(
      'premium-action premium-action-danger',
    );
    expect(readRelative('./AddTradeModal.tsx')).toContain(
      'premium-action premium-action-primary premium-shimmer-border',
    );
    expect(readRelative('./SellPositionModal.tsx')).toContain(
      'premium-action premium-action-warning',
    );
    expect(readRelative('./EditPositionModal.tsx')).toContain(
      'premium-action premium-action-primary',
    );
    expect(readRelative('./TradingJournal.tsx')).toContain(
      'premium-action premium-action-primary',
    );
  });

  it('does not reopen accounting, analytics, or material ownership', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const reconciliation = readRelative('../services/portfolioReconciliation.ts');

    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(reconciliation).toContain('reconcilePortfolioFromLedger');
  });
});
