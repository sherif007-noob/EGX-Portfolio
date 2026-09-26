import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PerformanceStats, PortfolioMetrics } from '../types';
import { PortfolioSummary } from './PortfolioSummary';

const metrics = {
  totalValue: 66043.55,
  totalMarketValue: 50887.9,
  totalCost: 55248.3,
  totalPositions: 6,
  cashBalance: 15155.65,
  unrealizedPnlEgp: -4408.81,
  unrealizedPnlPercent: -7.97,
  grossUnrealizedPnlEgp: -4360.4,
  realizedPnlEgp: 423.36,
  dayChangeEgp: -618.41,
  dayChangePercent: -0.93,
  totalFeesPaid: 480.18,
  openFeesPaid: 48.41,
  closedFeesPaid: 431.77,
} as PortfolioMetrics;

const stats = {
  winningTrades: 9,
  losingTrades: 18,
} as PerformanceStats;

describe('PortfolioSummary Phase 8 hierarchy', () => {
  const render = () =>
    renderToStaticMarkup(
      <PortfolioSummary
        metrics={metrics}
        stats={stats}
        onQuickAddCash={() => undefined}
        onSyncLivePrices={() => undefined}
        onReconcileLedger={() => undefined}
      />,
    );

  it('gives the portfolio value one H1 and keeps support metrics below it', () => {
    const html = render();

    expect(html).toContain('data-hierarchy="h1"');
    expect((html.match(/data-hierarchy="h2"/g) ?? []).length).toBe(2);
    expect((html.match(/data-hierarchy="h3"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-hierarchy="h4"');
    expect(html).toContain('premium-overview-hero');
    expect(html).toContain('premium-hero-card');
    expect(html).toContain('premium-semantic-hero');
    expect((html.match(/premium-semantic-card/g) ?? []).length).toBe(3);
    expect(html).toMatch(/premium-semantic-hero[^"]*premium-glow-loss|premium-glow-loss[^"]*premium-semantic-hero/);
    expect(html).toMatch(/premium-semantic-card[^"]*premium-glow-loss|premium-glow-loss[^"]*premium-semantic-card/);
    expect(html).toMatch(/premium-overview-fees[^"]*premium-glow-breakeven|premium-glow-breakeven[^"]*premium-overview-fees/);
  });

  it('places portfolio KPIs before the market-feed utility strip', () => {
    const html = render();

    expect(html.indexOf('Total Portfolio Value')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('Brokerage Fees')).toBeGreaterThan(html.indexOf('Total Portfolio Value'));
    expect(html.indexOf('EGX Live Market Feed')).toBeGreaterThan(html.indexOf('Brokerage Fees'));
  });

  it('keeps maintenance controls visually utility-priority', () => {
    const html = render();
    expect((html.match(/premium-action-priority-utility/g) ?? []).length).toBe(2);
  });
});
