/**
 * Session gain as a percentage of capital at the session's end, excluding the
 * gain itself. This matches the Home hero's portfolio-change denominator.
 * This is a broker-style daily percentage, NOT time-weighted return (TWR).
 *
 * Date-only deposits may be included in the denominator; TWR remains a
 * separately labelled performance metric.
 */
export function sessionChangePercent(changeEgp: number, endingNav: number): number | null {
  if (!Number.isFinite(changeEgp) || !Number.isFinite(endingNav)) return null;
  const referenceCapital = endingNav - changeEgp;
  return referenceCapital > 0 ? changeEgp / referenceCapital * 100 : null;
}
