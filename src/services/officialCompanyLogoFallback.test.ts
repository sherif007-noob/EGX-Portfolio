import { describe, expect, it } from 'vitest';
import {
  buildEulerpoolDomainLogoUrl,
  extractOfficialDomainsByIsin,
  normalizeOfficialCompanyDomain,
} from './officialCompanyLogoFallback';

describe('official company logo fallback', () => {
  it('maps listed-company ISIN rows to corporate email domains', () => {
    const html = `
      <table>
        <tr><td>EGS59231C018</td><td>MNT Tech</td><td>ir@halan.com</td></tr>
        <tr><td>EGS220N1C016</td><td>EGYCO</td><td>info@egyco-egypt.com</td></tr>
      </table>
    `;
    const domains = extractOfficialDomainsByIsin(html);
    expect(domains.get('EGS59231C018')).toBe('halan.com');
    expect(domains.get('EGS220N1C016')).toBe('egyco-egypt.com');
  });

  it('rejects generic mailbox providers as company identity evidence', () => {
    expect(normalizeOfficialCompanyDomain('gmail.com')).toBe('');
    expect(normalizeOfficialCompanyDomain('WWW.DeltaIns.org/path')).toBe('deltains.org');
  });

  it('builds a zero-key Eulerpool domain-logo URL', () => {
    expect(buildEulerpoolDomainLogoUrl('halan.com'))
      .toBe('https://eulerpool.com/api/logo/halan.com');
  });

  it('does not cross from one flattened row into the next ISIN', () => {
    const html = `
      EGS59231C018 MNT Tech no-email-here
      EGS220N1C016 EGYCO info@egyco-egypt.com
    `;
    const domains = extractOfficialDomainsByIsin(html);
    expect(domains.has('EGS59231C018')).toBe(false);
    expect(domains.get('EGS220N1C016')).toBe('egyco-egypt.com');
  });
});
