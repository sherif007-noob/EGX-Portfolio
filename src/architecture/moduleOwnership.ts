export const MODULE_OWNERSHIP = {
  domain: {
    accounting: {
      root: 'src/domain/accounting',
      owns: [
        'ledger mutation semantics',
        'reconciliation and cost basis',
        'cash-flow semantics',
        'derived position/closed-cycle ownership',
      ],
    },
    performance: {
      root: 'src/domain/performance',
      owns: [
        'portfolio performance metrics',
        'equity bridge',
        'unified analytics calculations',
      ],
    },
    market: {
      root: 'src/domain/market',
      owns: [
        'ticker identity and resolution',
        'position quote selection',
        'historical market-price access',
      ],
    },
  },
  data: {
    supabase: {
      root: 'src/data/supabase',
      owns: ['Supabase client and persistence adapters'],
    },
  },
  integrations: {
    googleSheets: {
      root: 'src/integrations/google-sheets',
      owns: ['Google Sheets synchronization'],
    },
    ocr: {
      root: 'src/integrations/ocr',
      owns: ['OCR import preparation boundary'],
    },
    tradingView: {
      root: 'src/integrations/tradingview',
      owns: ['TradingView transport/adapters'],
    },
  },
  features: {
    portfolio: 'src/features/portfolio',
    trades: 'src/features/trades',
    cash: 'src/features/cash',
    reports: 'src/features/reports',
    journal: 'src/features/journal',
    directory: 'src/features/directory',
    alerts: 'src/features/alerts',
    scanner: 'src/features/scanner',
  },
  ui: {
    primitives: 'src/ui/primitives',
    overlays: 'src/ui/overlays',
    charts: 'src/ui/charts',
  },
} as const;

export type ModuleOwnership = typeof MODULE_OWNERSHIP;
