import {describe,expect,it} from 'vitest';
import {egxSessionPresentation} from './egxSessionPresentation';

describe('last-session return presentation',()=>{
  it('keeps Oct 7 gain available on the Oct 8 holiday and weekend',()=>{
    for(const instant of ['2026-10-08T12:00:00Z','2026-10-10T00:02:00Z']){
      const session=egxSessionPresentation(new Date(instant));
      expect(session.sessionDate).toBe('2026-10-07');
      expect(session.isRegularTradingHours).toBe(false);
      expect(session.lastSessionCaption).toBe('Last session · 7 Oct');
    }
  });
  it('distinguishes trading hours from after close on the same session day',()=>{
    const open=egxSessionPresentation(new Date('2026-10-07T09:00:00Z')); // noon Cairo
    const closed=egxSessionPresentation(new Date('2026-10-07T15:00:00Z')); // evening Cairo
    expect(open.isRegularTradingHours).toBe(true);
    expect(closed.isRegularTradingHours).toBe(false);
    expect(closed.lastSessionCaption).toBe('Last session · 7 Oct');
  });
  it('never claims a weekend is an active trading session',()=>{
    const weekend=egxSessionPresentation(new Date('2026-10-09T10:00:00Z'));
    expect(weekend.isCurrentSessionDay).toBe(false);
    expect(weekend.isRegularTradingHours).toBe(false);
  });
});
