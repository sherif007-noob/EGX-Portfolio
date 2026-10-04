import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./TradeScreenshotModal.tsx', import.meta.url)),
  'utf8',
);

describe('OCR batch review integrity', () => {
  it('shows execution time as an editable field', () => {
    expect(source).toContain('Execution time');
    expect(source).toContain('executionTimeInputValue(trade.executedAt)');
    expect(source).toContain('combineExecutionDateTime(trade.date, e.target.value)');
  });

  it('keeps execution date and time coupled when the date is corrected', () => {
    expect(source).toContain('const time = executionTimeInputValue(trade.executedAt)');
    expect(source).toContain('executedAt: time ? combineExecutionDateTime(d, time) : undefined');
  });

  it('filters exact duplicate screenshot bytes before OCR without grouping by ticker', () => {
    expect(source).toContain('const seenImages = new Set(');
    expect(source).toContain('const uniqueBase64List = base64List.filter');
    expect(source).toContain('seenImages.has(item.base64)');
    expect(source).toContain('Distinct executions were kept.');
    expect(source).not.toContain('groupByTicker');
  });
});
