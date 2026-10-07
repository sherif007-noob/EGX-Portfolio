create table if not exists public.portfolio_audit_log (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  mutation_id text not null,
  mutation_kind text not null,
  entity_type text not null,
  entity_id text,
  ticker text,
  reason text,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint portfolio_audit_log_mutation_unique unique (portfolio_id, mutation_id)
);

create index if not exists portfolio_audit_log_portfolio_created_idx
  on public.portfolio_audit_log (portfolio_id, created_at desc);

create index if not exists portfolio_audit_log_ticker_created_idx
  on public.portfolio_audit_log (portfolio_id, ticker, created_at desc)
  where ticker is not null;

alter table public.portfolio_audit_log enable row level security;

revoke all on table public.portfolio_audit_log from public, anon;
grant select, insert on table public.portfolio_audit_log to authenticated;
grant select, insert on table public.portfolio_audit_log to service_role;

drop policy if exists "authenticated audit trail read" on public.portfolio_audit_log;
create policy "authenticated audit trail read"
  on public.portfolio_audit_log
  for select
  to authenticated
  using (
    portfolio_id in (
      select p.id
      from public.portfolios p
      where p.owner_key = auth.uid()::text
    )
  );

drop policy if exists "authenticated audit trail insert" on public.portfolio_audit_log;
create policy "authenticated audit trail insert"
  on public.portfolio_audit_log
  for insert
  to authenticated
  with check (
    portfolio_id in (
      select p.id
      from public.portfolios p
      where p.owner_key = auth.uid()::text
    )
  );

create or replace function public.replace_portfolio_accounting_snapshot_with_audit(
  p_portfolio_id uuid,
  p_owner_key text,
  p_cash_balance numeric,
  p_capital_deposits numeric,
  p_transactions jsonb,
  p_positions jsonb,
  p_closed_trades jsonb,
  p_audit_event jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_mutation_id text;
begin
  if p_audit_event is null or jsonb_typeof(p_audit_event) <> 'object' then
    raise exception 'audit event must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.portfolios
    where id = p_portfolio_id
      and owner_key = p_owner_key
  ) then
    raise exception 'Portfolio ownership check failed for portfolio %', p_portfolio_id;
  end if;

  v_mutation_id := nullif(btrim(p_audit_event ->> 'mutationId'), '');
  if v_mutation_id is null then
    raise exception 'audit event requires mutationId';
  end if;

  v_result := public.replace_portfolio_accounting_snapshot(
    p_portfolio_id,
    p_owner_key,
    p_cash_balance,
    p_capital_deposits,
    p_transactions,
    p_positions,
    p_closed_trades
  );

  insert into public.portfolio_audit_log (
    portfolio_id,
    mutation_id,
    mutation_kind,
    entity_type,
    entity_id,
    ticker,
    reason,
    before_state,
    after_state,
    metadata
  )
  values (
    p_portfolio_id,
    v_mutation_id,
    coalesce(nullif(btrim(p_audit_event ->> 'mutationKind'), ''), 'UNKNOWN_MUTATION'),
    coalesce(nullif(btrim(p_audit_event ->> 'entityType'), ''), 'PORTFOLIO_LEDGER'),
    nullif(btrim(p_audit_event ->> 'entityId'), ''),
    nullif(btrim(p_audit_event ->> 'ticker'), ''),
    nullif(btrim(p_audit_event ->> 'reason'), ''),
    coalesce(p_audit_event -> 'beforeState', '{}'::jsonb),
    coalesce(p_audit_event -> 'afterState', '{}'::jsonb),
    coalesce(p_audit_event -> 'metadata', '{}'::jsonb)
  )
  on conflict (portfolio_id, mutation_id) do nothing;

  return coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'auditRecorded', true,
      'auditMutationId', v_mutation_id
    );
end;
$function$;

revoke execute on function public.replace_portfolio_accounting_snapshot_with_audit(
  uuid, text, numeric, numeric, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.replace_portfolio_accounting_snapshot_with_audit(
  uuid, text, numeric, numeric, jsonb, jsonb, jsonb, jsonb
) to authenticated, service_role;
