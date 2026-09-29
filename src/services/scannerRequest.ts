/** Positional scanner columns must match the decoder in every deployment. */
export const EGX_SCANNER_PAYLOAD = {
  filter: [], options: { lang: 'en' },
  symbols: { query: { types: [] }, tickers: [] },
  columns: ['name', 'description', 'logoid', 'close', 'change', 'change_abs',
    'volume', 'high', 'low', 'high_52_week', 'low_52_week', 'sector', 'RSI',
    'industry', 'isin', 'currency', 'average_volume_10d_calc', 'relative_volume_10d_calc', 'market_cap_basic'],
  sort: { sortBy: 'name', sortOrder: 'asc' }, range: [0, 500],
};
