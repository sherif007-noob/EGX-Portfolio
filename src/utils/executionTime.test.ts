import { describe, expect, it } from 'vitest';
import {
  combineExecutionDateTime,
  executionDateInputValue,
  executionTimeInputValue,
  formatExecutionTime,
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
});
