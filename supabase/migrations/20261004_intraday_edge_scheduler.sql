-- Stage 3.5 remediation: make Supabase pg_cron + Edge Function the
-- authoritative current-session intraday scheduler.
--
-- The Edge Function remains the only scheduled writer. GitHub's 1m workflow
-- is retained as a manual repair/diagnostic path.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.market_data_ingestion_lease (
  name text primary key,
  owner text,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.market_data_ingestion_lease(name, owner, locked_until)
values ('intraday', null, null)
on conflict (name) do nothing;

alter table public.market_data_ingestion_lease enable row level security;

create table if not exists public.market_data_ingestion_runs (
  id uuid primary key,
  scheduler text not null,
  target_session_date date not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ticker_count integer not null default 0,
  raw_rows_written integer not null default 0,
  derived_rows_written integer not null default 0,
  daily_rows_written integer not null default 0,
  failures jsonb not null default '[]'::jsonb
);

alter table public.market_data_ingestion_runs enable row level security;

create or replace function public.try_acquire_intraday_writer_lease(
  p_owner text,
  p_ttl_seconds integer default 240
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_owner is null or btrim(p_owner) = '' then
    raise exception 'writer owner is required';
  end if;

  update public.market_data_ingestion_lease
  set owner = p_owner,
      locked_until = now() + make_interval(secs => greatest(30, least(p_ttl_seconds, 600))),
      updated_at = now()
  where name = 'intraday'
    and (
      locked_until is null
      or locked_until < now()
      or owner = p_owner
    );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_intraday_writer_lease(
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.market_data_ingestion_lease
  set owner = null,
      locked_until = null,
      updated_at = now()
  where name = 'intraday'
    and owner = p_owner;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on table public.market_data_ingestion_lease from public, anon, authenticated;
revoke all on table public.market_data_ingestion_runs from public, anon, authenticated;
grant all on table public.market_data_ingestion_lease to service_role;
grant all on table public.market_data_ingestion_runs to service_role;

revoke execute on function public.try_acquire_intraday_writer_lease(text, integer)
  from public, anon, authenticated;
revoke execute on function public.release_intraday_writer_lease(text)
  from public, anon, authenticated;
grant execute on function public.try_acquire_intraday_writer_lease(text, integer)
  to service_role;
grant execute on function public.release_intraday_writer_lease(text)
  to service_role;

-- Vault entries are provisioned separately in production:
--   egx_project_url
--   egx_cron_anon_key
--
-- Using Vault keeps even the public anon JWT out of repository SQL and makes
-- key rotation independent from source history.

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'egx-intraday-edge-sync';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'egx-intraday-edge-sync',
  '*/5 7-13 * * 0-4',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'egx_project_url'
      ) || '/functions/v1/egx-intraday-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'egx_cron_anon_key'
        )
      ),
      body := jsonb_build_object('scheduler', 'pg_cron'),
      timeout_milliseconds := 240000
    ) as request_id;
  $cron$
);
