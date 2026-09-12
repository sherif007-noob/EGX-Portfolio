import { Position, ClosedTrade, Sector, TradeTransaction, EGXTicker } from '../types';
import { EGX_STOCK_DICTIONARY } from '../data/egxTickers';

export const TRANSACTION_LOGGER_HEADERS = [
  'Trade ID',
  'Date',
  'Action',
  'Ticker',
  'Company Name',
  'Shares',
  'Price / Share',
  'Gross Trade Value',
  'Brokerage Fee',
  'Net Cash Impact',
  'Strategy / Notes',
  'Running Shares',
  'Trade Cycle',
  'Cycle Tag'
];

export const TICKER_DIRECTORY_HEADERS = [
  'Ticker',
  'Company Name',
  'Sector',
  'Current Price (EGP)'
];

/**
 * Converts zero-based column index to A1 notation column letter (e.g. 0 -> 'A', 13 -> 'N', 25 -> 'Z').
 */
export function colToLetter(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

/**
 * Finds column index matching standard header name or synonyms.
 */
export function findColIndexBySynonyms(headers: string[], standardHeaderName: string): number {
  const normHeaders = headers.map(h => (h || '').toString().toLowerCase().trim());

  const synonymsMap: Record<string, string[]> = {
    'Trade ID': ['trade id', 'trade #', 'trade_id', 'id', 'tradeid', 'رقم العملية', 'رقم الصفقة'],
    'Date': ['date', 'buy date', 'trade date', 'timestamp', 'تاريخ', 'تاريخ العملية'],
    'Action': ['action', 'type', 'side', 'operation', 'transaction type', 'نوع العملية', 'النوع', 'العملية'],
    'Ticker': ['ticker', 'symbol', 'code', 'stock', 'سهم', 'الرمز', 'كود', 'السهم', 'كود السهم', 'رمز السهم', 'اسم السهم'],
    'Company Name': ['company name', 'company', 'name', 'english name', 'security', 'description', 'اسم الشركة', 'الشركة', 'بيان'],
    'Shares': ['shares', 'qty', 'quantity', 'volume', 'units', 'no of shares', 'الكمية', 'عدد الأسهم', 'العدد', 'كمية'],
    'Price / Share': ['price / share', 'price/share', 'price', 'buy price', 'avg price', 'purchase price', 'cost', 'avg cost', 'cost/share', 'entry price', 'سعر السهم', 'سعر الشراء', 'متوسط التكلفة', 'التكلفة', 'السعر'],
    'Gross Trade Value': ['gross trade value', 'gross value', 'gross', 'gross amount', 'قيمة التداول', 'إجمالي القيمة'],
    'Brokerage Fee': ['brokerage fee', 'fee', 'fees', 'commission', 'commissions', 'عمولة', 'مصاريف', 'العمولة', 'مصاريف البورصة'],
    'Net Cash Impact': ['net cash impact', 'net cash', 'net impact', 'cash impact', 'صافي النقد', 'الصافي'],
    'Strategy / Notes': ['strategy / notes', 'strategy/notes', 'strategy', 'notes', 'comment', 'comments', 'remarks', 'ملاحظات', 'استراتيجية'],
    'Running Shares': ['running shares', 'remaining shares', 'balance shares', 'الأسهم المتبقية', 'المتبقي', 'رصيد الأسهم'],
    'Trade Cycle': ['trade cycle', 'cycle', 'دورة التداول', 'الدورة', 'cycle #'],
    'Cycle Tag': ['cycle tag', 'tag', 'رمز الدورة', 'cycle_tag'],
    'Sector': ['sector', 'industry', 'القطاع', 'قطاع'],
    'Current Price (EGP)': ['current price (egp)', 'current price', 'last price (egp)', 'last price', 'market price', 'cmp', 'close', 'سعر السوق', 'السعر الحالي']
  };

  const synonyms = synonymsMap[standardHeaderName] || [standardHeaderName.toLowerCase()];

  // 1. Exact match
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (synonyms.some(s => h === s)) return i;
  }

  // 2. Contains match
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];
    if (!h) continue;
    if (synonyms.some(s => h.includes(s) || s.includes(h))) return i;
  }

  return -1;
}

/**
 * Enriches transactions with calculated running shares, trade cycles, gross trade value, and net cash impact.
 */
export function enrichTransactionsForLedger(transactions: TradeTransaction[]): TradeTransaction[] {
  // Sort chronologically ascending (oldest first: Date -> TradeId -> BUY before SELL)
  const sorted = [...transactions].sort((a, b) => {
    const dA = new Date(a.date || 0).getTime();
    const dB = new Date(b.date || 0).getTime();
    if (dA !== dB) return dA - dB;
    const tA = Number(a.tradeId) || 0;
    const tB = Number(b.tradeId) || 0;
    if (tA && tB && tA !== tB) return tA - tB;
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return 0;
  });

  const runningSharesMap: Record<string, number> = {};
  const activeCycleMap: Record<string, number> = {};

  return sorted.map((tx, idx) => {
    const ticker = tx.ticker.toUpperCase();
    const tradeId = tx.tradeId !== undefined ? tx.tradeId : (tx.trade_id !== undefined ? tx.trade_id : (idx + 1));
    const gross = Math.round(tx.shares * tx.price * 100) / 100;
    const fees = Math.round((tx.fees || 0) * 100) / 100;
    // Net Cash Impact: negative for BUY, positive for SELL
    const netCash = tx.type === 'BUY' ? -(gross + fees) : (gross - fees);

    const prevShares = runningSharesMap[ticker] || 0;
    let newShares = prevShares;
    let cycle = activeCycleMap[ticker] || 1;

    if (tx.type === 'BUY') {
      if (prevShares === 0) {
        cycle = (activeCycleMap[ticker] || 0) + 1;
        activeCycleMap[ticker] = cycle;
      }
      newShares = prevShares + tx.shares;
    } else if (tx.type === 'SELL') {
      newShares = Math.max(0, prevShares - tx.shares);
    }

    runningSharesMap[ticker] = newShares;

    const cycleTag = tx.cycleTag || `${ticker}-C${cycle}`;

    return {
      ...tx,
      tradeId,
      grossTradeValue: gross,
      netCashImpact: Math.round(netCash * 100) / 100,
      runningShares: newShares,
      tradeCycle: tx.tradeCycle || cycle,
      cycleTag
    };
  });
}

export interface SheetParseResult {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  rawRowsCount: number;
  sheetTitle: string;
  detectedColumns: string[];
  sheetType?: 'transaction_logger' | 'ticker_directory' | 'generic';
  tickerQuotes?: Record<string, number>;
}

export interface GoogleDriveSpreadsheet {
  id: string;
  name: string;
  modifiedTime?: string;
}

/**
 * Lists user's spreadsheets from Google Drive using Drive API v3.
 */
export async function fetchUserSpreadsheets(accessToken: string): Promise<GoogleDriveSpreadsheet[]> {
  try {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=30&fields=files(id,name,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new GoogleSheetsAuthError(`Google Drive access unauthorized (HTTP ${res.status}). Please reconnect.`);
      }
      const errorText = await res.text().catch(() => '');
      throw new Error(`Failed to list Google Drive files (HTTP ${res.status}): ${errorText || res.statusText}`);
    }
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Could not list drive spreadsheets:', err);
    throw err;
  }
}

