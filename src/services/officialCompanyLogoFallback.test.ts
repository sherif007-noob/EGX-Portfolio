import { describe, expect, it } from 'vitest';
import {
  buildReplyNodesDomainLogoUrl,
  extractOfficialDomainsByIsin,
  extractOfficialSiteLogoCandidates,
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

  it('builds a zero-key ReplyNodes domain-logo URL', () => {
    expect(buildReplyNodesDomainLogoUrl('halan.com'))
      .toBe('https://img.replynodes.com/halan.com');
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

  it('extracts explicit organization logos and ranked site icons', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Organization","name":"Example","logo":{"url":"/assets/company-logo.png"}}
        </script>
        <link rel="icon" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch.png" />
      </head></html>
    `;
    expect(extractOfficialSiteLogoCandidates(html, 'https://example.com/about')).toEqual([
      'https://example.com/assets/company-logo.png',
      'https://example.com/apple-touch.png',
      'https://example.com/favicon-32.png',
      'https://example.com/favicon.ico',
    ]);
  });
});
