import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PortfolioMetrics } from '../types';
import { CompactPortfolioStrip } from './CompactPortfolioStrip';

const metrics: PortfolioMetrics = {
  totalValue: 130000,
  totalCost: 70000,
  unrealizedPnlEgp: -1200,
  unrealizedPnlPercent: -1.7,
  realizedPnlEgp: 573,
  cashBalance: 60000,
  dayChangeEgp: -850,
  dayChangePercent: -0.65,
  totalPositions: 9,
  winningPositionsCount: 2,
  losingPositionsCount: 7,
};

describe('CompactPortfolioStrip', () => {
  it('shows only Value, Today and Cash context', () => {
    const html = renderToStaticMarkup(<CompactPortfolioStrip metrics={metrics} />);

    expect(html).toContain('Value');
    expect(html).toContain('Today');
    expect(html).toContain('Cash');
    expect(html).not.toContain('Realized');
    expect(html).not.toContain('Fees');
    expect(html).not.toContain('Live Market Feed');
  });
});