/**
 * Extracts spreadsheet ID and optional GID from any Google Sheets URL or raw ID string.
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function extractGid(url: string): string | null {
  const match = url.match(/[#&?]gid=([0-9]+)/);
  return match && match[1] ? match[1] : null;
}

export class GoogleSheetsAuthError extends Error {
  isAuthError = true;
  constructor(message = 'Google Sheets authentication expired or invalid') {
    super(message);
    this.name = 'GoogleSheetsAuthError';
  }
}

export class GoogleSheetsRateLimitError extends Error {
  isRateLimitError = true;
  constructor(message = 'Google Sheets API rate limit exceeded (HTTP 429)') {
    super(message);
    this.name = 'GoogleSheetsRateLimitError';
  }
}

async function fetchWithSheetsRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        throw new GoogleSheetsAuthError(`Google Sheets Auth Error (HTTP ${res.status}): Session expired`);
      }
      if (res.status === 429) {
        throw new GoogleSheetsRateLimitError(`Google Sheets Rate Limit (HTTP 429)`);
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (err instanceof GoogleSheetsAuthError || err instanceof GoogleSheetsRateLimitError) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Fetches Google Sheet metadata (title, sheet tabs) via Sheets API v4.
 */
export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheets: string[] }> {
  const res = await fetchWithSheetsRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch sheet metadata (HTTP ${res.status})`);
  }

  const data = await res.json();
  const title = data.properties?.title || 'EGX Portfolio Spreadsheet';
  const sheets = (data.sheets || []).map((s: any) => s.properties?.title || 'Sheet1');
  return { title, sheets };
}

/**
 * Fetches values from a specific range via Sheets API v4.
 */
export async function fetchSheetValues(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<string[][]> {
  const encodedRange = encodeURIComponent(range);
  const res = await fetchWithSheetsRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch sheet values (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.values || [];
}


/**
 * Normalizes numbers from raw spreadsheet strings, handling Arabic numerals, currency, commas, accounting parentheses, and percentage signs.
 */
export function parseSheetNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  // Convert Eastern Arabic / Persian numerals to ASCII
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let str = String(val).trim();
  for (let i = 0; i < 10; i++) {
    str = str.split(arabicNumerals[i]).join(String(i));
  }

  // Check if enclosed in accounting parentheses (e.g. (EGP 9,205.60)) -> negative
  let isNegative = false;
  if (/^\(.*\)$/.test(str.trim())) {
    isNegative = true;
    str = str.replace(/^\(/, '').replace(/\)$/, '');
  }

  // Remove currency, spaces, commas, percent
  const clean = str
    .replace(/,/g, '')
    .replace(/EGP/gi, '')
    .replace(/LE/gi, '')
    .replace(/ج\.م/gi, '')
    .replace(/جنية/gi, '')
    .replace(/جنيه/gi, '')
    .replace(/\$/g, '')
    .replace(/%/g, '')
    .trim();

  let num = parseFloat(clean);
  if (isNaN(num)) return fallback;
  return isNegative ? -Math.abs(num) : num;
}

/**
 * Parses date string into standard ISO YYYY-MM-DD format.
 * Strict priority for Egyptian / UK format: DD/MM/YYYY.
 * Handles Excel serial dates, Eastern Arabic numerals, 2-digit years, and timestamps.
 * e.g. "08/09/2026" or "8/9/2026" -> "2026-09-08" (8 September 2026)
 */
export function parseSheetDate(raw: any): string {
  if (raw === undefined || raw === null || raw === '') {
    return new Date().toISOString().split('T')[0];
  }

  // 1. If it's a numeric Excel serial date (e.g. ~46273 for Sep 2026)
  if (
    typeof raw === 'number' ||
    (!isNaN(Number(raw)) && !String(raw).includes('-') && !String(raw).includes('/') && !String(raw).includes('.'))
  ) {
    const serial = Number(raw);
    if (serial > 30000 && serial < 70000) {
      // Excel epoch begins Dec 30, 1899 (25569 days to Unix epoch)
      const utcDays = Math.floor(serial - 25569);
      const dateObj = new Date(utcDays * 86400 * 1000);
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Convert Eastern Arabic / Persian numerals to standard digits
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let str = String(raw).trim();
  for (let i = 0; i < 10; i++) {
    str = str.split(arabicNumerals[i]).join(String(i));
  }

  // Strip timestamps or trailing times (e.g. "08/09/2026 14:30:00" or "08/09/2026T00:00:00")
  str = str.split('T')[0].split(' ')[0].trim();

  // 2. Check ISO format first: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Priority: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (Egyptian Stock Market standard)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let yearNum = parseInt(dmyMatch[3], 10);

    if (yearNum < 100) {
      yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    }

    // Safety check: if month is > 12 and day <= 12, it must be MM/DD/YYYY by logical necessity
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    const yearStr = String(yearNum);
    const monthStr = String(Math.min(12, Math.max(1, month))).padStart(2, '0');
    const dayStr = String(Math.min(31, Math.max(1, day))).padStart(2, '0');
    return `${yearStr}-${monthStr}-${dayStr}`;
  }

  // 4. Textual month names (e.g. "8 Sep 2026", "8 September 2026", "08-Sep-2026", "8 سبتمبر 2026")
  const monthsMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4,
    مايو: 5, يونيو: 6, يوليو: 7, أغسطس: 8, اغسطس: 8,
    سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  };

  const dayTextMatch = str.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z\u0600-\u06FF]+)[\s\-\/\.](\d{2,4})$/);
  if (dayTextMatch) {
    const day = parseInt(dayTextMatch[1], 10);
    const monthKey = dayTextMatch[2].toLowerCase();
    let yearNum = parseInt(dayTextMatch[3], 10);
    if (yearNum < 100) yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    const m = monthsMap[monthKey];
    if (m) {
      return `${yearNum}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const monthFirstText = str.match(/^([A-Za-z\u0600-\u06FF]+)[\s\-\/\.](\d{1,2}),?[\s\-\/\.](\d{2,4})$/);
  if (monthFirstText) {
    const monthKey = monthFirstText[1].toLowerCase();
    const day = parseInt(monthFirstText[2], 10);
    let yearNum = parseInt(monthFirstText[3], 10);
    if (yearNum < 100) yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    const m = monthsMap[monthKey];
    if (m) {
      return `${yearNum}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Fallback to Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Scans rows to find the most probable header row within the first 15 rows.
 */
export function findHeaderRowIndex(rows: string[][]): number {
  if (!rows || rows.length === 0) return 0;

  const headerKeywords = [
    'trade id', 'trade', 'trade #', 'رقم العملية', 'رقم الصفقة',
    'ticker', 'symbol', 'code', 'stock', 'سهم', 'الرمز', 'كود', 'السهم', 'كود السهم', 'رمز السهم', 'اسم السهم',
    'action', 'type', 'side', 'operation', 'نوع العملية', 'النوع', 'نوع', 'العملية',
    'shares', 'qty', 'quantity', 'volume', 'units', 'الكمية', 'عدد الأسهم', 'العدد',
    'price / share', 'price/share', 'price', 'buy price', 'avg price', 'purchase price', 'cost', 'avg cost', 'cost/share', 'entry price', 'سعر الشراء', 'سعر السهم', 'متوسط التكلفة', 'التكلفة', 'سعر',
    'company name', 'company', 'name', 'security', 'اسم الشركة', 'الشركة',
    'current price (egp)', 'current price', 'market price', 'cmp', 'سعر السوق', 'السعر الحالي',
    'gross trade value', 'gross', 'قيمة التداول', 'إجمالي القيمة',
    'brokerage fee', 'fee', 'fees', 'commission', 'العمولة', 'عمولة', 'مصاريف',
    'net cash impact', 'net cash', 'صافي النقد',
    'strategy / notes', 'strategy', 'notes', 'ملاحظات', 'استراتيجية',
    'running shares', 'الأسهم المتبقية', 'المتبقي',
    'trade cycle', 'cycle', 'دورة التداول', 'الدورة',
    'cycle tag', 'tag', 'رمز الدورة',
    'date', 'buy date', 'trade date', 'timestamp', 'تاريخ', 'تاريخ العملية'
  ];

  let bestIdx = 0;
  let maxScore = -1;

  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let score = 0;
    const rowStr = row.map(c => String(c || '').toLowerCase().trim());

    for (const cell of rowStr) {
      if (!cell) continue;
      for (const kw of headerKeywords) {
        if (cell === kw || cell.includes(kw) || kw.includes(cell)) {
          score += 2;
          break;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  return maxScore >= 2 ? bestIdx : 0;
}

/**
 * Reconstructs accurate Active Positions and Closed Trades from a raw transaction ledger (e.g. from Transaction logger tab).
 * Uses chronological lot matching to compute accurate DCA average buy costs and realized P&L.
 * Consolidates closed cycles (15 cycles) and calculates open positions (3 active holdings).
 */
export function reconstructPortfolioFromTransactions(
  transactions: TradeTransaction[],
  livePrices: Record<string, number> = {}
): { positions: Position[]; closedTrades: ClosedTrade[]; transactions: TradeTransaction[] } {
  // Sort transactions chronologically (oldest to newest: Date -> TradeId -> BUY before SELL)
  const sortedTx = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date || '').getTime() || 0;
    const dateB = new Date(b.date || '').getTime() || 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    const tradeIdA = typeof a.tradeId === 'number' ? a.tradeId : parseFloat(String(a.tradeId || '')) || 0;
    const tradeIdB = typeof b.tradeId === 'number' ? b.tradeId : parseFloat(String(b.tradeId || '')) || 0;
    if (tradeIdA && tradeIdB && tradeIdA !== tradeIdB) {
      return tradeIdA - tradeIdB;
    }
    // Critical lot integrity: BUY must always precede SELL when dates are identical
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return 0;
  });

  interface OpenLot {
    shares: number;
    price: number;
    date: string;
    fees: number;
    notes?: string;
    targetPrice?: number;
    stopLoss?: number;
    tradeCycle?: number;
    cycleTag?: string;
  }

  const openLotsByTicker: Record<string, OpenLot[]> = {};
  
  interface ClosedCycleAccumulator {
    id: string;
    ticker: string;
    companyName: string;
    sector: Sector;
    shares: number;
    totalCostBasis: number;
    totalGrossProceeds: number;
    buyFees: number;
    sellFees: number;
    firstBuyDate: string;
    lastSellDate: string;
    notes?: string;
    tradeCycle?: number;
    cycleTag?: string;
  }

  const closedCyclesMap: Record<string, ClosedCycleAccumulator> = {};

  for (let idx = 0; idx < sortedTx.length; idx++) {
    const tx = sortedTx[idx];
    const ticker = tx.ticker.toUpperCase();

    if (!openLotsByTicker[ticker]) {
      openLotsByTicker[ticker] = [];
    }

    if (tx.type === 'BUY') {
      const isDcaLot = openLotsByTicker[ticker].length > 0;
      tx.isDCA = isDcaLot;
      tx.outcome = undefined;

      openLotsByTicker[ticker].push({
        shares: tx.shares,
        price: tx.price,
        date: tx.date,
        fees: tx.fees || 0,
        notes: tx.notes,
        targetPrice: tx.targetPrice,
        stopLoss: tx.stopLoss,
        tradeCycle: tx.tradeCycle,
        cycleTag: tx.cycleTag
      });
    } else if (tx.type === 'SELL') {
      let sharesToSell = tx.shares;
      let totalCostBasis = 0;
      let totalAllocatedBuyFees = 0;
      let firstBuyDate = tx.date;
      let cycleTag = tx.cycleTag;
      let tradeCycle = tx.tradeCycle;

      const lots = openLotsByTicker[ticker];
      while (sharesToSell > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.date && (!firstBuyDate || firstBuyDate === tx.date)) {
          firstBuyDate = lot.date;
        }
        if (lot.cycleTag && !cycleTag) {
          cycleTag = lot.cycleTag;
        }
        if (lot.tradeCycle && !tradeCycle) {
          tradeCycle = lot.tradeCycle;
        }

        if (lot.shares <= sharesToSell) {
          totalCostBasis += lot.shares * lot.price;
          totalAllocatedBuyFees += lot.fees;
          sharesToSell -= lot.shares;
          lots.shift(); // fully consumed lot
        } else {
          // Partially consumed lot
          const feePortion = (sharesToSell / lot.shares) * lot.fees;
          totalCostBasis += sharesToSell * lot.price;
          totalAllocatedBuyFees += feePortion;
          lot.shares -= sharesToSell;
          lot.fees = Math.max(0, lot.fees - feePortion);
          sharesToSell = 0;
        }
      }

      // If sell shares exceed recorded buy lots (e.g. historical short or missing earlier buy rows), fallback cost
      if (sharesToSell > 0) {
        const estimatedUnitCost = tx.price; // fallback to avoid artificial 100% gain
        totalCostBasis += sharesToSell * estimatedUnitCost;
      }

      const grossProceeds = tx.shares * tx.price;
      const sellFees = tx.fees || 0;
      const netProceeds = grossProceeds - sellFees;
      const netOutlay = totalCostBasis + totalAllocatedBuyFees;
      const txRealizedPnlEgp = netProceeds - netOutlay;
      const txRealizedPnlPercent = netOutlay > 0 ? (txRealizedPnlEgp / netOutlay) * 100 : 0;
      const txOutcome: 'WIN' | 'LOSS' | 'BREAKEVEN' =
        txRealizedPnlEgp > 0.01 ? 'WIN' : txRealizedPnlEgp < -0.01 ? 'LOSS' : 'BREAKEVEN';

      const buyTime = new Date(firstBuyDate).getTime();
      const sellTime = new Date(tx.date).getTime();
      const diffDays = Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24));
      const holdingDays = Math.max(1, isNaN(diffDays) ? 7 : diffDays);

      // Populate transaction with calculated financial outcome
      tx.realizedPnlEgp = Math.round(txRealizedPnlEgp * 100) / 100;
      tx.realizedPnlPercent = Math.round(txRealizedPnlPercent * 100) / 100;
      tx.outcome = txOutcome;
      tx.holdingDays = holdingDays;
      tx.totalAmount = netProceeds;

      const cycleKey = cycleTag || `${ticker}-C${tradeCycle || idx}`;

      if (closedCyclesMap[cycleKey]) {
        // Aggregate into existing cycle (e.g. TAQA-C1 with multiple partial sell orders)
        const c = closedCyclesMap[cycleKey];
        c.shares += tx.shares;
        c.totalCostBasis += totalCostBasis;
        c.totalGrossProceeds += grossProceeds;
        c.buyFees += totalAllocatedBuyFees;
        c.sellFees += sellFees;
        c.lastSellDate = tx.date;
      } else {
        closedCyclesMap[cycleKey] = {
          id: `ct-${cycleKey}`,
          ticker,
          companyName: tx.companyName,
          sector: tx.sector,
          shares: tx.shares,
          totalCostBasis,
          totalGrossProceeds: grossProceeds,
          buyFees: totalAllocatedBuyFees,
          sellFees,
          firstBuyDate,
          lastSellDate: tx.date,
          notes: tx.notes,
          tradeCycle,
          cycleTag: cycleKey
        };
      }
    }
  }

  // Convert closedCyclesMap to closedTrades
  const closedTrades: ClosedTrade[] = Object.values(closedCyclesMap).map((c) => {
    const totalFees = c.buyFees + c.sellFees;
    const avgBuyPrice = c.shares > 0 ? c.totalCostBasis / c.shares : 0;
    const avgSellPrice = c.shares > 0 ? c.totalGrossProceeds / c.shares : 0;
    const netProceeds = c.totalGrossProceeds - c.sellFees;
    const netOutlay = c.totalCostBasis + c.buyFees;
    const realizedPnlEgp = netProceeds - netOutlay;
    const realizedPnlPercent = netOutlay > 0 ? (realizedPnlEgp / netOutlay) * 100 : 0;
    const outcome = realizedPnlEgp > 0 ? 'WIN' : realizedPnlEgp < 0 ? 'LOSS' : 'BREAKEVEN';

    const buyTime = new Date(c.firstBuyDate).getTime();
    const sellTime = new Date(c.lastSellDate).getTime();
    const diffDays = Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24));
    const holdingDays = Math.max(1, isNaN(diffDays) ? 14 : diffDays);

    return {
      id: c.id,
      ticker: c.ticker,
      companyName: c.companyName,
      sector: c.sector,
      shares: c.shares,
      buyPrice: Math.round(avgBuyPrice * 100) / 100,
      sellPrice: Math.round(avgSellPrice * 100) / 100,
      buyDate: c.firstBuyDate,
      sellDate: c.lastSellDate,
      holdingDays,
      buyFees: Math.round(c.buyFees * 100) / 100,
      sellFees: Math.round(c.sellFees * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      realizedPnlEgp: Math.round(realizedPnlEgp * 100) / 100,
      realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
      outcome,
      tradeType: 'Swing',
      tradeCycle: c.tradeCycle,
      cycleTag: c.cycleTag,
      notes: c.notes
    };
  });

  // Generate active positions from remaining open lots
  const positions: Position[] = [];

  for (const [ticker, lots] of Object.entries(openLotsByTicker)) {
    const remainingLots = lots.filter(l => l.shares > 0);
    if (remainingLots.length === 0) continue;

    const totalShares = remainingLots.reduce((acc, l) => acc + l.shares, 0);
    const totalCost = remainingLots.reduce((acc, l) => acc + (l.shares * l.price), 0);
    const totalUnallocatedFees = remainingLots.reduce((acc, l) => acc + l.fees, 0);
    const avgBuyPrice = totalShares > 0 ? totalCost / totalShares : remainingLots[0].price;

    const firstLot = remainingLots[0];
    const lastLot = remainingLots[remainingLots.length - 1];
    const dict = EGX_STOCK_DICTIONARY[ticker];
    const companyName = dict?.nameEn || `${ticker} Corp`;
    const sector = dict?.sector || 'Other';
    const currentPrice = livePrices[ticker] || avgBuyPrice;

    positions.push({
      id: `pos-${ticker}-${Date.now()}`,
      ticker,
      companyName,
      sector,
      shares: totalShares,
      avgBuyPrice: Math.round(avgBuyPrice * 100) / 100,
      currentPrice,
      buyDate: firstLot.date,
      totalFees: Math.round(totalUnallocatedFees * 100) / 100,
      targetPrice: lastLot.targetPrice,
      stopLoss: lastLot.stopLoss,
      notes: remainingLots.length > 1 ? `Consolidated ${remainingLots.length} DCA tranches` : firstLot.notes
    });
  }

  return { positions, closedTrades, transactions: sortedTx };
}

/**
 * Intelligent parser that can parse:
 * 1. Transaction Logger sheets (source of truth with BUY/SELL history)
 * 2. Ticker Directory sheets (reference with tickers & current prices)
 * 3. Disregards redundant Portfolio overview sheets in favor of true transaction reconciliation
 */
export function parseSheetRows(
  rows: string[][],
  tabNameHint?: string,
  livePrices: Record<string, number> = {}
): SheetParseResult {
  if (!rows || rows.length < 2) {
    return {
      positions: [],
      closedTrades: [],
      transactions: [],
      rawRowsCount: 0,
      sheetTitle: tabNameHint || 'Empty Sheet',
      detectedColumns: []
    };
  }

  const headerRowIdx = findHeaderRowIndex(rows);
  const rawHeaders = rows[headerRowIdx] || [];
  const headers = rawHeaders.map(h => (h || '').toString().trim().toLowerCase());

  // Find column indices with extensive synonyms
  const getCol = (possibleNames: string[]) => {
    return headers.findIndex(h => possibleNames.some(name => h === name.toLowerCase() || h.includes(name.toLowerCase())));
  };

  const tradeIdIdx = getCol(['trade id', 'trade #', 'trade', 'id', 'رقم العملية', 'رقم الصفقة']);
  const dateIdx = getCol(['date', 'buy date', 'trade date', 'timestamp', 'تاريخ', 'تاريخ العملية']);
  const actionIdx = getCol(['action', 'type', 'side', 'operation', 'transaction type', 'نوع العملية', 'النوع', 'العملية']);
  const tickerIdx = getCol(['ticker', 'symbol', 'code', 'stock', 'سهم', 'الرمز', 'كود', 'السهم', 'كود السهم', 'رمز السهم', 'اسم السهم']);
  const companyIdx = getCol(['company name', 'company', 'name', 'security', 'description', 'اسم الشركة', 'الشركة', 'بيان']);
  const sectorIdx = getCol(['sector', 'industry', 'القطاع', 'قطاع']);
  const sharesIdx = getCol(['shares', 'qty', 'quantity', 'volume', 'units', 'no of shares', 'الكمية', 'عدد الأسهم', 'العدد', 'كمية']);
  const priceIdx = getCol(['price / share', 'price/share', 'price', 'buy price', 'avg price', 'purchase price', 'cost', 'avg cost', 'cost/share', 'entry price', 'سعر السهم', 'سعر الشراء', 'متوسط التكلفة', 'التكلفة', 'السعر']);
  const currentPriceIdx = getCol(['current price (egp)', 'current price', 'market price', 'cmp', 'last price', 'last', 'close', 'سعر السوق', 'السعر الحالي', 'سعر الإغلاق', 'سعر اليوم']);
  const grossIdx = getCol(['gross trade value', 'gross value', 'gross', 'قيمة التداول', 'إجمالي القيمة']);
  const feesIdx = getCol(['brokerage fee', 'fee', 'fees', 'commission', 'commissions', 'عمولة', 'مصاريف', 'العمولة']);
  const netCashIdx = getCol(['net cash impact', 'net cash', 'net impact', 'صافي النقد']);
  const notesIdx = getCol(['strategy / notes', 'strategy/notes', 'strategy', 'notes', 'comment', 'comments', 'remarks', 'ملاحظات', 'استراتيجية']);
  const runningSharesIdx = getCol(['running shares', 'remaining shares', 'balance shares', 'الأسهم المتبقية', 'المتبقي']);
  const tradeCycleIdx = getCol(['trade cycle', 'cycle', 'دورة التداول', 'الدورة']);
  const cycleTagIdx = getCol(['cycle tag', 'tag', 'رمز الدورة']);
  const targetIdx = getCol(['target', 'tp', 'target price', 'take profit', 'هدف', 'الهدف', 'سعر الهدف']);
  const stopLossIdx = getCol(['stop', 'sl', 'stop loss', 'وقف', 'وقف الخسارة', 'وقف خسارة']);

  const detectedColumns = rawHeaders.filter(h => h && h.trim().length > 0);

  // 1. Check if this is the Ticker Directory sheet
  const isExplicitTickerTab = (tabNameHint || '').toLowerCase().includes('ticker');
  const hasOnlyDirectoryColumns = tickerIdx !== -1 && (currentPriceIdx !== -1 || priceIdx !== -1) && actionIdx === -1 && sharesIdx === -1 && tradeIdIdx === -1;

  if (isExplicitTickerTab || hasOnlyDirectoryColumns) {
    const tickerQuotes: Record<string, number> = {};
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const rawTicker = (tickerIdx !== -1 ? row[tickerIdx] : row[0]) || '';
      const cleanTicker = String(rawTicker).replace('.CA', '').replace(/^EGX:/, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (!cleanTicker) continue;

      const pCol = currentPriceIdx !== -1 ? currentPriceIdx : priceIdx;
      const priceVal = pCol !== -1 ? parseSheetNumber(row[pCol], 0) : 0;
      if (priceVal > 0) {
        tickerQuotes[cleanTicker] = priceVal;
      }
    }

    return {
      positions: [],
      closedTrades: [],
      transactions: [],
      rawRowsCount: rows.length - (headerRowIdx + 1),
      sheetTitle: tabNameHint || 'Ticker Directory',
      detectedColumns,
      sheetType: 'ticker_directory',
      tickerQuotes
    };
  }

  // 2. Parse as Transaction Logger ledger
  const rawTransactions: TradeTransaction[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(cell => !cell || !String(cell).trim())) continue;

    // Detect ticker
    let rawTicker = '';
    if (tickerIdx !== -1 && row[tickerIdx]) {
      rawTicker = String(row[tickerIdx]).trim().toUpperCase();
    } else {
      for (let c = 0; c < Math.min(row.length, 6); c++) {
        const val = String(row[c] || '').trim().toUpperCase();
        if (/^[A-Z]{2,6}(\.CA)?$/.test(val)) {
          rawTicker = val;
          break;
        }
      }
    }

    if (!rawTicker) continue;
    const cleanTicker = rawTicker.replace('.CA', '').replace(/^EGX:/, '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (!cleanTicker) continue;

    const dict = EGX_STOCK_DICTIONARY[cleanTicker];
    const companyName = companyIdx !== -1 && row[companyIdx] && String(row[companyIdx]).trim()
      ? String(row[companyIdx]).trim()
      : (dict?.nameEn || `${cleanTicker} Corp`);

    const rawSector = sectorIdx !== -1 && row[sectorIdx] ? String(row[sectorIdx]).trim() : (dict?.sector || 'Other');
    const sector: Sector = (rawSector as Sector) || 'Other';

    const shares = sharesIdx !== -1 ? Math.abs(parseSheetNumber(row[sharesIdx], 0)) : 0;
    if (shares === 0) continue;

    const price = priceIdx !== -1 ? parseSheetNumber(row[priceIdx], 0) : (currentPriceIdx !== -1 ? parseSheetNumber(row[currentPriceIdx], 0) : 0);
    if (price === 0) continue;

    const dateStr = dateIdx !== -1 && row[dateIdx] ? parseSheetDate(row[dateIdx]) : new Date().toISOString().split('T')[0];
    const fees = feesIdx !== -1 ? Math.abs(parseSheetNumber(row[feesIdx], 0)) : 0;
    const rawAction = actionIdx !== -1 && row[actionIdx] ? String(row[actionIdx]).trim().toLowerCase() : '';
    const isSell = rawAction.includes('sell') || rawAction.includes('بيع') || rawAction.includes('خروج') || rawAction.includes('exit');
    const type: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';

    const tradeId = tradeIdIdx !== -1 ? parseSheetNumber(row[tradeIdIdx], i) : i;
    const tradeCycle = tradeCycleIdx !== -1 ? parseSheetNumber(row[tradeCycleIdx], 1) : 1;
    const cycleTag = cycleTagIdx !== -1 && row[cycleTagIdx] && String(row[cycleTagIdx]).trim()
      ? String(row[cycleTagIdx]).trim()
      : `${cleanTicker}-C${tradeCycle}`;

    const runningShares = runningSharesIdx !== -1 ? parseSheetNumber(row[runningSharesIdx], 0) : undefined;
    const grossTradeValue = grossIdx !== -1 ? Math.abs(parseSheetNumber(row[grossIdx], shares * price)) : (shares * price);
    const netCashImpact = netCashIdx !== -1 ? parseSheetNumber(row[netCashIdx], type === 'BUY' ? -(grossTradeValue + fees) : (grossTradeValue - fees)) : (type === 'BUY' ? -(grossTradeValue + fees) : (grossTradeValue - fees));

    const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : undefined;
    const targetPrice = targetIdx !== -1 ? parseSheetNumber(row[targetIdx], 0) || undefined : undefined;
    const stopLoss = stopLossIdx !== -1 ? parseSheetNumber(row[stopLossIdx], 0) || undefined : undefined;

    rawTransactions.push({
      id: `tx-${tradeId}-${cleanTicker}-${i}`,
      type,
      ticker: cleanTicker,
      companyName,
      sector,
      shares,
      price,
      date: dateStr,
      fees,
      totalAmount: Math.abs(netCashImpact) || (type === 'BUY' ? (shares * price) + fees : (shares * price) - fees),
      tradeId,
      tradeCycle,
      cycleTag,
      runningShares,
      grossTradeValue,
      netCashImpact,
      targetPrice,
      stopLoss,
      notes
    });
  }

  // Reconstruct true active positions and closed trades from transaction ledger
  const reconstructed = reconstructPortfolioFromTransactions(rawTransactions, livePrices);

  return {
    positions: reconstructed.positions,
    closedTrades: reconstructed.closedTrades,
    transactions: rawTransactions,
    rawRowsCount: rawTransactions.length,
    sheetTitle: tabNameHint || 'Transaction Logger',
    detectedColumns,
    sheetType: 'transaction_logger'
  };
}

/**
 * Fetches public Google Sheet data via CSV export endpoint.
 */
export async function fetchPublicSheetCsv(
  sheetUrl: string,
  tabName?: string
): Promise<string[][]> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheets URL or Spreadsheet ID.');
  }

  const gid = extractGid(sheetUrl);
  
  // Construct candidates for CSV download
  const candidateUrls: string[] = [];

  if (tabName) {
    candidateUrls.push(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(tabName)}`
    );
  }

  if (gid) {
    candidateUrls.push(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
    );
  }

  // Common tab candidates (prioritizing "Transaction logger" as requested)
  const commonTabs = ['Transaction logger', 'Transaction Logger', 'Transactions', 'Portfolio dashboard', 'Active Positions', 'Sheet1'];
  for (const tab of commonTabs) {
    candidateUrls.push(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
    );
  }

  candidateUrls.push(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`
  );

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        // Verify it contains actual CSV data (not an HTML error page)
        if (text && !text.includes('<!DOCTYPE html>') && text.includes(',')) {
          const rows = parseCsvText(text);
          if (rows.length >= 2) {
            return rows;
          }
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    lastError?.message ||
    'Could not load spreadsheet data. Make sure the Google Sheet sharing setting is set to "Anyone with the link can view".'
  );
}

/**
 * Robust CSV parser handling multiline quotes and commas.
 */
export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(val => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(val => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Automatically loads all relevant tabs from the spreadsheet:
 * 1. Finds and reads "Ticker Directory" (or similar) to get current market quotes.
 * 2. Finds and reads "Transaction logger" (or similar) to get all trade executions.
 * 3. Explicitly ignores "Portfolio dashboard" because open positions are dynamically calculated.
 * 4. Reconstructs active positions and closed trade cycles.
 */
export async function fetchAndReconcileAllTabs(
  spreadsheetId: string,
  accessToken?: string | null,
  publicSheetUrl?: string,
  livePrices: Record<string, number> = {}
): Promise<SheetParseResult & { tabNamesFound: string[]; ignoredTabs: string[] }> {
  let sheets: string[] = [];
  const cleanId = extractSpreadsheetId(spreadsheetId || publicSheetUrl || '');

  if (accessToken && cleanId) {
    try {
      const meta = await fetchSpreadsheetMetadata(cleanId, accessToken);
      sheets = meta.sheets || [];
    } catch {
      // Fallback
    }
  }

  if (sheets.length === 0) {
    sheets = ['Transaction logger', 'Ticker Directory', 'Transactions', 'Sheet1'];
  }

  const ignoredTabs: string[] = [];
  let combinedQuotes: Record<string, number> = { ...livePrices };
  let allTransactions: TradeTransaction[] = [];
  let detectedColumns: string[] = [];
  let rawRowsCount = 0;
  const tabNamesFound: string[] = [];

  // 1. Fetch Ticker Directory first if present
  const tickerTabName = sheets.find(s => {
    const l = s.toLowerCase();
    return l.includes('ticker') || l.includes('directory') || l.includes('quote') || l.includes('price');
  });

  if (tickerTabName) {
    tabNamesFound.push(tickerTabName);
    try {
      let rows: string[][] = [];
      if (accessToken && cleanId) {
        rows = await fetchSheetValues(cleanId, `${tickerTabName}!A1:Z500`, accessToken);
      } else if (publicSheetUrl) {
        rows = await fetchPublicSheetCsv(publicSheetUrl, tickerTabName);
      }

      if (rows && rows.length >= 2) {
        const parsedQuotes = parseSheetRows(rows, tickerTabName, combinedQuotes);
        if (parsedQuotes.tickerQuotes) {
          combinedQuotes = { ...combinedQuotes, ...parsedQuotes.tickerQuotes };
        }
      }
    } catch (err) {
      console.warn(`Could not load ticker directory tab "${tickerTabName}":`, err);
    }
  }

  // 2. Identify the transaction ledger tab
  const txTabName = sheets.find(s => {
    const l = s.toLowerCase();
    return l.includes('transaction') || l.includes('trade') || l.includes('log') || l.includes('ledger') || l.includes('صفقات') || l.includes('عمليات');
  }) || (sheets.find(s => !s.toLowerCase().includes('portfolio') && !s.toLowerCase().includes('dashboard') && s !== tickerTabName) || 'Transaction logger');

  // Mark Portfolio dashboard as ignored
  sheets.forEach(s => {
    const l = s.toLowerCase();
    if (l.includes('portfolio') || l.includes('dashboard') || l.includes('overview') || l.includes('ملخص')) {
      ignoredTabs.push(s);
    }
  });

  if (txTabName) {
    tabNamesFound.push(txTabName);
    try {
      let rows: string[][] = [];
      if (accessToken && cleanId) {
        rows = await fetchSheetValues(cleanId, `${txTabName}!A1:Z500`, accessToken);
      } else if (publicSheetUrl) {
        rows = await fetchPublicSheetCsv(publicSheetUrl, txTabName);
      }

      if (rows && rows.length >= 2) {
        const parsedTx = parseSheetRows(rows, txTabName, combinedQuotes);
        allTransactions = parsedTx.transactions;
        detectedColumns = parsedTx.detectedColumns;
        rawRowsCount = parsedTx.rawRowsCount;
      }
    } catch (err) {
      console.warn(`Could not load transaction logger tab "${txTabName}":`, err);
    }
  }

  // 3. Reconstruct positions and closed cycles from transactions + combined quotes
  const reconstructed = reconstructPortfolioFromTransactions(allTransactions, combinedQuotes);

  return {
    positions: reconstructed.positions,
    closedTrades: reconstructed.closedTrades,
    transactions: reconstructed.transactions || allTransactions,
    rawRowsCount,
    sheetTitle: txTabName || 'Transaction Logger',
    detectedColumns,
    sheetType: 'transaction_logger',
    tickerQuotes: combinedQuotes,
    tabNamesFound,
    ignoredTabs
  };
}

// --------------------------------------------------------------------------
// GOOGLE SHEETS API WRITING & SYNCING FUNCTIONS (OAuth & Sheets API v4)
// --------------------------------------------------------------------------

/**
 * Creates a tab in the spreadsheet if it does not already exist.
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  tabTitle: string,
  accessToken: string
): Promise<void> {
  try {
    const meta = await fetchSpreadsheetMetadata(spreadsheetId, accessToken);
    if (meta.sheets.some(s => s.toLowerCase() === tabTitle.toLowerCase())) {
      return; // Tab already exists
    }

    // Add new sheet tab via batchUpdate
    await fetchWithSheetsRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                gridProperties: {
                  rowCount: 300,
                  columnCount: 20,
                  frozenRowCount: 1,
                },
              },
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn(`Could not verify/create tab "${tabTitle}":`, err);
  }
}

/**
 * Appends or updates a transaction in the "Transaction Logger" tab in the connected Google Sheet.
 * Prevents duplicates by checking existing Trade ID column.
 */
export async function appendTransactionToSheet(
  spreadsheetId: string,
  tx: TradeTransaction,
  accessToken: string,
  tabName = 'Transaction Logger'
): Promise<{ success: boolean; message: string; finalTradeId?: number | string; isAuthError?: boolean }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);

    // 1. Resolve exact tab name in Google Sheet case-insensitively
    const meta = await fetchSpreadsheetMetadata(cleanId, accessToken).catch(() => ({ sheets: [] }));
    const targetTab = meta.sheets.find(s => s.toLowerCase() === 'transaction logger')
      || meta.sheets.find(s => s.toLowerCase().includes('transaction') || s.toLowerCase().includes('log'))
      || tabName;

    await ensureSheetTabExists(cleanId, targetTab, accessToken);

    // 2. Fetch existing rows from target tab
    const existingRows = await fetchSheetValues(cleanId, `${targetTab}!A1:Z500`, accessToken).catch(() => []);

    const stdHeaders = TRANSACTION_LOGGER_HEADERS;

    let headerRowIdx = 0;
    let rawHeaders: string[] = [];
    if (existingRows.length > 0) {
      headerRowIdx = findHeaderRowIndex(existingRows);
      rawHeaders = existingRows[headerRowIdx] || [];
    }

    const headers = rawHeaders.map(h => (h || '').toString().trim());
    const hasHeader = headers.length > 0 && headers.some(h => {
      const l = h.toLowerCase();
      return l.includes('trade') || l.includes('ticker') || l.includes('date') || l.includes('action');
    });

    // Build column index map for standard 14 headers
    const colMap: Record<string, number> = {};
    if (hasHeader) {
      stdHeaders.forEach(stdH => {
        colMap[stdH] = findColIndexBySynonyms(headers, stdH);
      });
    } else {
      stdHeaders.forEach((stdH, i) => {
        colMap[stdH] = i;
      });
    }

    // Scan existing rows for duplicate row match and highest existing Trade ID in sheet
    let maxSheetTradeId = 0;
    let existingSheetRowNumber = -1; // 1-based row number in Google Sheets

    const rawTxTradeId = tx.tradeId !== undefined ? tx.tradeId : (tx.trade_id !== undefined ? tx.trade_id : tx.id);
    const targetTradeIdStr = String(rawTxTradeId !== undefined ? rawTxTradeId : '').trim();

    if (existingRows.length > 0) {
      const tradeIdCol = colMap['Trade ID'] >= 0 ? colMap['Trade ID'] : findColIndexBySynonyms(headers, 'Trade ID');
      const dateCol = colMap['Date'] >= 0 ? colMap['Date'] : findColIndexBySynonyms(headers, 'Date');
      const actionCol = colMap['Action'] >= 0 ? colMap['Action'] : findColIndexBySynonyms(headers, 'Action');
      const tickerCol = colMap['Ticker'] >= 0 ? colMap['Ticker'] : findColIndexBySynonyms(headers, 'Ticker');
      const sharesCol = colMap['Shares'] >= 0 ? colMap['Shares'] : findColIndexBySynonyms(headers, 'Shares');
      const priceCol = colMap['Price / Share'] >= 0 ? colMap['Price / Share'] : findColIndexBySynonyms(headers, 'Price / Share');

      for (let r = headerRowIdx + 1; r < existingRows.length; r++) {
        const row = existingRows[r];
        if (!row || row.length === 0) continue;

        const rowTradeIdStr = tradeIdCol >= 0 ? String(row[tradeIdCol] || '').trim() : '';
        const parsedId = parseInt(rowTradeIdStr, 10);
        if (!isNaN(parsedId) && parsedId > maxSheetTradeId) {
          maxSheetTradeId = parsedId;
        }

        // Match 1: By exact Trade ID
        if (targetTradeIdStr && rowTradeIdStr && rowTradeIdStr === targetTradeIdStr) {
          existingSheetRowNumber = r + 1;
          break;
        }

        // Match 2: By identical transaction content (Date, Action, Ticker, Shares, Price) to prevent duplicate appends
        if (
          existingSheetRowNumber < 0 &&
          dateCol >= 0 && actionCol >= 0 && tickerCol >= 0 && sharesCol >= 0 && priceCol >= 0
        ) {
          const rowDate = parseSheetDate(row[dateCol]);
          const txDate = parseSheetDate(tx.date);
          const rowAction = String(row[actionCol] || '').trim().toUpperCase();
          const txAction = String(tx.type || '').trim().toUpperCase();
          const rowTicker = String(row[tickerCol] || '').trim().toUpperCase();
          const txTicker = String(tx.ticker || '').trim().toUpperCase();
          const rowShares = parseSheetNumber(row[sharesCol]);
          const rowPrice = parseSheetNumber(row[priceCol]);

          if (
            rowDate === txDate &&
            rowAction === txAction &&
            rowTicker === txTicker &&
            Math.abs(rowShares - tx.shares) < 0.001 &&
            Math.abs(rowPrice - tx.price) < 0.001
          ) {
            existingSheetRowNumber = r + 1;
          }
        }
      }
    }

    // Determine final Trade ID to write
    let finalTradeId: number | string;
    const tradeIdCol = colMap['Trade ID'] >= 0 ? colMap['Trade ID'] : findColIndexBySynonyms(headers, 'Trade ID');
    if (existingSheetRowNumber > 0 && tradeIdCol >= 0 && existingRows[existingSheetRowNumber - 1]) {
      const existingRow = existingRows[existingSheetRowNumber - 1];
      const existingIdStr = String(existingRow[tradeIdCol] || '').trim();
      finalTradeId = existingIdStr || targetTradeIdStr || (maxSheetTradeId > 0 ? maxSheetTradeId : 1);
    } else {
      // Sequential ID relative to the highest existing trade ID in the sheet
      if (maxSheetTradeId > 0) {
        finalTradeId = maxSheetTradeId + 1;
      } else {
        const numParsed = parseInt(targetTradeIdStr, 10);
        finalTradeId = !isNaN(numParsed) && numParsed > 0 ? numParsed : Math.max(1, existingRows.length - headerRowIdx);
      }
    }

    // Prepare row array
    const maxCol = Math.max(...Object.values(colMap).filter(v => v >= 0), 13);
    const rowData = new Array(maxCol + 1).fill('');

    const setVal = (headerName: string, value: any) => {
      const colIdx = colMap[headerName];
      if (colIdx !== undefined && colIdx >= 0) {
        rowData[colIdx] = value !== undefined && value !== null ? value : '';
      }
    };

    const gross = tx.grossTradeValue !== undefined ? tx.grossTradeValue : Math.round(tx.shares * tx.price * 100) / 100;
    const fee = tx.fees || 0;
    const netCash = tx.netCashImpact !== undefined
      ? tx.netCashImpact
      : (tx.type === 'BUY' ? -(gross + fee) : (gross - fee));

    setVal('Trade ID', finalTradeId);
    setVal('Date', tx.date || new Date().toISOString().split('T')[0]);
    setVal('Action', tx.type);
    setVal('Ticker', tx.ticker.toUpperCase());
    setVal('Company Name', tx.companyName);
    setVal('Shares', tx.shares);
    setVal('Price / Share', tx.price);
    setVal('Gross Trade Value', Math.round(gross * 100) / 100);
    setVal('Brokerage Fee', Math.round(fee * 100) / 100);
    setVal('Net Cash Impact', Math.round(netCash * 100) / 100);
    setVal('Strategy / Notes', tx.notes || '');
    setVal('Running Shares', tx.runningShares !== undefined ? tx.runningShares : '');
    setVal('Trade Cycle', tx.tradeCycle || 1);
    setVal('Cycle Tag', tx.cycleTag || `${tx.ticker}-C${tx.tradeCycle || 1}`);

    if (existingSheetRowNumber > 0) {
      // UPDATE existing row
      const updateRange = `${targetTab}!A${existingSheetRowNumber}:${colToLetter(rowData.length - 1)}${existingSheetRowNumber}`;
      const updateRes = await fetchWithSheetsRetry(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowData] }),
        }
      );
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${updateRes.status}`);
      }
      return { success: true, message: `Updated Trade ID ${finalTradeId} in "${targetTab}"`, finalTradeId };
    } else {
      // APPEND new row
      const valuesToAppend = hasHeader ? [rowData] : [stdHeaders, rowData];
      const appendRes = await fetchWithSheetsRetry(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(targetTab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: valuesToAppend }),
        }
      );
      if (!appendRes.ok) {
        const err = await appendRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${appendRes.status}`);
      }
      return { success: true, message: `Appended trade ${tx.type} for ${tx.ticker} to "${targetTab}"`, finalTradeId };
    }
  } catch (err: any) {
    const isAuth = Boolean(err?.isAuthError || err?.message?.includes('Auth') || err?.message?.includes('401'));
    console.error('Failed to append/update transaction in Google Sheet:', err);
    return { success: false, message: err.message || 'Failed to update Google Sheet', isAuthError: isAuth };
  }
}

/**
 * Updates the "Ticker Directory" tab in the Google Sheet with latest prices.
 * Targets ONLY the Ticker Directory tab and does not touch transaction rows.
 */
export async function updateStockDirectoryInSheet(
  spreadsheetId: string,
  tickers: EGXTicker[],
  accessToken: string,
  tabName = 'Ticker Directory'
): Promise<{ success: boolean; message: string; isAuthError?: boolean }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);

    // 1. Resolve tab name case-insensitively
    const meta = await fetchSpreadsheetMetadata(cleanId, accessToken).catch(() => ({ sheets: [] }));
    const targetTab = meta.sheets.find(s => s.toLowerCase() === 'ticker directory')
      || meta.sheets.find(s => s.toLowerCase().includes('ticker') || s.toLowerCase().includes('directory'))
      || tabName;

    await ensureSheetTabExists(cleanId, targetTab, accessToken);

    // 2. Fetch existing rows
    const existingRows = await fetchSheetValues(cleanId, `${targetTab}!A1:Z500`, accessToken).catch(() => []);

    const stdHeaders = TICKER_DIRECTORY_HEADERS; // ['Ticker', 'Company Name', 'Sector', 'Current Price (EGP)']

    let headerRowIdx = 0;
    let rawHeaders: string[] = [];
    if (existingRows.length > 0) {
      headerRowIdx = findHeaderRowIndex(existingRows);
      rawHeaders = existingRows[headerRowIdx] || [];
    }

    const headers = rawHeaders.map(h => (h || '').toString().trim());
    const hasHeader = headers.length > 0 && headers.some(h => {
      const l = h.toLowerCase();
      return l.includes('ticker') || l.includes('price') || l.includes('company');
    });

    let tickerCol = hasHeader ? findColIndexBySynonyms(headers, 'Ticker') : 0;
    let nameCol = hasHeader ? findColIndexBySynonyms(headers, 'Company Name') : 1;
    let sectorCol = hasHeader ? findColIndexBySynonyms(headers, 'Sector') : 2;
    let priceCol = hasHeader ? findColIndexBySynonyms(headers, 'Current Price (EGP)') : 3;

    if (tickerCol === -1) tickerCol = 0;
    if (nameCol === -1) nameCol = 1;
    if (sectorCol === -1) sectorCol = 2;
    if (priceCol === -1) priceCol = 3;

    // Map existing ticker symbols to row index
    const existingTickerRowMap: Record<string, number> = {};
    if (hasHeader) {
      for (let r = headerRowIdx + 1; r < existingRows.length; r++) {
        const rawT = String(existingRows[r][tickerCol] || '').trim().toUpperCase();
        const cleanT = rawT.replace('.CA', '').replace(/^EGX:/, '').replace(/[^A-Z0-9]/g, '');
        if (cleanT) {
          existingTickerRowMap[cleanT] = r;
        }
      }
    }

    let updatedRows = hasHeader ? existingRows.map(r => [...r]) : [[...stdHeaders]];

    if (!hasHeader) {
      headerRowIdx = 0;
      updatedRows = [[...stdHeaders]];
    }

    tickers.forEach(t => {
      const cleanT = t.ticker.toUpperCase();
      const rowIdx = existingTickerRowMap[cleanT];

      if (rowIdx !== undefined && rowIdx < updatedRows.length) {
        // Update price (and company/sector if missing)
        const row = [...updatedRows[rowIdx]];
        while (row.length <= Math.max(tickerCol, nameCol, sectorCol, priceCol)) {
          row.push('');
        }
        row[tickerCol] = t.ticker;
        if (!row[nameCol]) row[nameCol] = t.nameEn;
        if (!row[sectorCol]) row[sectorCol] = t.sector;
        row[priceCol] = t.lastPrice;
        updatedRows[rowIdx] = row;
      } else {
        // Append new ticker row
        const maxC = Math.max(tickerCol, nameCol, sectorCol, priceCol);
        const newRow = new Array(maxC + 1).fill('');
        newRow[tickerCol] = t.ticker;
        newRow[nameCol] = t.nameEn;
        newRow[sectorCol] = t.sector;
        newRow[priceCol] = t.lastPrice;
        updatedRows.push(newRow);
      }
    });

    // Write full Ticker Directory sheet back
    const maxCols = Math.max(...updatedRows.map(r => r.length), 4);
    const lastColLetter = colToLetter(maxCols - 1);
    const updateRange = `${targetTab}!A1:${lastColLetter}${updatedRows.length}`;

    const updateRes = await fetchWithSheetsRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: updatedRows }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${updateRes.status}`);
    }

    return {
      success: true,
      message: `Successfully updated ${tickers.length} EGX equities in "${targetTab}"`
    };
  } catch (err: any) {
    const isAuth = Boolean(err?.isAuthError || err?.message?.includes('Auth') || err?.message?.includes('401'));
    console.error('Failed to update Ticker Directory in Google Sheet:', err);
    return { success: false, message: err.message || 'Failed to update Ticker Directory', isAuthError: isAuth };
  }
}

