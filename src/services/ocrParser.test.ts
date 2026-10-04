import { describe, expect, it } from 'vitest';
import { extractTradeExecutionTime, parseTradeText } from './ocrParser';

describe('OCR execution-time extraction', () => {
  it('prefers the Telda trade-row time over the iPhone status-bar clock', () => {
    const text = `
15:15
Cash
Transactions
Today

Sell ACTF
3645 shares @ EGP 2.66
+EGP 9,689.86
01:42 pm

4 Oct 2026
`;

    expect(extractTradeExecutionTime(text, '2026-10-04')).toBe('2026-10-04T13:42:00');
    expect(parseTradeText(text, [])).toMatchObject({
      ticker: 'ACTF',
      type: 'SELL',
      shares: 3645,
      price: 2.66,
      date: '2026-10-04',
      executedAt: '2026-10-04T13:42:00',
    });
  });

  it('uses a contextual trade time even when both clocks are 24-hour values', () => {
    const text = `
09:58
Portfolio Cash
Buy ARCC
144 shares @ EGP 72.00
Execution time 10:18
4 Oct 2026
`;

    expect(extractTradeExecutionTime(text, '2026-10-04')).toBe('2026-10-04T10:18:00');
  });

  it('keeps AM/PM conversion correct for morning executions', () => {
    const text = `
15:16
Sell ARCC
88 shares @ EGP 72.20
10:16 am
4 Oct 2026
`;

    expect(extractTradeExecutionTime(text, '2026-10-04')).toBe('2026-10-04T10:16:00');
  });
});
