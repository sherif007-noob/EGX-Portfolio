export const OFFICIAL_DOMAIN_OVERRIDES_BY_ISIN: Readonly<Record<string, string>> = {
  // Verified company / regulator / holding-company domains for registry rows
  // whose published contact email is generic, stale, or absent.
  EGS3E2F1C011: 'acr.com.eg',
  EGS3A2Z1C015: 'elbadr.org',
  EGS42121C011: 'dchc.com.eg',
  EGS70311C013: 'egoth.com.eg',
  EGS42091C016: 'egywarehouse.com',
  EGS51LQ1C018: 'geosegypt.com',
  EGS751G1C012: 'hedgestone.com.eg',
  EGS67001C015: 'incolease.com',
  EGS632D1C010: 'misrlife.com',
  EGS651F1C014: 'maamoura.com.eg',
  EGS5ACC1C014: 'semadco.com',
  EGS70131C015: 'rowadtourism.com',
  EGS3C9X1C016: 'siegwarteg.com',
  EGS65021C015: 'tuc.com.eg',
};

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


function absoluteHttpUrl(value: string, baseUrl: string): string {
  const raw = decodeHtml(String(value || '').trim());
  if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:')) return '';
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function collectJsonLdLogos(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdLogos(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const typeValue = record['@type'];
  const types = Array.isArray(typeValue) ? typeValue.map(String) : [String(typeValue || '')];
  const isOrganization = types.some((type) =>
    /organization|corporation|company|financialservice|insuranceagency|educationalorganization/i.test(type),
  );

  if (isOrganization && record.logo) {
    const logo = record.logo;
    if (typeof logo === 'string') out.push(logo);
    else if (logo && typeof logo === 'object') {
      const logoRecord = logo as Record<string, unknown>;
      if (typeof logoRecord.url === 'string') out.push(logoRecord.url);
      if (typeof logoRecord.contentUrl === 'string') out.push(logoRecord.contentUrl);
    }
  }

  for (const nested of Object.values(record)) collectJsonLdLogos(nested, out);
}

export function extractOfficialSiteLogoCandidates(html: string, pageUrl: string): string[] {
  const source = String(html || '');
  const candidates: string[] = [];

  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      collectJsonLdLogos(parsed, candidates);
    } catch {
      // Ignore malformed third-party JSON-LD and continue to explicit icon metadata.
    }
  }

  const links = [...source.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const rankedLinks = links
    .map((tag) => {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
      const sizes = tag.match(/\bsizes=["']([^"']+)["']/i)?.[1] || '';
      const sizeScore = Math.max(
        0,
        ...[...sizes.matchAll(/(\d+)x(\d+)/gi)].map((size) => Number(size[1]) * Number(size[2])),
      );
      const relScore = /apple-touch-icon/i.test(rel) ? 3 : /\bicon\b/i.test(rel) ? 2 : 0;
      return { href, score: relScore * 1_000_000 + sizeScore };
    })
    .filter((entry) => entry.href && entry.score > 0)
    .sort((a, b) => b.score - a.score);

  candidates.push(...rankedLinks.map((entry) => entry.href));

  const ogLogo = source.match(/<meta\b[^>]*(?:property|name)=["'](?:og:logo|logo)["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? source.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:logo|logo)["'][^>]*>/i)?.[1];
  if (ogLogo) candidates.push(ogLogo);

  try {
    candidates.push(new URL('/favicon.ico', pageUrl).href);
  } catch {
    // Invalid base URL.
  }

  const unique: string[] = [];
  for (const candidate of candidates) {
    const absolute = absoluteHttpUrl(candidate, pageUrl);
    if (absolute && !unique.includes(absolute)) unique.push(absolute);
  }
  return unique;
}


export function applyOfficialDomainOverrides(
  discovered: Map<string, string>,
): Map<string, string> {
  const out = new Map(discovered);
  for (const [isin, domain] of Object.entries(OFFICIAL_DOMAIN_OVERRIDES_BY_ISIN)) {
    const normalized = normalizeOfficialCompanyDomain(domain);
    if (normalized) out.set(isin.toUpperCase(), normalized);
  }
  return out;
}


export function buildGoogleFaviconUrl(domain: string, size = 128): string {
  const clean = normalizeOfficialCompanyDomain(domain);
  const safeSize = Math.min(256, Math.max(32, Math.round(Number(size) || 128)));
  return clean
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${clean}`)}&sz=${safeSize}`
    : '';
}


export function buildFaviconImLogoUrl(domain: string): string {
  const clean = normalizeOfficialCompanyDomain(domain);
  return clean
    ? `https://a.favicon.im/${encodeURIComponent(clean)}?larger=true&throw-error-on-404=true`
    : '';
}