/**
 * Pushes full transactions and stock directory to Google Sheet using exact column schemas.
 */
export async function syncAllPortfolioToSheet(
  spreadsheetId: string,
  positions: Position[],
  closedTrades: ClosedTrade[],
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  accessToken: string
): Promise<{ success: boolean; message: string; isAuthError?: boolean }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);

    // 1. Sync "Transaction Logger" tab (Exact 14 headers)
    await ensureSheetTabExists(cleanId, 'Transaction Logger', accessToken);
    const enrichedTxs = enrichTransactionsForLedger(transactions);

    const txRows = enrichedTxs.map(tx => {
      const gross = tx.grossTradeValue !== undefined ? tx.grossTradeValue : Math.round(tx.shares * tx.price * 100) / 100;
      const fee = tx.fees || 0;
      const netCash = tx.netCashImpact !== undefined
        ? tx.netCashImpact
        : (tx.type === 'BUY' ? -(gross + fee) : (gross - fee));

      return [
        tx.tradeId !== undefined ? tx.tradeId : (tx.trade_id !== undefined ? tx.trade_id : tx.id),
        tx.date,
        tx.type,
        tx.ticker.toUpperCase(),
        tx.companyName,
        tx.shares,
        tx.price,
        Math.round(gross * 100) / 100,
        Math.round(fee * 100) / 100,
        Math.round(netCash * 100) / 100,
        tx.notes || '',
        tx.runningShares !== undefined ? tx.runningShares : '',
        tx.tradeCycle || 1,
        tx.cycleTag || `${tx.ticker}-C${tx.tradeCycle || 1}`
      ];
    });

    await fetchWithSheetsRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent('Transaction Logger')}!A1:N${txRows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [TRANSACTION_LOGGER_HEADERS, ...txRows],
        }),
      }
    );

    // 2. Sync "Ticker Directory" tab (Exact 4 headers)
    await updateStockDirectoryInSheet(cleanId, tickers, accessToken, 'Ticker Directory');

    return {
      success: true,
      message: `Complete 2-way sync: ${transactions.length} Transactions written to "Transaction Logger" and ${tickers.length} stock quotes updated in "Ticker Directory"!`
    };
  } catch (err: any) {
    const isAuth = Boolean(err?.isAuthError || err?.message?.includes('Auth') || err?.message?.includes('401'));
    console.error('Failed complete portfolio sync to Google Sheet:', err);
    return { success: false, message: err.message || 'Failed complete sync', isAuthError: isAuth };
  }
}

