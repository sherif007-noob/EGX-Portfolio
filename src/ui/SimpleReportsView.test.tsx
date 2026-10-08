import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ClosedTrade, PerformanceStats, Position, PortfolioMetrics } from '../types';
import { buildSimpleAllocation, buildSimpleMonths } from './simpleReportsModel';
import { SimpleReportsView } from './SimpleReportsView';
import { PersonalRiskView } from './PersonalRiskView';

const holding: Position = {
  id:'p1', ticker:'ARCC', companyName:'Arabian Cement',
  sector:'Building Materials & Cement', shares:100,
  avgBuyPrice:10, currentPrice:12, totalFees:5, buyDate:'2026-09-15',
};
const septCycle: ClosedTrade = {
  id:'c1',ticker:'ACTF',companyName:'Act Financial',sector:'Banking',
  shares:100,buyPrice:3,sellPrice:4,buyDate:'2026-09-04',sellDate:'2026-09-16',
  holdingDays:12,realizedPnlEgp:100,realizedPnlPercent:33.33,
  tradeType:'Swing',outcome:'WIN',
};
const octCycle: ClosedTrade = {...septCycle,id:'c2',sellDate:'2026-10-07',realizedPnlEgp:-50,
  realizedPnlPercent:-8,outcome:'LOSS'};
const stats: PerformanceStats = {
  winRate:50,profitFactor:1,totalTrades:2,winningTrades:1,losingTrades:1,
  avgReturnPercent:10,avgHoldDays:12,bestTradePercent:20,worstTradePercent:-8,
  totalRealizedGainEgp:100,totalRealizedLossEgp:-50,totalBrokerageFeesPaid:8,
  sectorAllocation:[],
};
const metrics: PortfolioMetrics = {
  totalValue:2000,totalCost:1000,unrealizedPnlEgp:195,unrealizedPnlPercent:19.5,
  realizedPnlEgp:50,cashBalance:800,dayChangeEgp:-15,dayChangePercent:-.75,
  totalPositions:1,winningPositionsCount:1,losingPositionsCount:0,
};

describe('medium-ui Reports', () => {
  it('derives allocation from positions and optional cash without double counting', () => {
    const noCash = buildSimpleAllocation([holding], 800, 'sector', false);
    expect(noCash).toHaveLength(1);
    expect(noCash[0].value).toBe(1200);
    expect(noCash[0].percent).toBe(100);
    const withCash = buildSimpleAllocation([holding],800,'stock',true);
    expect(withCash).toHaveLength(2);
    expect(withCash.reduce((sum,x)=>sum+x.value,0)).toBe(2000);
    expect(withCash.reduce((sum,x)=>sum+x.percent,0)).toBeCloseTo(100,8);
  });

  it('never fabricates historical month-end holding P&L', () => {
    const rows = buildSimpleMonths([septCycle,octCycle],[holding],'2026-10-08');
    const oct = rows.find(x => x.key === '2026-10');
    const sept = rows.find(x => x.key === '2026-09');
    expect(oct?.realized).toBe(-50);
    expect(oct?.openSnapshot).toBe(195);
    expect(oct?.snapshotTotal).toBe(145);
    expect(sept?.realized).toBe(100);
    expect(sept?.openSnapshot).toBeNull();
    expect(sept?.snapshotTotal).toBeNull();
  });

  it('renders a native personal-risk view without premium report cards', () => {
    const html = renderToStaticMarkup(
      <PersonalRiskView positions={[{...holding,stopLoss:11}]} closedTrades={[septCycle]}
        cashBalance={800} nav={2000} pendingIpoValue={0}/>,
    );
    expect(html).toContain('Your risk right now');
    expect(html).toContain('How concentrated am I?');
    expect(html).toContain('What happens if my stops trigger?');
    expect(html).toContain('Largest realized P&amp;L drawdown');
    expect(html).toContain('Stop set');
    expect(html).not.toContain('premium-card');
  });

  it('shows uncovered exposures, rather than claiming portfolio protection', () => {
    const html = renderToStaticMarkup(
      <PersonalRiskView positions={[holding]} closedTrades={[]}
        cashBalance={800} nav={2000}/>,
    );
    expect(html).toContain('No usable stops');
    expect(html).toContain('This is not portfolio-wide downside.');
  });

  it('renders a new Reports layout with a route to advanced tools', () => {
    const html = renderToStaticMarkup(
      <SimpleReportsView stats={stats} closedTrades={[septCycle,octCycle]}
        positions={[holding]} metrics={metrics} cashBalance={800}
        capitalDeposits={1755} transactions={[]} historicalPrices={{}}/>,
    );
    expect(html).toContain('ui-report-page');
    expect(html).toContain('Detailed workspace');
    expect(html).toContain('Report view');
    expect(html).toContain('Allocation');
    expect(html).toContain('My Risk');
    expect(html).not.toContain('premium-reports-hierarchy');
  });
});
