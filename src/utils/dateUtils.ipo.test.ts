import { describe,expect,it } from 'vitest';
import { parseUserCalendarDate, formatDateDDMMYYYY } from './dateUtils';

describe('strict IPO/accounting date entry',()=>{
  it('round trips the actual broker order date displayed in Egyptian format',()=>{
    expect(formatDateDDMMYYYY('2026-10-07')).toBe('07/10/2026');
    expect(parseUserCalendarDate('07/10/2026')).toBe('2026-10-07');
    expect(parseUserCalendarDate('2026-10-07')).toBe('2026-10-07');
    expect(parseUserCalendarDate('7/10/2026')).toBe('2026-10-07');
  });
  it.each(['', '07/10/202', 'not a date','2026-02-30','31/02/2026','10/31/2026','2026-13-07'])(
    'rejects incomplete or invalid dates instead of silently substituting today: %s',
    value=>expect(parseUserCalendarDate(value)).toBeNull(),
  );
});
