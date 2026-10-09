import { describe,expect,it } from 'vitest';
import type { TradeTransaction } from '../types';
import { prepareTransactionEditMutation,prepareTransactionDeleteMutation,prepareIpoSubscriptionMutation } from './ledgerWorkflowMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { pendingIpoSubscriptionValue } from './ipoSubscriptions';

const opening:TradeTransaction={id:'cash-1',ticker:'CASH',type:'BUY',companyName:'Cash Balance',sector:'Other',
  shares:100000,price:1,totalAmount:100000,fees:0,date:'2026-10-07',cashFlowType:'DEPOSIT',cashFlowAmount:100000};
function snapshot(transactions:TradeTransaction[]){
  const result=reconcilePortfolioFromLedger(transactions,[],transactions.some(tx=>tx.ticker==='CASH')?100000:0);
  return { transactions, positions:result.reconciledPositions,closedTrades:result.reconciledClosedTrades,
    tickers:[],cashBalance:result.reconciledCashBalance,capitalDeposits:100000 };
}

describe('Activity audited financial edits and deletes',()=>{
  it('edits a cash deposit as cash rather than an equity trade and recalculates capital',()=>{
    const prior=snapshot([opening]);
    const updated:TradeTransaction={...opening,shares:90000,totalAmount:90000,cashFlowAmount:90000};
    const result=prepareTransactionEditMutation(prior,updated);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].ticker).toBe('CASH');
    expect(result.transactions[0].cashFlowType).toBe('DEPOSIT');
    expect(result.capitalDeposits).toBe(90000);
    expect(reconcilePortfolioFromLedger(result.transactions,[],result.capitalDeposits!).reconciledCashBalance).toBe(90000);
  });
  it('deletes an erroneous pending IPO reservation without generating fake share positions',()=>{
    const orig=snapshot([opening]);
    const placed=prepareIpoSubscriptionMutation(orig,{
      transactionId:'pending-ipo',ticker:'IPOX',companyName:'Example',sector:'Other',
      requestedShares:4000,requestedAmount:100000,reservedAmount:25000,offerPrice:25,
      subscriptionDate:'2026-10-09',
    });
    const before=snapshot(placed.transactions);
    expect(before.cashBalance).toBe(75000);
    const deleted=prepareTransactionDeleteMutation(before,'pending-ipo');
    expect(deleted.transactions).toEqual([opening]);
    const reconciled=reconcilePortfolioFromLedger(deleted.transactions,[],deleted.capitalDeposits!);
    expect(reconciled.reconciledCashBalance).toBe(100000);
    expect(reconciled.reconciledPositions).toEqual([]);
    expect(pendingIpoSubscriptionValue(deleted.transactions)).toBe(0);
  });
});
