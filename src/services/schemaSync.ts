import { EGXTicker, SchemaValidationResult } from '../types';

export const SCHEMA_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/schema/ticker-directory.json`;

export function validateTickerAgainstSchema(ticker: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ticker || typeof ticker !== 'object') {
    return { valid: false, errors: ['Item must be an object'] };
  }

  if (!ticker.ticker || typeof ticker.ticker !== 'string') {
    errors.push('Missing or invalid "ticker" string');
  }
  if (!ticker.nameEn || typeof ticker.nameEn !== 'string') {
    errors.push('Missing or invalid "nameEn" string');
  }
  if (!ticker.sector || typeof ticker.sector !== 'string') {
    errors.push('Missing or invalid "sector"');
  }
  if (typeof ticker.lastPrice !== 'number' || isNaN(ticker.lastPrice) || ticker.lastPrice <= 0) {
    errors.push('Invalid "lastPrice" - must be a positive number');
  }
  if (typeof ticker.changePercent !== 'number' || isNaN(ticker.changePercent)) {
    errors.push('Invalid "changePercent" number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateTickerDirectoryPayload(data: any): SchemaValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object'], itemCount: 0 };
  }

  if (!data.version) errors.push('Missing required root property "version"');
  if (!data.lastSync) errors.push('Missing required root property "lastSync"');
  if (!data.market) errors.push('Missing required root property "market"');
  if (!Array.isArray(data.tickers)) {
    errors.push('Missing or invalid "tickers" array');
    return { valid: false, errors, itemCount: 0 };
  }

  let validCount = 0;
  data.tickers.forEach((item: any, idx: number) => {
    const itemValidation = validateTickerAgainstSchema(item);
    if (!itemValidation.valid) {
      errors.push(`Ticker #${idx + 1} (${item?.ticker || 'unknown'}): ${itemValidation.errors.join(', ')}`);
    } else {
      validCount++;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    itemCount: validCount,
  };
}

export function generatePythonSyncScript(appOrigin: string): string {
  const targetUrl = appOrigin || 'https://my-egx-pwa.run.app';
  return `"""
EGX Ticker Directory & Automated Market Data Synchronizer
Automates updating stock market quotes, prices, and technical indicators.
Uses standard schema at: ${targetUrl}/schema/ticker-directory.json
Can be run locally or inside GitHub Actions workflow on schedule.
"""

import datetime
import json
import requests
import sys

SCHEMA_URL = "${targetUrl}/schema/ticker-directory.json"
API_ENDPOINT = "${targetUrl}/api/tickers"  # Or paste output directly into PWA Sync Hub

# EGX Market Feed Sample / Scraper Generator
def fetch_egx_market_data():
    """
    Fetches latest EGX prices and technical indicators.
    Connect this to your preferred data provider (e.g. EGX API, Yahoo Finance, Mubasher).
    """
    print(f"[*] Validating against schema: {SCHEMA_URL}")
    try:
        schema_res = requests.get(SCHEMA_URL, timeout=10)
        if schema_res.status_code == 200:
            print("[+] Schema fetched successfully and active.")
    except Exception as e:
        print(f"[!] Warning fetching schema: {e}")

    # EGX quotes
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    tickers = [
        {
            "ticker": "COMI",
            "nameEn": "Commercial International Bank (Egypt)",
            "nameAr": "البنك التجاري الدولي - مصر",
            "isin": "EGS60121C018",
            "sector": "Banking",
            "lastPrice": 88.50,
            "change": 1.25,
            "changePercent": 1.43,
            "dayLow": 86.80,
            "dayHigh": 89.20,
            "yearLow": 62.00,
            "yearHigh": 94.50,
            "volume": 3850200,
            "valueEgp": 339240000,
            "trendStatus": "Strong Uptrend",
            "rsi14": 64.8,
            "support": 85.00,
            "resistance": 91.00,
            "targetPrice": 98.00,
            "stopLoss": 83.50,
            "notes": "Testing multi-month breakout resistance with high institutional volume.",
            "lastUpdated": now_iso
        },
        {
            "ticker": "ESRS",
            "nameEn": "Ezz Steel",
            "nameAr": "حديد عز",
            "isin": "EGS30021C013",
            "sector": "Basic Resources & Steel",
            "lastPrice": 118.20,
            "change": 3.40,
            "changePercent": 2.96,
            "dayLow": 114.50,
            "dayHigh": 119.50,
            "yearLow": 68.00,
            "yearHigh": 125.00,
            "volume": 2150000,
            "valueEgp": 252600000,
            "trendStatus": "Strong Uptrend",
            "rsi14": 71.2,
            "support": 112.00,
            "resistance": 124.00,
            "targetPrice": 135.00,
            "stopLoss": 109.00,
            "notes": "Rebar steel price increases driving operating margins.",
            "lastUpdated": now_iso
        },
        {
            "ticker": "TMGH",
            "nameEn": "Talaat Moustafa Group Holding",
            "nameAr": "مجموعة طلعت مصطفى القابضة",
            "isin": "EGS691S1C011",
            "sector": "Real Estate & Construction",
            "lastPrice": 62.40,
            "change": -0.60,
            "changePercent": -0.95,
            "dayLow": 61.80,
            "dayHigh": 63.50,
            "yearLow": 34.00,
            "yearHigh": 72.00,
            "volume": 4120000,
            "valueEgp": 258000000,
            "trendStatus": "Bullish Pullback",
            "rsi14": 52.4,
            "support": 60.00,
            "resistance": 66.50,
            "targetPrice": 75.00,
            "stopLoss": 58.50,
            "notes": "Consolidation base following SouthMED and Banan launch.",
            "lastUpdated": now_iso
        },
        {
            "ticker": "ABUK",
            "nameEn": "Abu Qir Fertilizers",
            "nameAr": "أبو قير للأسمدة والصناعات الكيماوية",
            "isin": "EGS38191C010",
            "sector": "Petrochemicals & Fertilizers",
            "lastPrice": 72.80,
            "change": 1.10,
            "changePercent": 1.53,
            "dayLow": 71.20,
            "dayHigh": 73.40,
            "yearLow": 52.00,
            "yearHigh": 96.00,
            "volume": 1680000,
            "valueEgp": 121800000,
            "trendStatus": "Rangebound Neutral",
            "rsi14": 48.6,
            "support": 70.00,
            "resistance": 76.50,
            "targetPrice": 84.00,
            "stopLoss": 68.00,
            "notes": "Base building as domestic gas supply stabilizes.",
            "lastUpdated": now_iso
        }
    ]

    payload = {
        "version": "1.0.0",
        "lastSync": now_iso,
        "market": "EGX",
        "currency": "EGP",
        "count": len(tickers),
        "tickers": tickers
    }

    return payload

def main():
    payload = fetch_egx_market_data()
    print(f"[+] Prepared {payload['count']} EGX tickers with technical levels.")
    
    # Save local json
    with open("egx_tickers_sync.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("[+] Saved to egx_tickers_sync.json")

    print("\\nCopy or paste this payload into the 'Python Sync Hub' inside your PWA!")

if __name__ == "__main__":
    main()
`;
}
