import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

const cases = [
  { file: 'AddTradeModal.tsx', kind: 'buy', save: 'onAddPosition({',
    fields: ['Number of Shares', 'Buy Price (EGP)', 'Brokerage Fees', 'Target Price (EGP)', 'Stop Loss (EGP)', 'Trade Execution Date', 'Execution Time', 'Trade Notes'] },
  { file: 'SellPositionModal.tsx', kind: 'sell', save: 'onConfirmSell(',
    fields: ['Shares to Sell', 'Sell Price (EGP)', 'Sale Date', 'Execution Time', 'Exit Brokerage Fees', 'Net Realized Profit / Loss'] },
  { file: 'EditPositionModal.tsx', kind: 'edit', save: 'onSave({',
    fields: ['Target Price (EGP)', 'Stop Loss (EGP)', 'Position Notes'] },
  { file: 'TradingJournal.tsx', kind: 'edit', save: 'onEditTransaction',
    fields: ['Executed Shares', 'Price per Share (EGP)', 'Execution Date', 'Execution Time', 'Brokerage Commission (EGP)', 'Correction Reason'] },
] as const;

describe('Approved medium trade and position dialog visual migration', () => {
  for (const {file,kind,save,fields} of cases) {
    it(`${file} reuses the approved scoped shell without changing its financial fields`,()=>{
      const ui=source(file);
      expect(ui).toContain('premium-modal-viewport ui-trade-modal ui-trade-modal--'+kind);
      expect(ui).toContain('premium-modal-backdrop-panel-scroll ui-trade-modal-backdrop');
      expect(ui).toContain('ui-trade-modal-identity');
      expect(ui).toContain('ui-trade-modal-form');
      expect(ui).toContain('ui-trade-modal-actions');
      expect(ui).toContain('premium-modal-backdrop-panel-scroll');
      expect(ui).toContain(save);
      for (const field of fields) expect(ui).toContain(field);
    });
  }

  it('preserves order execution date/time conversion for buy, sell and transaction edits',()=>{
    expect(source('AddTradeModal.tsx')).toContain('combineExecutionDateTime(buyDate, executionTime)');
    expect(source('SellPositionModal.tsx')).toContain('combineExecutionDateTime(sellDate, executionTime)');
    expect(source('TradingJournal.tsx')).toContain('combineExecutionDateTime(');
  });

  it('does not spill trade presentation rules onto other premium modal families',()=>{
    const styles=source('../ui/ui.css');
    expect(styles).toContain('.premium-modal.ui-trade-modal {');
    expect(styles).toContain('.premium-modal.ui-trade-modal--sell {');
    expect(styles).toContain('.premium-modal.ui-trade-modal--edit {');
    expect(styles).toContain('.ui-trade-modal .ui-trade-modal-actions');
    expect(styles).toContain('@media (max-width:600px)');
    expect(styles).toContain('env(safe-area-inset-bottom,0px)');
  });
});
