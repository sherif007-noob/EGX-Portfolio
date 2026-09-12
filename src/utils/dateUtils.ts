/**
 * Date formatting and parsing utilities for EGX Portfolio tracker.
 * Egyptian Stock Exchange (EGX) and Egyptian brokers use Day/Month/Year (DD/MM/YYYY).
 */

/**
 * Returns today's date in YYYY-MM-DD (ISO) format.
 */
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in DD/MM/YYYY format.
 */
export function getTodayDDMMYYYY(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Converts any date string or ISO date (YYYY-MM-DD) into user-friendly Egyptian standard format (DD/MM/YYYY).
 * e.g. "2026-09-08" -> "08/09/2026"
 */
export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const clean = String(dateStr).trim().split('T')[0].split(' ')[0];

  // If already in YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // If in DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return clean;
}

/**
 * Converts a DD/MM/YYYY string to ISO (YYYY-MM-DD)
 */
export function dmyToIso(dmyStr?: string | null): string {
  if (!dmyStr) return getTodayISO();
  const clean = String(dmyStr).trim().split('T')[0].split(' ')[0];

  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return `${year}-${month}-${day}`;
  }

  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return clean;
}

/**
 * Converts ISO YYYY-MM-DD or any string to DD/MM/YYYY string
 */
export function isoToDmy(isoStr?: string | null): string {
  return formatDateDDMMYYYY(isoStr);
}

/**
 * Formats a date into a verbose, completely unambiguous Egyptian date string.
 * e.g. "2026-09-08" -> "08 Sep 2026 (08/09/2026)" or "08 Sep 2026"
 */
export function formatDateVerbose(dateStr?: string | null, includeNumeric = false): string {
  if (!dateStr) return '—';
  const clean = String(dateStr).trim().split('T')[0].split(' ')[0];

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const mIdx = parseInt(ymdMatch[2], 10) - 1;
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    const monthName = monthNames[mIdx] || ymdMatch[2];
    const monthNum = String(mIdx + 1).padStart(2, '0');
    if (includeNumeric) {
      return `${day} ${monthName} ${year} (${day}/${monthNum}/${year})`;
    }
    return `${day} ${monthName} ${year}`;
  }

  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const mIdx = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    const monthName = monthNames[mIdx] || dmyMatch[2];
    const monthNum = String(mIdx + 1).padStart(2, '0');
    if (includeNumeric) {
      return `${day} ${monthName} ${year} (${day}/${monthNum}/${year})`;
    }
    return `${day} ${monthName} ${year}`;
  }

  return clean;
}
