import { Position, TradeTransaction, ClosedTrade, Sector } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTradeInput(input: {
  ticker: string;
  shares: number;
  price: number;
  fees?: number;
  type: 'BUY' | 'SELL';
  date: string;
  existingPosition?: Position;
  availableCash?: number;
  deductFromCash?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.ticker || !input.ticker.trim()) {
    errors.push('Stock ticker symbol is required.');
  }

  if (isNaN(input.shares) || input.shares <= 0) {
    errors.push('Number of shares must be a positive number greater than 0.');
  }

  if (isNaN(input.price) || input.price <= 0) {
    errors.push('Price per share must be greater than 0 EGP.');
  }

  if (input.fees !== undefined && (isNaN(input.fees) || input.fees < 0)) {
    errors.push('Brokerage fees cannot be negative.');
  }

  if (!input.date || isNaN(Date.parse(input.date))) {
    errors.push('Please specify a valid trade date.');
  } else {
    const tradeTime = new Date(input.date).getTime();
    const now = new Date().getTime();
    if (tradeTime > now + 86400000) {
      warnings.push('Trade date is set in the future.');
    }
  }

  // Validate SELL constraint
  if (input.type === 'SELL') {
    if (!input.existingPosition) {
      errors.push(`Cannot execute SELL trade for ${input.ticker}: No active open position found.`);
    } else if (input.shares > input.existingPosition.shares) {
      errors.push(
        `Cannot sell ${input.shares.toLocaleString()} shares of ${input.ticker}: Only ${input.existingPosition.shares.toLocaleString()} shares currently held.`
      );
    }
  }

  // Validate BUY cash constraint
  if (input.type === 'BUY' && input.deductFromCash && input.availableCash !== undefined) {
    const grossCost = input.shares * input.price;
    const totalOutlay = grossCost + (input.fees || 0);
    if (totalOutlay > input.availableCash) {
      warnings.push(
        `Trade outlay (${totalOutlay.toFixed(2)} EGP) exceeds available cash (${input.availableCash.toFixed(2)} EGP). Cash balance will become negative.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validatePortfolioInvariants(
  positions: Position[],
  transactions: TradeTransaction[],
  cashBalance: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (cashBalance < 0) {
    warnings.push(`Available cash balance is negative (${cashBalance.toFixed(2)} EGP).`);
  }

  positions.forEach((pos) => {
    if (pos.shares <= 0) {
      errors.push(`Position ${pos.ticker} has invalid zero or negative shares (${pos.shares}).`);
    }
    if (pos.avgBuyPrice <= 0) {
      errors.push(`Position ${pos.ticker} has invalid average buy price (${pos.avgBuyPrice}).`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
