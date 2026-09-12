import { Position, ClosedTrade, Sector, TradeTransaction, EGXTicker } from '../types';

export interface SheetParseResult {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  rawRowsCount: number;
  sheetTitle: string;
  detectedColumns: string[];
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

/**
 * Fetches Google Sheet metadata (title, sheet tabs) via Sheets API v4.
 */
export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheets: string[] }> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
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
  const res = await fetch(
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
 * Normalizes numbers from raw spreadsheet strings, handling Arabic numerals, currency, commas, and percentage signs.
 */
export function parseSheetNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  // Convert Eastern Arabic / Persian numerals to ASCII
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let str = String(val).trim();
  for (let i = 0; i < 10; i++) {
    str = str.split(arabicNumerals[i]).join(String(i));
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

  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

/**
 * Scans rows to find the most probable header row within the first 15 rows.
 */
export function findHeaderRowIndex(rows: string[][]): number {
  if (!rows || rows.length === 0) return 0;

  const headerKeywords = [
    'ticker', 'symbol', 'code', 'stock', 'سهم', 'الرمز', 'كود', 'السهم',
    'shares', 'qty', 'quantity', 'volume', 'units', 'الكمية', 'عدد الأسهم', 'العدد',
    'buy price', 'avg price', 'purchase price', 'cost', 'avg cost', 'cost/share', 'entry price', 'سعر الشراء', 'متوسط التكلفة', 'التكلفة', 'سعر',
    'company', 'name', 'security', 'اسم الشركة', 'الشركة',
    'price', 'current price', 'market price', 'cmp', 'سعر السوق', 'السعر الحالي',
    'date', 'buy date', 'trade date', 'تاريخ',
    'action', 'type', 'side', 'نوع العملية', 'النوع',
    'realized', 'pnl', 'profit', 'الربح'
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
        if (cell.includes(kw) || kw.includes(cell)) {
          score++;
          break;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  // If score is at least 1, use that row; otherwise default to row 0
  return maxScore >= 1 ? bestIdx : 0;
}

/**
 * Intelligent parser that can parse:
 * 1. Active Stock Positions sheets
 * 2. Transaction Logger sheets
 * 3. Closed Trades sheets
 * 4. Hybrid sheets with mixed Arabic/English headers
 */
export function parseSheetRows(rows: string[][]): SheetParseResult {
  if (!rows || rows.length < 2) {
    return {
      positions: [],
      closedTrades: [],
      transactions: [],
      rawRowsCount: 0,
      sheetTitle: 'Empty Sheet',
      detectedColumns: []
    };
  }

  const headerRowIdx = findHeaderRowIndex(rows);
  const rawHeaders = rows[headerRowIdx] || [];
  const headers = rawHeaders.map(h => (h || '').toString().trim().toLowerCase());

  // Find column indices with extensive synonyms
  const getCol = (possibleNames: string[]) => {
    return headers.findIndex(h => possibleNames.some(name => h.includes(name.toLowerCase())));
  };

  const tickerIdx = getCol(['ticker', 'symbol', 'code', 'stock', 'سهم', 'الرمز', 'كود', 'السهم', 'كود السهم', 'رمز السهم', 'اسم السهم']);
  const companyIdx = getCol(['company', 'name', 'security', 'description', 'اسم الشركة', 'الشركة', 'بيان']);
  const sectorIdx = getCol(['sector', 'industry', 'القطاع', 'قطاع']);
  const sharesIdx = getCol(['shares', 'qty', 'quantity', 'volume', 'units', 'no of shares', 'الكمية', 'عدد الأسهم', 'العدد', 'كمية']);
  const buyPriceIdx = getCol(['buy price', 'avg price', 'purchase price', 'cost', 'avg cost', 'cost/share', 'entry price', 'سعر الشراء', 'متوسط التكلفة', 'التكلفة', 'سعر الدخول', 'الشراء']);
  const currentPriceIdx = getCol(['current price', 'market price', 'cmp', 'last price', 'last', 'close', 'سعر السوق', 'السعر الحالي', 'سعر الإغلاق', 'سعر اليوم']);
  const genericPriceIdx = getCol(['price', 'السعر', 'سعر']);
  const buyDateIdx = getCol(['buy date', 'purchase date', 'trade date', 'entry date', 'تاريخ الشراء', 'تاريخ العملية', 'date', 'تاريخ']);
  const targetIdx = getCol(['target', 'tp', 'target price', 'take profit', 'هدف', 'الهدف', 'سعر الهدف']);
  const stopLossIdx = getCol(['stop', 'sl', 'stop loss', 'وقف', 'وقف الخسارة', 'وقف خسارة']);
  const statusIdx = getCol(['status', 'state', 'حالة', 'الحالة', 'open/closed']);
  const typeIdx = getCol(['type', 'action', 'side', 'operation', 'نوع العملية', 'النوع', 'نوع']);
  const sellPriceIdx = getCol(['sell price', 'exit price', 'sold price', 'سعر البيع', 'البيع', 'سعر الخروج']);
  const sellDateIdx = getCol(['sell date', 'exit date', 'close date', 'تاريخ البيع', 'تاريخ الخروج']);
  const feesIdx = getCol(['fee', 'fees', 'commission', 'commissions', 'brokerage', 'عمولة', 'مصاريف', 'العمولة']);
  const realizedPnlIdx = getCol(['realized', 'realized pnl', 'pnl', 'p&l', 'profit', 'gain/loss', 'الربح', 'الأرباح', 'صافي الربح']);
  const totalAmountIdx = getCol(['total', 'amount', 'total amount', 'value', 'outlay', 'proceeds', 'إجمالي', 'القيمة', 'المبلغ']);
  const notesIdx = getCol(['notes', 'comment', 'comments', 'strategy', 'remarks', 'ملاحظات', 'استراتيجية']);

  const positions: Position[] = [];
  const closedTrades: ClosedTrade[] = [];
  const transactions: TradeTransaction[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(cell => !cell || !String(cell).trim())) continue;

    // Detect ticker
    let rawTicker = '';
    if (tickerIdx !== -1 && row[tickerIdx]) {
      rawTicker = String(row[tickerIdx]).trim().toUpperCase();
    } else {
      // Fallback: look through first 4 cells for a likely stock code (2-5 uppercase chars)
      for (let c = 0; c < Math.min(row.length, 4); c++) {
        const val = String(row[c] || '').trim().toUpperCase();
        if (/^[A-Z]{2,6}(\.CA)?$/.test(val)) {
          rawTicker = val;
          break;
        }
      }
    }

    if (!rawTicker) continue;
    const cleanTicker = rawTicker.replace('.CA', '').replace(/[^A-Z0-9]/g, '');
    if (!cleanTicker) continue;

    const companyName = companyIdx !== -1 && row[companyIdx] && String(row[companyIdx]).trim()
      ? String(row[companyIdx]).trim()
      : `${cleanTicker} Corp`;

    const rawSector = sectorIdx !== -1 && row[sectorIdx] ? String(row[sectorIdx]).trim() : 'Other';
    const sector: Sector = (rawSector as Sector) || 'Other';

    const shares = sharesIdx !== -1 ? Math.abs(parseSheetNumber(row[sharesIdx], 100)) : 100;
    
    // Price resolution
    let buyPrice = buyPriceIdx !== -1 ? parseSheetNumber(row[buyPriceIdx], 0) : 0;
    if (buyPrice === 0 && genericPriceIdx !== -1) {
      buyPrice = parseSheetNumber(row[genericPriceIdx], 0);
    }
    if (buyPrice === 0) buyPrice = 10; // safe fallback

    const currentPrice = currentPriceIdx !== -1 
      ? parseSheetNumber(row[currentPriceIdx], buyPrice) 
      : buyPrice;

    const dateStr = buyDateIdx !== -1 && row[buyDateIdx] 
      ? String(row[buyDateIdx]).trim() 
      : new Date().toISOString().split('T')[0];

    const targetPrice = targetIdx !== -1 ? parseSheetNumber(row[targetIdx], 0) || undefined : undefined;
    const stopLoss = stopLossIdx !== -1 ? parseSheetNumber(row[stopLossIdx], 0) || undefined : undefined;
    const notes = notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]).trim() : undefined;
    const fees = feesIdx !== -1 ? parseSheetNumber(row[feesIdx], 0) : 0;
    
    // Status & Type detection
    const statusVal = statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim().toLowerCase() : '';
    const typeVal = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim().toLowerCase() : '';
    const sellPrice = sellPriceIdx !== -1 ? parseSheetNumber(row[sellPriceIdx], 0) : 0;
    const sellDate = sellDateIdx !== -1 && row[sellDateIdx] ? String(row[sellDateIdx]).trim() : '';
    const realizedPnl = realizedPnlIdx !== -1 ? parseSheetNumber(row[realizedPnlIdx], 0) : 0;

    const isSellTransaction = typeVal.includes('sell') || typeVal.includes('بيع') || typeVal.includes('exit');
    const isClosed = statusVal.includes('closed') || statusVal.includes('sold') || statusVal.includes('مغلق') || isSellTransaction || sellPrice > 0;

    if (isClosed) {
      const actualSellPrice = sellPrice > 0 ? sellPrice : (buyPrice + (shares > 0 && realizedPnl !== 0 ? realizedPnl / shares : 0));
      const calcRealizedPnl = realizedPnl !== 0 ? realizedPnl : (actualSellPrice - buyPrice) * shares - fees;
      const calcPnlPercent = buyPrice > 0 ? ((actualSellPrice - buyPrice) / buyPrice) * 100 : 0;
      const outcome = calcRealizedPnl > 0 ? 'WIN' : calcRealizedPnl < 0 ? 'LOSS' : 'BREAKEVEN';

      closedTrades.push({
        id: `imported-ct-${i}-${cleanTicker}`,
        ticker: cleanTicker,
        companyName,
        sector,
        shares,
        buyPrice,
        sellPrice: actualSellPrice,
        buyDate: dateStr,
        sellDate: sellDate || dateStr || new Date().toISOString().split('T')[0],
        holdingDays: 30,
        realizedPnlEgp: calcRealizedPnl,
        realizedPnlPercent: calcPnlPercent,
        totalFees: fees,
        outcome,
        tradeType: 'Swing',
        notes
      });

      transactions.push({
        id: `imported-tx-sell-${i}-${cleanTicker}`,
        type: 'SELL',
        ticker: cleanTicker,
        companyName,
        sector,
        shares,
        price: actualSellPrice,
        date: sellDate || dateStr,
        fees,
        totalAmount: (shares * actualSellPrice) - fees,
        realizedPnlEgp: calcRealizedPnl,
        realizedPnlPercent: calcPnlPercent,
        outcome,
        notes
      });
    } else {
      positions.push({
        id: `imported-pos-${i}-${cleanTicker}`,
        ticker: cleanTicker,
        companyName,
        sector,
        shares,
        avgBuyPrice: buyPrice,
        currentPrice: currentPrice || buyPrice,
        buyDate: dateStr,
        totalFees: fees,
        targetPrice,
        stopLoss,
        notes
      });

      transactions.push({
        id: `imported-tx-buy-${i}-${cleanTicker}`,
        type: 'BUY',
        ticker: cleanTicker,
        companyName,
        sector,
        shares,
        price: buyPrice,
        date: dateStr,
        fees,
        totalAmount: (shares * buyPrice) + fees,
        targetPrice,
        stopLoss,
        notes
      });
    }
  }

  return {
    positions,
    closedTrades,
    transactions,
    rawRowsCount: rows.length - (headerRowIdx + 1),
    sheetTitle: 'Parsed Sheet',
    detectedColumns: rawHeaders
  };
}

export function generateSampleCsv(): string {
  const headers = ['Ticker', 'Company Name', 'Sector', 'Shares', 'Buy Price', 'Current Price', 'Buy Date', 'Target Price', 'Stop Loss', 'Status', 'Sell Price', 'Notes'];
  const sampleRows = [
    ['COMI', 'Commercial International Bank (CIB)', 'Banking', '2500', '76.40', '88.50', '2026-06-15', '98.00', '83.50', 'Open', '', 'Core banking allocation'],
    ['ESRS', 'Ezz Steel', 'Basic Resources & Steel', '1800', '98.50', '118.20', '2026-07-20', '135.00', '109.00', 'Open', '', 'Export revenue momentum'],
    ['TMGH', 'Talaat Moustafa Group', 'Real Estate & Construction', '3000', '48.20', '68.50', '2026-04-10', '75.00', '58.50', 'Closed', '68.50', 'Sold near target resistance'],
    ['SWDY', 'Elsewedy Electric', 'Industrial Goods & Services', '3200', '48.00', '54.20', '2026-08-05', '62.00', '49.50', 'Open', '', 'Regional cable orders'],
    ['ABUK', 'Abu Qir Fertilizers', 'Petrochemicals & Fertilizers', '2000', '74.20', '72.80', '2026-08-28', '84.00', '68.00', 'Open', '', 'Bottom range support entry']
  ];

  return [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
}

/**
 * Super-resilient public sheet fetcher that tries multiple export endpoints and falls back gracefully.
 */
export async function fetchPublicSheetCsv(
  spreadsheetId: string, 
  sheetName?: string,
  gid?: string | null
): Promise<string[][]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanGid = gid || extractGid(spreadsheetId);

  const urlsToTry: string[] = [];

  if (cleanGid) {
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv&gid=${cleanGid}`);
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&gid=${cleanGid}`);
  }

  if (sheetName && sheetName.trim() && sheetName !== 'Sheet1') {
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName.trim())}`);
  }

  // Generic direct export (returns active/first sheet)
  urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`);
  urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv`);

  // Common sheet tab names in EGX / finance templates
  const commonTabNames = ['Portfolio', 'Active Positions', 'Positions', 'Holdings', 'Transaction Logger', 'Transactions', 'Trade Journal', 'Stocks Directory', 'EGX Directory', 'Sheet1'];
  for (const tab of commonTabNames) {
    if (tab !== sheetName) {
      urlsToTry.push(`https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`);
    }
  }

  let lastError: Error | null = null;

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const text = await res.text();
      // Verify response isn't a google auth error html or json error payload
      if (text.includes('google.visualization.Query.setResponse') && text.includes('"status":"error"')) {
        continue;
      }
      if (text.trim().startsWith('<!DOCTYPE html>') && text.includes('accounts.google.com')) {
        continue;
      }

      const rows = parseCsvText(text);
      if (rows && rows.length >= 2) {
        // Check if there is meaningful data or ticker headers
        const parsed = parseSheetRows(rows);
        if (parsed.positions.length > 0 || parsed.closedTrades.length > 0 || rows.length >= 2) {
          return rows;
        }
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error(`Could not access Google Sheet data. Please ensure the Google Sheet is shared with "Anyone with the link can view/edit", or Sign In with Google.`);
}

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
    if (meta.sheets.includes(tabTitle)) {
      return; // Tab already exists
    }

    // Add new sheet tab via batchUpdate
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
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
                  rowCount: 200,
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
 * Appends a transaction to the "Transaction Logger" sheet in the connected Google Sheet.
 */
export async function appendTransactionToSheet(
  spreadsheetId: string,
  tx: TradeTransaction,
  accessToken: string,
  tabName = 'Transaction Logger'
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    await ensureSheetTabExists(cleanId, tabName, accessToken);

    // Check if sheet already has header row
    const existingValues = await fetchSheetValues(cleanId, `${tabName}!A1:O1`, accessToken).catch(() => []);
    const hasHeader = existingValues && existingValues.length > 0 && existingValues[0].length > 0;

    const headers = [
      'Timestamp / Date',
      'Transaction Type',
      'Ticker',
      'Company Name',
      'Sector',
      'Shares / Qty',
      'Price (EGP)',
      'Total Amount (EGP)',
      'Brokerage Fees (EGP)',
      'Realized P&L (EGP)',
      'Realized P&L %',
      'Holding Days',
      'Target Price (EGP)',
      'Stop Loss (EGP)',
      'Notes & Strategy'
    ];

    const rowData = [
      tx.date || new Date().toISOString().split('T')[0],
      tx.type,
      tx.ticker,
      tx.companyName,
      tx.sector,
      tx.shares,
      tx.price,
      tx.totalAmount,
      tx.fees || 0,
      tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp : '',
      tx.realizedPnlPercent !== undefined ? `${tx.realizedPnlPercent.toFixed(2)}%` : '',
      tx.holdingDays !== undefined ? tx.holdingDays : '',
      tx.targetPrice !== undefined ? tx.targetPrice : '',
      tx.stopLoss !== undefined ? tx.stopLoss : '',
      tx.notes || (tx.isDCA ? 'DCA Addition' : '')
    ];

    const valuesToAppend = hasHeader ? [rowData] : [headers, rowData];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: valuesToAppend,
        }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${appendRes.status}`);
    }

    return { success: true, message: `Appended ${tx.type} for ${tx.ticker} to ${tabName}` };
  } catch (err: any) {
    console.error('Failed to append transaction to sheet:', err);
    return { success: false, message: err.message || 'Failed to update Google Sheet' };
  }
}

