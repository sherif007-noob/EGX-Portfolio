-- Canonical atomic accounting snapshot RPC.
-- Reproduces the production persistence primitive used by both browser and server paths.

create or replace function public.replace_portfolio_accounting_snapshot(
  p_portfolio_id uuid,
  p_owner_key text,
  p_cash_balance numeric,
  p_capital_deposits numeric,
  p_transactions jsonb,
  p_positions jsonb,
  p_closed_trades jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_updated int;
  v_tx_count int;
  v_position_count int;
  v_closed_count int;
begin
  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'transactions payload must be a JSON array';
  end if;
  if p_positions is null or jsonb_typeof(p_positions) <> 'array' then
    raise exception 'positions payload must be a JSON array';
  end if;
  if p_closed_trades is null or jsonb_typeof(p_closed_trades) <> 'array' then
    raise exception 'closedTrades payload must be a JSON array';
  end if;
  if p_cash_balance is null or p_capital_deposits is null then
    raise exception 'cash balance and capital deposits are required';
  end if;
  if p_capital_deposits < 0 then
    raise exception 'capital deposits cannot be negative';
  end if;

  update public.portfolios
  set cash_balance = p_cash_balance,
      capital_deposits = p_capital_deposits,
      schema_version = 3,
      updated_at = v_now
  where id = p_portfolio_id
    and owner_key = p_owner_key;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Portfolio ownership check failed for portfolio %', p_portfolio_id;
  end if;

  -- UPDATE above already locks the row; FOR UPDATE makes the serialization intent explicit.
  perform 1
  from public.portfolios
  where id = p_portfolio_id
    and owner_key = p_owner_key
  for update;

  delete from public.transactions where portfolio_id = p_portfolio_id;
  delete from public.closed_trades where portfolio_id = p_portfolio_id;
  delete from public.positions where portfolio_id = p_portfolio_id;

  insert into public.transactions (
    id, portfolio_id, transaction_type, ticker, company_name, sector, shares, price,
    transaction_date, executed_at, fees, total_amount, cash_flow_type, cash_flow_amount,
    is_dca, notes, target_price, stop_loss, trade_id, trade_cycle, cycle_tag,
    running_shares, gross_trade_value, net_cash_impact, realized_pnl_egp,
    realized_pnl_percent, outcome, holding_days, position_id, created_at, updated_at
  )
  select
    x.id, p_portfolio_id, x.transaction_type, x.ticker,
    coalesce(x.company_name, ''), coalesce(x.sector, 'Other'), coalesce(x.shares, 0),
    coalesce(x.price, 0), x.transaction_date, x.executed_at, coalesce(x.fees, 0),
    coalesce(x.total_amount, 0), x.cash_flow_type, x.cash_flow_amount,
    coalesce(x.is_dca, false), x.notes, x.target_price, x.stop_loss, x.trade_id,
    x.trade_cycle, x.cycle_tag, x.running_shares, x.gross_trade_value,
    x.net_cash_impact, x.realized_pnl_egp, x.realized_pnl_percent, x.outcome,
    x.holding_days, x.position_id, coalesce(x.created_at, v_now), v_now
  from jsonb_to_recordset(p_transactions) as x(
    id text,
    transaction_type text,
    ticker text,
    company_name text,
    sector text,
    shares numeric,
    price numeric,
    transaction_date date,
    executed_at timestamptz,
    fees numeric,
    total_amount numeric,
    cash_flow_type text,
    cash_flow_amount numeric,
    is_dca boolean,
    notes text,
    target_price numeric,
    stop_loss numeric,
    trade_id text,
    trade_cycle integer,
    cycle_tag text,
    running_shares numeric,
    gross_trade_value numeric,
    net_cash_impact numeric,
    realized_pnl_egp numeric,
    realized_pnl_percent numeric,
    outcome text,
    holding_days integer,
    position_id text,
    created_at timestamptz
  );

  get diagnostics v_tx_count = row_count;

  insert into public.closed_trades (
    id, portfolio_id, ticker, company_name, sector, shares, buy_price, sell_price,
    buy_date, sell_date, holding_days, realized_pnl_egp, realized_pnl_percent,
    buy_fees, sell_fees, total_fees, outcome, trade_type, trade_cycle, cycle_tag,
    notes, buy_transaction_ids, sell_transaction_ids, created_at, updated_at
  )
  select
    x.id, p_portfolio_id, x.ticker, coalesce(x.company_name, ''), coalesce(x.sector, 'Other'),
    coalesce(x.shares, 0), coalesce(x.buy_price, 0), coalesce(x.sell_price, 0),
    x.buy_date, x.sell_date, coalesce(x.holding_days, 0), coalesce(x.realized_pnl_egp, 0),
    coalesce(x.realized_pnl_percent, 0), coalesce(x.buy_fees, 0), coalesce(x.sell_fees, 0),
    coalesce(x.total_fees, 0), coalesce(x.outcome, ''), coalesce(x.trade_type, ''),
    x.trade_cycle, x.cycle_tag, x.notes, coalesce(x.buy_transaction_ids, '{}'::text[]),
    coalesce(x.sell_transaction_ids, '{}'::text[]), coalesce(x.created_at, v_now), v_now
  from jsonb_to_recordset(p_closed_trades) as x(
    id text,
    ticker text,
    company_name text,
    sector text,
    shares numeric,
    buy_price numeric,
    sell_price numeric,
    buy_date date,
    sell_date date,
    holding_days integer,
    realized_pnl_egp numeric,
    realized_pnl_percent numeric,
    buy_fees numeric,
    sell_fees numeric,
    total_fees numeric,
    outcome text,
    trade_type text,
    trade_cycle integer,
    cycle_tag text,
    notes text,
    buy_transaction_ids text[],
    sell_transaction_ids text[],
    created_at timestamptz
  );

  get diagnostics v_closed_count = row_count;

  insert into public.positions (
    id, portfolio_id, ticker, company_name, sector, shares, avg_buy_price,
    current_price, day_change, day_change_percent, buy_date, total_fees,
    target_price, stop_loss, notes, price_updated_at, updated_at
  )
  select
    x.id, p_portfolio_id, x.ticker, coalesce(x.company_name, ''), coalesce(x.sector, 'Other'),
    coalesce(x.shares, 0), coalesce(x.avg_buy_price, 0), coalesce(x.current_price, 0),
    x.day_change, x.day_change_percent, x.buy_date, coalesce(x.total_fees, 0),
    x.target_price, x.stop_loss, x.notes, x.price_updated_at, v_now
  from jsonb_to_recordset(p_positions) as x(
    id text,
    ticker text,
    company_name text,
    sector text,
    shares numeric,
    avg_buy_price numeric,
    current_price numeric,
    day_change numeric,
    day_change_percent numeric,
    buy_date date,
    total_fees numeric,
    target_price numeric,
    stop_loss numeric,
    notes text,
    price_updated_at timestamptz
  );

  get diagnostics v_position_count = row_count;

  return jsonb_build_object(
    'success', true,
    'updatedAt', v_now,
    'transactionCount', v_tx_count,
    'positionCount', v_position_count,
    'closedTradeCount', v_closed_count
  );
end;
$function$;

revoke execute on function public.replace_portfolio_accounting_snapshot(
  uuid, text, numeric, numeric, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.replace_portfolio_accounting_snapshot(
  uuid, text, numeric, numeric, jsonb, jsonb, jsonb
) to authenticated, service_role;
