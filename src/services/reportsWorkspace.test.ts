// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_REPORTS_MODE,
  REPORTS_LAST_MODE_STORAGE_KEY,
  REPORT_MODES,
  parseReportsMode,
  persistReportsMode,
  readPersistedReportsMode,
} from './reportsWorkspace';

describe('Reports workspace mode persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defines the five Stage 5 report workspaces in canonical order', () => {
    expect(REPORT_MODES).toEqual([
      'overview',
      'analytics',
      'trading',
      'allocation',
      'monthly',
    ]);
  });

  it('falls back safely to Overview for missing or stale persisted values', () => {
    expect(DEFAULT_REPORTS_MODE).toBe('overview');
    expect(parseReportsMode(null)).toBe('overview');
    expect(parseReportsMode('legacy-report')).toBe('overview');
    expect(readPersistedReportsMode()).toBe('overview');

    window.localStorage.setItem(REPORTS_LAST_MODE_STORAGE_KEY, 'stale-mode');
    expect(readPersistedReportsMode()).toBe('overview');
  });

  it('restores and persists a valid report mode', () => {
    window.localStorage.setItem(REPORTS_LAST_MODE_STORAGE_KEY, 'allocation');
    expect(readPersistedReportsMode()).toBe('allocation');

    persistReportsMode('monthly');
    expect(window.localStorage.getItem(REPORTS_LAST_MODE_STORAGE_KEY)).toBe('monthly');
  });
});
