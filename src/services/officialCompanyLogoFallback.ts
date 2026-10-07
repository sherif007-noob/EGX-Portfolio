const ISIN_PATTERN = /\bEGS[0-9A-Z]{9}\b/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i;

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]);

function decodeHtml(value: string): string {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#64;|&commat;/gi, '@')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function normalizeOfficialCompanyDomain(value: string): string {
  const domain = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '');

  if (!domain || !domain.includes('.') || GENERIC_EMAIL_DOMAINS.has(domain)) return '';
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return '';
  return domain;
}

export function extractOfficialDomainsByIsin(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const decoded = decodeHtml(html);

  const rowMatches = decoded.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rowMatches) {
    const isin = row.match(ISIN_PATTERN)?.[0]?.toUpperCase();
    if (!isin) continue;
    const emailMatch = row.match(EMAIL_PATTERN);
    const domain = normalizeOfficialCompanyDomain(emailMatch?.[1] || '');
    if (domain) out.set(isin, domain);
  }

  // Some CMS renderers flatten table rows. Keep a bounded fallback that never
  // reaches past the next ISIN, so an email cannot leak from a neighboring company.
  const isinMatches = [...decoded.matchAll(ISIN_PATTERN)];
  for (let i = 0; i < isinMatches.length; i += 1) {
    const isin = isinMatches[i][0].toUpperCase();
    if (out.has(isin)) continue;
    const start = isinMatches[i].index ?? 0;
    const end = isinMatches[i + 1]?.index ?? Math.min(decoded.length, start + 2000);
    const window = decoded.slice(start, Math.min(end, start + 2000));
    const emailMatch = window.match(EMAIL_PATTERN);
    const domain = normalizeOfficialCompanyDomain(emailMatch?.[1] || '');
    if (domain) out.set(isin, domain);
  }

  return out;
}

export function buildReplyNodesDomainLogoUrl(domain: string): string {
  const clean = normalizeOfficialCompanyDomain(domain);
  return clean ? `https://img.replynodes.com/${encodeURIComponent(clean)}` : '';
}
