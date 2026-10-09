import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ClosedTrade, TradeTransaction } from '../types';
import { ActivityPills } from './SimpleActivityShared';
import { SimpleTransactionsView } from './SimpleTransactionsView';
import { SimpleClosedView, cycleSourceIds } from './SimpleClosedView';
import { SimpleCashView } from './SimpleCashView';

const transaction: TradeTransaction = {
  id:'sell-1', type:'SELL', ticker:'ARCC', companyName:'Arabian Cement',
  sector:'Building Materials & Cement', shares:100, price:12, fees:2,
  totalAmount:1198, date:'2026-10-06', realizedPnlEgp:100,
};
const cycle: ClosedTrade = {
  id:'cycle-1', ticker:'ARCC', companyName:'Arabian Cement',
  sector:'Building Materials & Cement', shares:100,
  buyPrice:11, sellPrice:12, buyDate:'2026-09-30', sellDate:'2026-10-06',
  holdingDays:6, realizedPnlEgp:100, realizedPnlPercent:9.09,
  outcome:'WIN', tradeType:'Swing', sellTransactionIds:['sell-1'],
};

describe('native Medium UI Activity presentation', () => {
  it('renders wrapping pill buttons with active state', () => {
    const html = renderToStaticMarkup(
      <ActivityPills label="Filter" value="ALL" onChange={() => {}} choices={[
        { value:'ALL', label:'All' }, { value:'BUY', label:'Buys' },
      ]}/>,
    );
    expect(html).toContain('ui-pill-wrap');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Buys');
    expect(html).not.toContain('<select');
  });

  it('renders new journal feed without legacy premium cards by default', () => {
    const html = renderToStaticMarkup(
      <SimpleTransactionsView transactions={[transaction]} closedTrades={[cycle]}
        positions={[]} onDeleteTransaction={async () => true} onEditTransaction={async () => true}
        onSaveCashRecord={async()=>true} onSaveIpo={async()=>true} onAllocateIpo={async()=>true}
        onBuyMoreTicker={()=>{}} onSellPosition={()=>{}}/>,
    );
    expect(html).toContain('ui-activity-native');
    expect(html).toContain('ui-activity-record');
    expect(html).toContain('ARCC');
    expect(html).not.toContain('premium-card');
    expect(html).not.toContain('premium-dense-workflow');
  });

  it('retains exact cycle-to-execution links', () => {
    expect(cycleSourceIds(cycle,[transaction])).toEqual(['sell-1']);
  });

  it('resolves missing BUY links without dropping an explicitly linked SELL', () => {
    const buy = {...transaction, id:'buy-1',type:'BUY' as const,date:'2026-10-01'};
    expect(cycleSourceIds(cycle,[buy,transaction])).toEqual(['sell-1','buy-1']);
  });

  it('renders closed results as simple rows', () => {
    const html = renderToStaticMarkup(
      <SimpleClosedView closedTrades={[cycle]} transactions={[transaction]}
        onCorrectLedger={() => {}}/>,
    );
    expect(html).toContain('ui-activity-record');
    expect(html).toContain('Realized P&amp;L');
    expect(html).not.toContain('premium-card');
  });

  it('renders the native cash transfer form, not the legacy ledger', () => {
    const html = renderToStaticMarkup(
      <SimpleCashView cashBalance={2500} totalPortfolioValue={9000}
        tradeTransactions={[]} positions={[]} capitalDeposits={0}
        onUpdateCashBalance={async () => true}
        onAddCashTransaction={async () => true}
        onEditCashTransaction={async () => true}
        onDeleteCashTransaction={async () => true}/>,
    );
    expect(html).toContain('Transfer cash');
    expect(html).toContain('Record deposit');
    expect(html).toContain('ui-activity-native');
    expect(html).not.toContain('premium-dense-workflow');
  });
});
