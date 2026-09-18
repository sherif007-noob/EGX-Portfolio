import { describe, expect, it } from 'vitest';
import { getEGXSessionStatus } from './marketPriceSync';

describe('EGX market session status', () => {
  it('treats Sunday 09:30 Cairo as pre-market and 10:00 as active', () => {
    expect(getEGXSessionStatus(new Date('2026-09-13T06:30:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-13T07:00:00Z')).isSessionActive).toBe(true);
  });

  it('uses the regular 10:00-14:30 Cairo session Monday-Thursday', () => {
    expect(getEGXSessionStatus(new Date('2026-09-17T06:59:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-17T07:00:00Z')).isSessionActive).toBe(true);
    expect(getEGXSessionStatus(new Date('2026-09-17T11:30:00Z')).isSessionActive).toBe(true);
    expect(getEGXSessionStatus(new Date('2026-09-17T11:31:00Z')).isSessionActive).toBe(false);
  });

  it('does not report the separate 15:15 closing snapshot window as an active session', () => {
    expect(getEGXSessionStatus(new Date('2026-09-17T12:15:00Z')).isSessionActive).toBe(false);
  });

  it('keeps Friday and Saturday closed', () => {
    expect(getEGXSessionStatus(new Date('2026-09-18T07:00:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-19T07:00:00Z')).isSessionActive).toBe(false);
  });
});
