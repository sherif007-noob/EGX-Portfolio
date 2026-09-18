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
  executedAt?: string;
  brokerName: string;
  notes: string;
  confidenceScore: number;
  rawOcrText?: string;
}

export function parseTradeText(rawText: string, tickers: EGXTicker[]): Partial<ParsedOcrTrade> | null {
  if (!rawText || rawText.trim().length === 0) return null;
  const text = rawText.replace(/\r\n/g, '\n').replace(/[ⓘℹ️©®]/g, ' ').replace(/\b(E6P|EGR|ECP)\b/gi, 'EGP');
  const upper = text.toUpperCase();
  let brokerName = 'Telda';
  if (/THNDR|THUNDER/i.test(text)) brokerName = 'Thndr';
  else if (/MUBASHER/i.test(text)) brokerName = 'Mubasher';
  else if (/HERMES/i.test(text)) brokerName = 'EFG Hermes';
  else if (/CI CAPITAL/i.test(text)) brokerName = 'CI Capital';
  else if (/TELDA/i.test(text) || /order review/i.test(text) || /@\s*T\+[0-2]/i.test(text) || /Report issue/i.test(text)) brokerName = 'Telda';

  let type: 'BUY' | 'SELL' = 'BUY';
  const headerAction = text.match(/(?:^|\n)\s*(Sell|Buy)\s+[A-Z]{2,6}\b/i);
  if (headerAction) type = /^Sell/i.test(headerAction[1]) ? 'SELL' : 'BUY';
  else if (/\b(SELL|SOLD|LIMIT SELL|MARKET SELL|T\+0 SELL|T\+2 SELL|بيع)\b/i.test(text)) type = 'SELL';
  else if (/\b(BUY|BOUGHT|LIMIT BUY|MARKET BUY|شراء)\b/i.test(text)) type = 'BUY';

  let detectedTicker = '';
  let matchedTickerObj: EGXTicker | undefined;
  const buySellHeader = text.match(/(?:^|\n|\b)(?:buy|sell)\s+([A-Z]{2,6})\b/i);
  if (buySellHeader) {
    const candidate = buySellHeader[1].toUpperCase();
    const found = tickers.find(t => t.ticker.toUpperCase() === candidate);
    if (found) { detectedTicker = found.ticker; matchedTickerObj = found; } else detectedTicker = candidate;
  }
  if (!detectedTicker) {
    const orderReviewMatch = text.match(/([A-Z]{2,6})\s+(?:order\s+review|review|receipt)/i);
    if (orderReviewMatch) {
      const candidate = orderReviewMatch[1].toUpperCase();
      const found = tickers.find(t => t.ticker.toUpperCase() === candidate);
      if (found) { detectedTicker = found.ticker; matchedTickerObj = found; } else detectedTicker = candidate;
    }
  }
  if (!detectedTicker) {
    for (const t of [...tickers].sort((a, b) => b.ticker.length - a.ticker.length)) {
      if (new RegExp(`\\b${t.ticker}\\b`, 'i').test(text)) { detectedTicker = t.ticker; matchedTickerObj = t; break; }
    }
  }
  if (!detectedTicker) {
    for (const t of tickers) {
      if (t.nameEn && t.nameEn.length > 4 && upper.includes(t.nameEn.toUpperCase())) { detectedTicker = t.ticker; matchedTickerObj = t; break; }
    }
  }

  let shares = 0;
  const sharesMatch = text.match(/(?:shares|share|quantity|qty|units)[\s:]*(\d[\d,]*)(?:\s*@\s*T\+[0-2])?/i) || text.match(/(\d[\d,]*)\s*@\s*T\+[0-2]/i) || text.match(/(\d[\d,]*)\s*(?:shares|share|سهما|سهم)/i) || text.match(/fulfilled\s*\(?(\d[\d,]*)\s*shares\)?/i);
  if (sharesMatch) shares = parseInt(sharesMatch[1].replace(/,/g, ''), 10) || 0;

  let price = 0;
  const priceMatch = text.match(/(?:average\s*execution\s*price|avg\s*execution\s*price|execution\s*price|avg\s*price|exec\s*price|limit\s*price|\bprice\b|سعر)[^\d\n\r]{0,40}?(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) || text.match(/(?:shares|share)[^\d\n\r]{0,30}?@\s*(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) || text.match(/@\s*(?:EGP|LE|ج\.م)\s*([0-9]+(?:[\.,][0-9]{1,4})?)/i) || text.match(/([0-9]+(?:[\.,][0-9]{1,4})?)\s*(?:EGP|LE)\s*\/\s*share/i);
  if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, '.')) || 0;

  let fees = 0;
  const feesMatch = text.match(/(?:total\s*fees|\bfees\b|\bfee\b|commission|commissions|charges|مصاريف|عمولة)[^\d\n\r]{0,35}?(?:EGP|LE|ج\.م)?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i);
  if (feesMatch) fees = parseFloat(feesMatch[1].replace(/,/g, '.')) || 0;
  let totalAmount = 0;
  const totalMatch = text.match(/\bTotal(?!\s*fees|\s*fee)[^\d\n\r]{0,35}?(?:EGP|LE|ج\.م)?\s*([0-9][0-9,]*(?:[\.,][0-9]{1,2})?)/i);
  if (totalMatch) totalAmount = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
  if (shares > 0 && totalAmount > 0 && price === 0) {
    const gross = type === 'SELL' ? totalAmount + fees : totalAmount - fees;
    price = parseFloat((gross / shares).toFixed(2));
  } else if (price > 0 && totalAmount > 0 && shares === 0) {
    const gross = type === 'SELL' ? totalAmount + fees : totalAmount - fees;
    shares = Math.round(gross / price);
  }
  if (shares > 0 && price > 0 && fees === 0 && totalAmount > 0) {
    const diff = Math.abs(totalAmount - shares * price);
    if (diff > 0.01 && diff < shares * price * 0.1) fees = parseFloat(diff.toFixed(2));
  }

  let date = getTodayISO();
  const dmyMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  const textDateMatch = text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i);
  const isoMatch = text.match(/(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
  if (textDateMatch) date = dmyToIso(textDateMatch[1]);
  else if (dmyMatch) date = dmyToIso(dmyMatch[1]);
  else if (isoMatch) date = dmyToIso(isoMatch[1]);

  let executedAt: string | undefined;
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = timeMatch[3] ? Number(timeMatch[3]) : 0;
    const meridiem = timeMatch[4]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes <= 59 && seconds <= 59) {
      executedAt = `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  if (!detectedTicker && shares === 0 && price === 0) return null;
  return {
    ticker: detectedTicker || 'EGX',
    companyName: matchedTickerObj ? matchedTickerObj.nameEn : detectedTicker,
    sector: (matchedTickerObj?.sector as Sector) || 'Banking',
    type,
    shares,
    price,
    fees,
    date,
    executedAt,
    brokerName,
    notes: `${brokerName} ${type === 'BUY' ? 'Buy' : 'Sell'} • OCR Scanned`,
    confidenceScore: detectedTicker && shares > 0 && price > 0 ? 95 : 75,
    rawOcrText: text.trim().slice(0, 300),
  };
}

let tesseractWorker: any = null;
export async function recognizeTradeScreenshot(imageSource: string | File | Blob, onProgress?: (percent: number) => void): Promise<string> {
  try {
    if (!tesseractWorker) tesseractWorker = await createWorker('eng');
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
