-- Stage 7.1 benchmark registry contract.
-- price_history has a ticker FK, so benchmark indices must be first-class
-- market-data instruments before daily TradingView history can be persisted.

insert into public.tickers (
  ticker,
  name_en,
  name_ar,
  isin,
  sector,
  notes,
  logo_url
)
values
  (
    'EGX30',
    'EGX 30 Index',
    'مؤشر EGX 30',
    '',
    'Market Index',
    'Portfolio benchmark index; TradingView EGX:EGX30.',
    'https://s3-symbol-logo.tradingview.com/country/EG.svg'
  ),
  (
    'EGX70EWI',
    'EGX 70 EWI Index',
    'مؤشر EGX 70 متساوي الأوزان',
    '',
    'Market Index',
    'Portfolio benchmark index; TradingView EGX:EGX70EWI.',
    'https://s3-symbol-logo.tradingview.com/country/EG.svg'
  ),
  (
    'EGX100EWI',
    'EGX 100 EWI Index',
    'مؤشر EGX 100 متساوي الأوزان',
    '',
    'Market Index',
    'Portfolio benchmark index; TradingView EGX:EGX100EWI.',
    'https://s3-symbol-logo.tradingview.com/country/EG.svg'
  )
on conflict (ticker) do update
set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  sector = excluded.sector,
  notes = excluded.notes,
  logo_url = excluded.logo_url,
  updated_at = now();
