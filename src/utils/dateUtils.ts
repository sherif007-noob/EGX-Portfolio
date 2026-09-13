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
  const raw = String(dmyStr).trim();
  const clean = raw.split('T')[0];

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

  // Handle textual dates like "10 Sep 2026", "10 Sep 26", "10 September 2026"
  const textDateMatch = raw.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/);
  if (textDateMatch) {
    const day = String(parseInt(textDateMatch[1], 10)).padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIndex = monthNames.indexOf(textDateMatch[2].slice(0, 3).toLowerCase());
    const month = mIndex >= 0 ? String(mIndex + 1).padStart(2, '0') : '01';
    let year = parseInt(textDateMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return `${year}-${month}-${day}`;
  }

  // Fallback to standard JS Date parser
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    let year = parsed.getFullYear();
    if (year < 1970 && year > 1900) year += 100; // Correct 2-digit century rollover
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return getTodayISO();
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

/**
 * Extracts a normalized 'YYYY-MM' key from any date format (DD/MM/YYYY, YYYY-MM-DD, ISO, etc.)
 * Returns empty string if invalid or null.
 */
export function getMonthKey(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (!clean) return '';

  // 1. Check YYYY-MM or YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})(?:[\/\-\.]\d{1,2})?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    return `${year}-${month}`;
  }

  // 2. Check DD/MM/YYYY
  const dmyMatch = clean.match(/^(?:\d{1,2}[\/\-\.])?(\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const month = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    let year = parseInt(dmyMatch[2], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return `${year}-${month}`;
  }

  // 3. Fallback to dmyToIso
  const iso = dmyToIso(dateStr);
  if (iso && iso.length >= 7) {
    return iso.slice(0, 7);
  }

  return '';
}

/**
 * Returns formatted month label from 'YYYY-MM' (e.g. "Sep 2026" or "September 2026")
 */
export function getMonthLabel(monthKey: string, format: 'short' | 'long' = 'long'): string {
  if (!monthKey || typeof monthKey !== 'string') return monthKey || '—';
  const parts = monthKey.split(/[\/\-\.]/);
  if (parts.length < 2) return monthKey;

  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);

  // If order was MM-YYYY
  if (year < 100 && month > 1000) {
    const tmp = year;
    year = month;
    month = tmp;
  }

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return monthKey;
  }

  const monthNamesLong = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const mName = format === 'short' ? monthNamesShort[month - 1] : monthNamesLong[month - 1];
  return `${mName} ${year}`;
}

/**
 * Returns the ISO string of the last day of the given 'YYYY-MM' month (e.g. "2026-09-30")
 */
export function getLastDayOfMonth(monthKey: string): string {
  const parts = monthKey.split(/[\/\-\.]/);
  if (parts.length < 2) return `${monthKey}-28`;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return `${monthKey}-28`;

  const lastDate = new Date(year, month, 0);
  const day = String(lastDate.getDate()).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  return `${year}-${m}-${day}`;
}

/**
 * Checks if a date string falls inside the given 'YYYY-MM' month
 */
export function isDateInMonth(dateStr?: string | null, targetMonthKey?: string): boolean {
  if (!dateStr || !targetMonthKey) return false;
  const key = getMonthKey(dateStr);
  return key === targetMonthKey;
}