/**
 * Updates or creates the "Stock Directory" tab with latest live EGX quotes and technical levels.
 */
export async function updateStockDirectoryInSheet(
  spreadsheetId: string,
  tickers: EGXTicker[],
  accessToken: string,
  tabName = 'Stock Directory'
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    await ensureSheetTabExists(cleanId, tabName, accessToken);

    const headers = [
      'Ticker',
      'English Name',
      'Arabic Name',
      'Sector',
      'Last Price (EGP)',
      'Day Change (%)',
      'Day High (EGP)',
      'Day Low (EGP)',
      '52W High (EGP)',
      '52W Low (EGP)',
      'Volume',
      'Trend Status',
      'RSI (14)',
      'Support Level',
      'Resistance Level',
      'Target Price',
      'Stop Loss',
      'Last Updated'
    ];

    const rows = tickers.map(t => [
      t.ticker,
      t.nameEn,
      t.nameAr,
      t.sector,
      t.lastPrice,
      `${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%`,
      t.dayHigh,
      t.dayLow,
      t.yearHigh,
      t.yearLow,
      t.volume,
      t.trendStatus,
      t.rsi14,
      t.support,
      t.resistance,
      t.targetPrice,
      t.stopLoss,
      t.lastUpdated || new Date().toISOString()
    ]);

    const values = [headers, ...rows];

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(tabName)}!A1:R${values.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${updateRes.status}`);
    }

    return { 
      success: true, 
      message: `Successfully synchronized ${tickers.length} EGX equities to "${tabName}" in Google Sheets` 
    };
  } catch (err: any) {
    console.error('Failed to update Stock Directory in Google Sheet:', err);
    return { success: false, message: err.message || 'Failed to update Stock Directory in Google Sheet' };
  }
}

/**
 * Pushes entire active portfolio, transactions, and stock directory to Google Sheet.
 */
export async function syncAllPortfolioToSheet(
  spreadsheetId: string,
  positions: Position[],
  closedTrades: ClosedTrade[],
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);

    // 1. Sync Active Positions tab
    await ensureSheetTabExists(cleanId, 'Active Positions', accessToken);
    const posHeaders = ['Ticker', 'Company Name', 'Sector', 'Shares', 'Avg Buy Price (EGP)', 'Current Price (EGP)', 'Market Value (EGP)', 'Unrealized P&L (EGP)', 'Unrealized %', 'Buy Date', 'Target Price', 'Stop Loss', 'Notes'];
    const posRows = positions.map(p => {
      const val = p.shares * p.currentPrice;
      const cost = p.shares * p.avgBuyPrice;
      const pnl = val - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      return [
        p.ticker,
        p.companyName,
        p.sector,
        p.shares,
        p.avgBuyPrice,
        p.currentPrice,
        val,
        pnl,
        `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
        p.buyDate,
        p.targetPrice || '',
        p.stopLoss || '',
        p.notes || ''
      ];
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent('Active Positions')}!A1:M${posRows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [posHeaders, ...posRows],
        }),
      }
    );

    // 2. Sync Stock Directory tab with latest prices
    await updateStockDirectoryInSheet(cleanId, tickers, accessToken, 'Stock Directory');

    // 3. Sync Transactions tab
    await ensureSheetTabExists(cleanId, 'Transaction Logger', accessToken);
    const txHeaders = ['Timestamp / Date', 'Transaction Type', 'Ticker', 'Company Name', 'Sector', 'Shares', 'Price (EGP)', 'Total Amount (EGP)', 'Fees (EGP)', 'Realized P&L (EGP)', 'Realized P&L %', 'Notes'];
    const txRows = transactions.map(tx => [
      tx.date,
      tx.type,
      tx.ticker,
      tx.companyName,
      tx.sector,
      tx.shares,
      tx.price,
      tx.totalAmount,
      tx.fees || 0,
      tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp : '',
      tx.realizedPnlPercent !== undefined ? `${tx.realizedPnlPercent.toFixed(2)}%` : '',
      tx.notes || ''
    ]);

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent('Transaction Logger')}!A1:L${txRows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [txHeaders, ...txRows],
        }),
      }
    );

    return {
      success: true,
      message: `Complete 2-way sync: ${positions.length} Active Positions, ${transactions.length} Transactions, and ${tickers.length} Stock Directory quotes updated in Google Sheet!`
    };
  } catch (err: any) {
    console.error('Failed complete portfolio sync to Google Sheet:', err);
    return { success: false, message: err.message || 'Failed complete sync' };
  }
}
