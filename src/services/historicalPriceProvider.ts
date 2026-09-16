import { HistoricalPricePoint } from './historicalPriceStore';

export interface HistoricalPriceProvider {
  readonly name: 'tradingview' | 'yahoo' | 'other';
  getDailyHistory(ticker: string, startDate: string, endDate: string): Promise<HistoricalPricePoint[]>;
}

export interface HistoricalPriceRequest {
  tickers: string[];
  startDate: string;
  endDate: string;
}

export interface HistoricalPriceProviderResult {
  provider: HistoricalPriceProvider['name'];
  ticker: string;
  points: HistoricalPricePoint[];
  error?: string;
}
