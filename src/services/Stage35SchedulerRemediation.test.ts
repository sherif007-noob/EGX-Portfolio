import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 3.5 scheduler remediation', () => {
  it('moves production cadence to Supabase cron and leaves GitHub manual-only', () => {
    const workflow = read('.github/workflows/intraday-1m-sync.yml');
    const migration = read('supabase/migrations/20261004_intraday_edge_scheduler.sql');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('schedule:');
    expect(workflow).toContain("EGX_INTRADAY_SCHEDULED: 'false'");

    expect(migration).toContain('create extension if not exists pg_cron');
    expect(migration).toContain('create extension if not exists pg_net');
    expect(migration).toContain("'*/5 7-13 * * 0-4'");
    expect(migration).toContain('net.http_post');
    expect(migration).toContain('egx-intraday-scheduler');
  });

  it('serializes the Edge writer with a database lease', () => {
    const migration = read('supabase/migrations/20261004_intraday_edge_scheduler.sql');
    const edge = read('supabase/functions/egx-intraday-scheduler/index.ts');

    expect(migration).toContain('market_data_ingestion_lease');
    expect(migration).toContain('try_acquire_intraday_writer_lease');
    expect(migration).toContain('release_intraday_writer_lease');
    expect(edge).toContain('try_acquire_intraday_writer_lease');
    expect(edge).toContain('release_intraday_writer_lease');
  });

  it('writes raw 1m, derives 5m, and advances daily history after close', () => {
    const edge = read('supabase/functions/egx-intraday-scheduler/index.ts');

    expect(edge).toContain('interval_minutes: RAW_INTERVAL');
    expect(edge).toContain('source: "tradingview"');
    expect(edge).toContain('aggregateFiveMinute');
    expect(edge).toContain('source: "derived-1m"');
    expect(edge).toContain('aggregateDaily');
    expect(edge).toContain('.from("price_history")');
  });

  it('uses the same session-relevant universe shape as the Node writer', () => {
    const edge = read('supabase/functions/egx-intraday-scheduler/index.ts');

    expect(edge).toContain('.from("positions")');
    expect(edge).toContain('.from("transactions")');
    expect(edge).toContain('.eq("transaction_date", targetDate)');
    expect(edge).toContain('.from("ticker_registry")');
    expect(edge).toContain('history_symbol');
    expect(edge).toContain('scanner_symbol');
    expect(edge).toContain('isin');
  });

  it('records ingestion evidence for the Data Health Center', () => {
    const migration = read('supabase/migrations/20261004_intraday_edge_scheduler.sql');
    const edge = read('supabase/functions/egx-intraday-scheduler/index.ts');

    expect(migration).toContain('market_data_ingestion_runs');
    expect(edge).toContain('market_data_ingestion_runs');
    expect(edge).toContain('raw_rows_written');
    expect(edge).toContain('derived_rows_written');
    expect(edge).toContain('daily_rows_written');
  });
});
