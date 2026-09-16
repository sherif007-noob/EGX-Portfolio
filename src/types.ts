export type TrendStatus = 
  | 'Strong Uptrend'
  | 'Bullish Pullback'
  | 'Rangebound Neutral'
  | 'Bearish Breakdown'
  | 'Overextended';

export type Sector = 
  | 'Banking'
  | 'Real Estate & Construction'
  | 'Basic Resources & Steel'
  | 'Petrochemicals & Fertilizers'
  | 'Non-Bank Financial Services & Fintech'
  | 'Telecommunications & Tech'
  | 'Telecommunications & Media'
  | 'Food, Beverage & Agribusiness'
  | 'Food, Beverage & Tobacco'
  | 'Healthcare & Pharmaceuticals'
  | 'Industrial Goods & Services'
  | 'Building Materials & Cement'
  | 'Energy & Petrochemicals'
  | 'Energy & Oil Services'
  | 'Utilities & Logistics'
  | 'Transport & Logistics'
  | 'Consumer Goods & Automobiles'
  | 'Tourism & Leisure'
  | 'Textiles & Consumer Durables'
  | 'Education & Services'
  | 'Liquid Buying Power'
  | 'Other';

export interface EGXTicker {
  ticker: string;
  nameEn: string;
  nameAr: string;
  isin: string;
  sector: Sector;
  lastPrice: number;
  change: number;
  changePercent: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  volume: number;
  valueEgp: number;
  trendStatus: TrendStatus;
  rsi14: number;
  support: number;
  resistance: number;
  targetPrice: number;
  stopLoss: number;
  notes?: string;
  lastUpdated: string;
  priceUpdatedAt?: string;
  logoUrl?: string;
}

export interface Position {
  id: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  dayChange?: number;
  dayChangePercent?: number;
  buyDate: string;
  totalFees?: number;
  targetPrice?: number;
  stopLoss?: number;
  notes?: string;
  priceUpdatedAt?: string;
}

export interface ClosedTrade {
  id: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  buyPrice: number;
  sellPrice: number;
  buyDate: string;
  sellDate: string;
  holdingDays: number;
  realizedPnlEgp: number;
  realizedPnlPercent: number;
  buyFees?: number;
  sellFees?: number;
  totalFees?: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  tradeType: 'Swing' | 'Breakout' | 'Core' | 'Momentum';
  tradeCycle?: number;
  cycleTag?: string;
  notes?: string;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalMarketValue?: number;
  totalCost: number;
  totalCostWithFees?: number;
  unrealizedPnlEgp: number;
  unrealizedPnlPercent: number;
  grossUnrealizedPnlEgp?: number;
  grossUnrealizedPnlPercent?: number;
  realizedPnlEgp: number;
  cashBalance: number;
  dayChangeEgp: number;
  dayChangePercent: number;
  totalPositions: number;
  winningPositionsCount: number;
  losingPositionsCount: number;
  totalFeesPaid?: number;
  openFeesPaid?: number;
  closedFeesPaid?: number;
}

export interface PerformanceStats {
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgReturnPercent: number;
  avgHoldDays: number;
  bestTradePercent: number;
  worstTradePercent: number;
  totalRealizedGainEgp: number;
  totalRealizedLossEgp: number;
  totalBrokerageFeesPaid: number;
  sectorAllocation: { sector: Sector; value: number; percentage: number; count: number }[];
  maxDrawdownPercent?: number;
  maxDrawdownEgp?: number;
  payoffRatio?: number;
  expectancyEgp?: number;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  range: string;
  lastSyncTime?: string;
  connectedEmail?: string;
  autoSync: boolean;
}

export interface LivePriceQuote {
  ticker: string;
  price: number;
  change?: number;
  changePercent: number;
  volume: number;
  dayHigh?: number;
  dayLow?: number;
}

export interface PriceAlertSettings {
  enabled: boolean;
  notifyOnTarget: boolean;
  notifyOnStopLoss: boolean;
  notifyOnProximity: boolean;
  proximityPercent: number;
  cairoHoursOnly: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

export type PriceAlertTriggerType = 
  | 'TARGET_HIT' 
  | 'STOP_LOSS_HIT' 
  | 'TARGET_APPROACHING' 
  | 'STOP_LOSS_APPROACHING';

export interface TriggeredPriceAlert {
  id: string;
  ticker: string;
  companyName: string;
  type: PriceAlertTriggerType;
  currentPrice: number;
  thresholdPrice: number;
  distancePercent: number;
  timestamp: string;
  timeFormatted: string;
  read: boolean;
  shares?: number;
  notes?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  itemCount: number;
}

export interface CashTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  date: string;
  notes?: string;
  balanceAfter: number;
}

export interface TradeTransaction {
  id: string;
  type: 'BUY' | 'SELL';
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  price: number;
  date: string;
  executedAt?: string;
  fees: number;
  totalAmount: number;
  isDCA?: boolean;
  notes?: string;
  targetPrice?: number;
  stopLoss?: number;
  tradeId?: number | string;
  trade_id?: number | string;
  tradeCycle?: number;
  cycleTag?: string;
  runningShares?: number;
  grossTradeValue?: number;
  netCashImpact?: number;
  realizedPnlEgp?: number;
  realizedPnlPercent?: number;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  holdingDays?: number;
  positionId?: string;
}
