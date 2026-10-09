import {describe,expect,it} from 'vitest';
import {shouldSyncTickerQuotesForPortfolioSave} from './tickerWritePolicy';

describe('independent ledger and market-quote writes',()=>{
  it('never synchronizes 314 ticker quotes as a side effect of one fee or IPO edit',()=>{
    for(const mutation of ['EDIT_TRANSACTION','DELETE_TRANSACTION','EDIT_CASH_TRANSACTION',
      'CASH_DEPOSIT','IPO_SUBSCRIPTION_CORRECT','IPO_SUBSCRIPTION_ALLOCATE','OCR_BATCH_IMPORT',
      'CORPORATE_ACTION_BONUS_SHARES']){
      expect(shouldSyncTickerQuotesForPortfolioSave(mutation)).toBe(false);
    }
  });
  it('retains explicit quote persistence for restores and manual non-audited saves',()=>{
    expect(shouldSyncTickerQuotesForPortfolioSave()).toBe(true);
    expect(shouldSyncTickerQuotesForPortfolioSave('RESTORE_PORTFOLIO')).toBe(true);
    expect(shouldSyncTickerQuotesForPortfolioSave('RESTORE_LEDGER_SNAPSHOT')).toBe(true);
  });
});
