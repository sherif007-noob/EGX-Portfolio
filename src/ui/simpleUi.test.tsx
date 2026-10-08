import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PerformanceStats, PortfolioMetrics, Position } from '../types';
import { formatChartDate, formatCompact, formatPercent, formatSigned, toneClass } from './format';
import { HomeScreen, positionPnl } from './HomeScreen';
import { ActivitySwitcher, SimpleShell } from './SimpleShell';

const metrics: PortfolioMetrics = {
  totalValue: 116955,
  totalMarketValue: 36400,
  totalCost: 34900,
  unrealizedPnlEgp: 1382,
  unrealizedPnlPercent: 3.95,
  realizedPnlEgp: 573,
  cashBalance: 80555,
  dayChangeEgp: 212.5,
  dayChangePercent: 0.18,
  totalPositions: 2,
  winningPositionsCount: 1,
  losingPositionsCount: 1,
  totalFeesPaid: 215,
};

const stats = { totalTrades: 2, winningTrades: 1, losingTrades: 1 } as PerformanceStats;

const positions: Position[] = [
  { id: 'p1', ticker: 'COMI', companyName: 'Commercial International Bank', sector: 'Banking' as Position['sector'], shares: 300, avgBuyPrice: 55, currentPrice: 61.5, buyDate: '2026-09-01', totalFees: 60 },
  { id: 'p2', ticker: 'MASR', companyName: 'Madinet Masr', sector: 'Real Estate & Construction' as Position['sector'], shares: 1000, avgBuyPrice: 7.2, currentPrice: 6.64, buyDate: '2026-09-02', totalFees: 25 },
];

const noop = () => undefined;

describe('simple UI formatters', () => {
  it('formats signed values, percentages and tone', () => {
    expect(formatSigned(1382)).toBe('+1,382.00');
    expect(formatSigned(-585, 0)).toBe('-585');
    expect(formatPercent(3.949)).toBe('+3.95%');
    expect(formatPercent(null)).toBe('—');
    expect(toneClass(5)).toBe('ui-pos');
    expect(toneClass(-5)).toBe('ui-neg');
    expect(toneClass(0)).toBe('');
  });

  it('formats compact axis labels and chart dates', () => {
    expect(formatCompact(116955)).toBe('117k');
    expect(formatCompact(2300)).toBe('2.3k');
    expect(formatCompact(950)).toBe('950');
    expect(formatChartDate('2026-09-07')).toBe('7 Sep');
    expect(formatChartDate('2026-10-07T10:30:00.000Z')).toBe('10:30');
  });
});

describe('positionPnl', () => {
  it('reports unrealized P&L net of buy fees', () => {
    const { marketValue, pnl, percent } = positionPnl(positions[0]);
    expect(marketValue).toBeCloseTo(18450, 8);
    expect(pnl).toBeCloseTo(18450 - (300 * 55 + 60), 8);
    expect(percent).toBeCloseTo((pnl / (300 * 55 + 60)) * 100, 8);
  });
});

describe('HomeScreen', () => {
  it('shows the hero, only realized and unrealized tiles, holdings and cash rows', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        metrics={metrics}
        stats={stats}
        positions={positions}
        transactions={[]}
        historicalPrices={{}}
        capitalDeposits={0}
        onOpenPositions={noop}
        onOpenReports={noop}
        onQuickAddCash={noop}
      />,
    );

    expect(html).toContain('Portfolio value');
    expect(html).toContain('116,955.00');
    expect(html).toContain('Realized P&amp;L');
    expect(html).toContain('Unrealized P&amp;L');
    expect(html).toContain('2 closed trades');
    expect(html).toContain('COMI');
    expect(html).toContain('Performance metrics');
    expect(html).toContain('Cash and costs');
    expect(html).toContain('Fees paid');
    // Chart modes, with Return preselected.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Return</);
    expect(html).toContain('Benchmarks');
    // The legacy analytics tiles no longer live on Home.
    expect(html).not.toContain('Brokerage Fees');
    expect(html).not.toContain('Live Market Feed');
  });
});

describe('SimpleShell', () => {
  const render = (activeTab: Parameters<typeof SimpleShell>[0]['activeTab']) =>
    renderToStaticMarkup(
      <SimpleShell
        activeTab={activeTab}
        setActiveTab={noop}
        onOpenGoogleSheets={noop}
        onOpenAddTrade={noop}
        isSheetsConnected={false}
        onSyncLivePrices={noop}
        onOpenPriceAlerts={noop}
        unreadAlertCount={2}
      />,
    );

  it('exposes the five primary destinations and marks the current one', () => {
    const html = render('overview');
    for (const label of ['Home', 'Holdings', 'Activity', 'Reports', 'More']) expect(html).toContain(label);
    expect(html).toMatch(/aria-current="page"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Home/);
    expect(html).toContain('aria-label="Add"');
    expect(html).toContain('Price alerts, 2 unread');
  });

  it('keeps Activity highlighted for Transactions, Cash and Closed Cycles', () => {
    for (const tab of ['journal', 'cash', 'closed_cycles'] as const) {
      expect(render(tab)).toMatch(/aria-current="page"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Activity/);
    }
  });

  it('renders the activity switcher with the active segment pressed', () => {
    const html = renderToStaticMarkup(<ActivitySwitcher activeTab="cash" setActiveTab={noop} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Cash</);
    expect(html).toContain('Transactions');
    expect(html).toContain('Closed');
  });
});

describe('MetricsScreen', () => {
  it('shows returns, risk, equity bridge, trading and cost sections with a small-sample warning', async () => {
    const { MetricsScreen } = await import('./MetricsScreen');
    const html = renderToStaticMarkup(
      <MetricsScreen
        stats={{
          winRate: 50,
          profitFactor: 2.54,
          totalTrades: 2,
          winningTrades: 1,
          losingTrades: 1,
          avgReturnPercent: 1.4,
          avgHoldDays: 9,
          bestTradePercent: 13.08,
          worstTradePercent: -6.2,
          totalRealizedGainEgp: 945,
          totalRealizedLossEgp: 372,
          totalBrokerageFeesPaid: 97,
          sectorAllocation: [],
          payoffRatio: 2.54,
          expectancyEgp: 286.5,
        }}
        closedTrades={[]}
        positions={positions}
        metrics={metrics}
        cashBalance={80555}
        capitalDeposits={115000}
        transactions={[]}
        historicalPrices={{}}
      />,
    );

    for (const label of ['TWR', 'MWR', 'Max drawdown', 'Equity bridge', 'Gross profit', 'Profit factor', 'Payoff ratio', 'Expectancy', 'Fees paid']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('1W / 1L');
    expect(html).toContain('Only 2 closed trades');
    expect(html).toContain('2.54');
  });
});
