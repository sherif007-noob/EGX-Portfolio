import { createWorker } from 'tesseract.js';
import { EGXTicker, Sector } from '../types';
import { dmyToIso, getTodayISO } from '../utils/dateUtils';

export interface ParsedOcrTrade {
  ticker: string;
  companyName: string;
  sector: Sector;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fees: number;
  date: string;
  brokerName: string;
  notes: string;
  confidenceScore: number;
  rawOcrText?: string;
}

/**
 * Parses raw text extracted from a trade screenshot into structured trade fields.
 */
export function parseTradeText(
  rawText: string,
  tickers: EGXTicker[]
): Partial<ParsedOcrTrade> | null {
  if (!rawText || rawText.trim().length === 0) return null;

  // Clean and normalize OCR quirks
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ⓘℹ️©®]/g, ' ')
    .replace(/\b(E6P|EGR|ECP)\b/gi, 'EGP');
  const upper = text.toUpperCase();

  // 1. Detect Broker
  let brokerName = 'Telda';
  if (/THNDR|THUNDER/i.test(text)) {
    brokerName = 'Thndr';
  } else if (/MUBASHER/i.test(text)) {
    brokerName = 'Mubasher';
  } else if (/HERMES/i.test(text)) {
    brokerName = 'EFG Hermes';
  } else if (/CI CAPITAL/i.test(text)) {
    brokerName = 'CI Capital';
  } else if (/TELDA/i.test(text) || /order review/i.test(text) || /@\s*T\+[0-2]/i.test(text) || /Report issue/i.test(text)) {
    brokerName = 'Telda';
  }

  // 2. Detect Action (BUY / SELL)
  let type: 'BUY' | 'SELL' = 'BUY';
  const headerAction = text.match(/(?:^|\n)\s*(Sell|Buy)\s+[A-Z]{2,6}\b/i);
  if (headerAction) {
    type = /^Sell/i.test(headerAction[1]) ? 'SELL' : 'BUY';
  } else if (/\b(SELL|SOLD|LIMIT SELL|MARKET SELL|T\+0 SELL|T\+2 SELL|بيع)\b/i.test(text)) {
    type = 'SELL';
  } else if (/\b(BUY|BOUGHT|LIMIT BUY|MARKET BUY|شراء)\b/i.test(text)) {
    type = 'BUY';
  }

  // 3. Detect Ticker
  let detectedTicker = '';
  let matchedTickerObj: EGXTicker | undefined;

  // 3a. Header: "Sell [TICKER]" or "Buy [TICKER]" (e.g. "Sell EFIC", "Buy COMI")
  const buySellHeader = text.match(/(?:^|\n|\b)(?:buy|sell)\s+([A-Z]{2,6})\b/i);
  if (buySellHeader) {
    const candidate = buySellHeader[1].toUpperCase();
    const found = tickers.find((t) => t.ticker.toUpperCase() === candidate);
    if (found) {
      detectedTicker = found.ticker;
      matchedTickerObj = found;
    } else {
      detectedTicker = candidate;
    }
  }

  // 3b. Header: "[TICKER] order review" or "[TICKER] receipt" (e.g. "MPCO order review", "ORHD order review")
  if (!detectedTicker) {
    const orderReviewMatch = text.match(/([A-Z]{2,6})\s+(?:order\s+review|review|receipt)/i);
    if (orderReviewMatch) {
      const candidate = orderReviewMatch[1].toUpperCase();
      const found = tickers.find((t) => t.ticker.toUpperCase() === candidate);
      if (found) {
        detectedTicker = found.ticker;
        matchedTickerObj = found;
      } else {
        detectedTicker = candidate;
      }
    }
  }

  // 3c. Direct ticker match against EGX dictionary
  if (!detectedTicker) {
    const sortedTickers = [...tickers].sort((a, b) => b.ticker.length - a.ticker.length);
    for (const t of sortedTickers) {
      const regex = new RegExp(`\\b${t.ticker}\\b`, 'i');
      if (regex.test(text)) {
        detectedTicker = t.ticker;
        matchedTickerObj = t;
        break;
      }
    }
  }

  // 3d. Check company names
  if (!detectedTicker) {
    for (const t of tickers) {
      if (t.nameEn && t.nameEn.length > 4 && upper.includes(t.nameEn.toUpperCase())) {
        detectedTicker = t.ticker;
        matchedTickerObj = t;
        break;
      }
    }
  }

  // 4. Detect Shares / Quantity
  let shares = 0;
  const sharesMatch =
    // Telda pattern: "Shares 50 @ T+0", "Shares: 50", "Shares \n 50 @ T+0"
    text.match(/(?:shares|share|quantity|qty|units)[\s:]*(\d[\d,]*)(?:\s*@\s*T\+[0-2])?/i) ||
    // Distinctive Telda settlement tag: "50 @ T+0", "8000 @ T+0", "575 @ T+2"
    text.match(/(\d[\d,]*)\s*@\s*T\+[0-2]/i) ||
    // "8000 shares @ EGP 2.6" or "50 shares"
    text.match(/(\d[\d,]*)\s*(?:shares|share|سهما|سهم)/i) ||
    text.match(/fulfilled\s*\(?(\d[\d,]*)\s*shares\)?/i);

  if (sharesMatch) {
    shares = parseInt(sharesMatch[1].replace(/,/g, ''), 10) || 0;
  }

  // 5. Detect Price
  let price = 0;
  const priceMatch =
    // "Price EGP 217.9", "Average execution price EGP 2.60", "Limit Sell @ EGP 2.60"
    text.match(/(?:average\s*execution\s*price|avg\s*execution\s*price|execution\s*price|avg\s*price|exec\s*price|limit\s*price|\bprice\b|سعر)[^\d\n\r]{0,40}?(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) ||
    // "8000 shares @ EGP 2.6" or "50 @ EGP 217.9"
    text.match(/(?:shares|share)[^\d\n\r]{0,30}?@\s*(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) ||
    // "@ EGP 2.60" (exclude @ T+0)
    text.match(/@\s*(?:EGP|LE|ج\.م)\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) ||
    text.match(/([0-9]+(?:[\.,][0-9]{1,4})?)\s*(?:EGP|LE)\s*\/\s*share/i);

  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(/,/g, '.')) || 0;
  }

  // 6. Detect Fees / Commission
  let fees = 0;
  const feesMatch = text.match(/(?:total\s*fees|\bfees\b|\bfee\b|commission|commissions|charges|مصاريف|عمولة)[^\d\n\r]{0,35}?(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i);
  if (feesMatch) {
    fees = parseFloat(feesMatch[1].replace(/,/g, '.')) || 0;
  }

  // 7. Detect Total Amount
  let totalAmount = 0;
  const totalMatch = text.match(/\bTotal(?!\s*fees|\s*fee)[^\d\n\r]{0,35}?(?:EGP|LE|ج\.م)?\s*([0-9][0-9,]*(?:[\.,][0-9]{1,2})?)/i);
  if (totalMatch) {
    totalAmount = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
  }

  // Cross-validation & Mathematical Recovery:
  if (shares > 0 && totalAmount > 0 && price === 0) {
    const gross = type === 'SELL' ? (totalAmount + (fees || 0)) : (totalAmount - (fees || 0));
    price = parseFloat((gross / shares).toFixed(2));
  } else if (price > 0 && totalAmount > 0 && shares === 0) {
    const gross = type === 'SELL' ? (totalAmount + (fees || 0)) : (totalAmount - (fees || 0));
    shares = Math.round(gross / price);
  }

  if (shares > 0 && price > 0 && fees === 0 && totalAmount > 0) {
    const expectedGross = shares * price;
    const diff = Math.abs(totalAmount - expectedGross);
    if (diff > 0.01 && diff < expectedGross * 0.1) {
      fees = parseFloat(diff.toFixed(2));
    }
  }

  // 8. Detect Date
  let date = getTodayISO();
  // Match "10 Sep 2026", "10 Sep 26", "10/09/2026", "2026-09-10"
  const dmyMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  const textDateMatch = text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i);
  const isoMatch = text.match(/(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);

  if (textDateMatch) {
    date = dmyToIso(textDateMatch[1]);
  } else if (dmyMatch) {
    date = dmyToIso(dmyMatch[1]);
  } else if (isoMatch) {
    date = dmyToIso(isoMatch[1]);
  }

  if (!detectedTicker && shares === 0 && price === 0) {
    return null;
  }

  return {
    ticker: detectedTicker || 'EGX',
    companyName: matchedTickerObj ? matchedTickerObj.nameEn : detectedTicker,
    sector: (matchedTickerObj?.sector as Sector) || 'Banking',
    type,
    shares,
    price,
    fees,
    date,
    brokerName,
    notes: `${brokerName} ${type === 'BUY' ? 'Buy' : 'Sell'} • OCR Scanned`,
    confidenceScore: detectedTicker && shares > 0 && price > 0 ? 95 : 75,
    rawOcrText: text.trim().slice(0, 300),
  };
}

let tesseractWorker: any = null;

/**
 * Runs free offline Optical Character Recognition (OCR) on an image using Tesseract.js in the browser.
 */
export async function recognizeTradeScreenshot(
  imageSource: string | File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  try {
    if (!tesseractWorker) {
      tesseractWorker = await createWorker('eng');
    }
    const result = await tesseractWorker.recognize(imageSource);
    if (onProgress) onProgress(100);
    return result.data?.text || '';
  } catch (err) {
    console.warn('Tesseract worker error, initializing fresh worker:', err);
    try {
      const freshWorker = await createWorker('eng');
      const result = await freshWorker.recognize(imageSource);
      tesseractWorker = freshWorker;
      return result.data?.text || '';
    } catch (fallbackErr) {
      console.error('OCR recognition error:', fallbackErr);
      return '';
    }
  }
}
