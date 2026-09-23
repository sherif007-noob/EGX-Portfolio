import { describe, expect, it } from 'vitest';
import {
  combineExecutionDateTime,
  executionDateInputValue,
  executionTimeInputValue,
  formatExecutionTime,
  cairoExecutionInputValues,
  isCairoCurrentDate,
} from './executionTime';

describe('execution timestamp helpers', () => {
  it('round-trips a local execution date and time', () => {
    const executedAt = combineExecutionDateTime('2026-09-17', '13:27');
    expect(executedAt).toBeTruthy();
    expect(executionDateInputValue(executedAt, '')).toBe('2026-09-17');
    expect(executionTimeInputValue(executedAt)).toBe('13:27');
  });

  it('keeps timestamps optional when no time was recorded', () => {
    expect(combineExecutionDateTime('2026-09-17', '')).toBeUndefined();
    expect(executionTimeInputValue(undefined)).toBe('');
    expect(formatExecutionTime(undefined)).toBeNull();
  });

  it('formats a stored execution time for the journal', () => {
    const executedAt = combineExecutionDateTime('2026-09-17', '10:15');
    expect(formatExecutionTime(executedAt)).toMatch(/10:15/);
  });

  it('resolves the current trade date and time in Cairo', () => {
    const now = new Date('2026-01-01T22:30:00.000Z');
    expect(cairoExecutionInputValues(now)).toEqual({ date: '2026-01-02', time: '00:30' });
    expect(isCairoCurrentDate('2026-01-02', now)).toBe(true);
    expect(isCairoCurrentDate('2026-01-01', now)).toBe(false);
  });
});
