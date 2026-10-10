import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import WebSocket from "npm:ws@8.18.3";
import { createChart, createSeries } from "npm:@ch99q/twc@0.1.4";

const TZ = "Africa/Cairo";
const SESSION_START_MINUTE = 10 * 60;
const SESSION_END_MINUTE = 14 * 60 + 30;
const INGESTION_END_MINUTE = 15 * 60 + 15;
const RAW_INTERVAL = 1;
const DERIVED_INTERVAL = 5;
const SERIES_BARS = 480;
const TRADING_DAYS = new Set(["Sun", "Mon", "Tue", "Wed", "Thu"]);

type Bar = [number, number, number, number, number, number?];

type CairoClock = {
  dateKey: string;
  weekday: string;
  minuteOfDay: number;
  isTradingWeekday: boolean;
};

function cairoClock(date = new Date()): CairoClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday,
    minuteOfDay: hour * 60 + minute,
    isTradingWeekday: TRADING_DAYS.has(weekday),
  };
}

function addUtcDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cairoDateKey(timestamp: string | number): string {
  const d = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function cairoMinuteOfDay(timestamp: string | number): number {
  const d = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  return get("hour") * 60 + get("minute");
}

function cleanTicker(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/^EGX:/, "").replace(/\.CA$/, "");
}

function validRawBar(bar: Bar, targetDate: string, nowMs: number) {
  const ts = Number(bar?.[0]) * 1000;
  const open = Number(bar?.[1]);
  const high = Number(bar?.[2]);
  const low = Number(bar?.[3]);
  const close = Number(bar?.[4]);
  if (
    !Number.isFinite(ts) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high) ||
    cairoDateKey(ts) !== targetDate
  ) return false;

  const minute = cairoMinuteOfDay(ts);
  if (minute < SESSION_START_MINUTE || minute >= SESSION_END_MINUTE) return false;
  return ts + 60_000 <= nowMs;
}

function rawRow(ticker: string, bar: Bar, retrievedAt: string) {
  return {
    ticker,
    interval_minutes: RAW_INTERVAL,
    bar_timestamp: new Date(Number(bar[0]) * 1000).toISOString(),
    open: Number(bar[1]),
    high: Number(bar[2]),
    low: Number(bar[3]),
    close: Number(bar[4]),
    volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null,
    source: "tradingview",
    retrieved_at: retrievedAt,
  };
}

function aggregateFiveMinute(rows: any[], ticker: string, retrievedAt: string) {
  const buckets = new Map<number, any[]>();
  for (const row of rows) {
    const ms = new Date(row.bar_timestamp).getTime();
    const bucket = Math.floor(ms / 300_000) * 300_000;
    const list = buckets.get(bucket) ?? [];
    list.push(row);
    buckets.set(bucket, list);
  }

  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([bucket, list]) => {
    list.sort((a, b) => String(a.bar_timestamp).localeCompare(String(b.bar_timestamp)));
    const first = list[0];
    const last = list[list.length - 1];
    const volumes = list.map((row) => Number(row.volume)).filter(Number.isFinite);
    return {
      ticker,
      interval_minutes: DERIVED_INTERVAL,
      bar_timestamp: new Date(bucket).toISOString(),
      open: Number(first.open),
      high: Math.max(...list.map((row) => Number(row.high))),
      low: Math.min(...list.map((row) => Number(row.low))),
      close: Number(last.close),
      volume: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null,
      source: "derived-1m",
      retrieved_at: retrievedAt,
    };
  });
}

function aggregateDaily(rows: any[], ticker: string, targetDate: string, retrievedAt: string) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => String(a.bar_timestamp).localeCompare(String(b.bar_timestamp)));
  const volumes = sorted.map((row) => Number(row.volume)).filter(Number.isFinite);
  return {
    ticker,
    trading_date: targetDate,
    open: Number(sorted[0].open),
    high: Math.max(...sorted.map((row) => Number(row.high))),
    low: Math.min(...sorted.map((row) => Number(row.low))),
    close: Number(sorted.at(-1).close),
    volume: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null,
    source: "tradingview",
    retrieved_at: retrievedAt,
  };
}

async function resolveUniverse(sb: any, targetDate: string): Promise<string[]> {
  const [{ data: positions, error: positionError }, { data: trades, error: tradeError }] = await Promise.all([
    sb.from("positions").select("ticker,shares").gt("shares", 0),
    sb.from("transactions").select("ticker").eq("transaction_date", targetDate).neq("ticker", "CASH"),
  ]);
  if (positionError) throw new Error(`Position universe read failed: ${positionError.message}`);
  if (tradeError) throw new Error(`Session trade universe read failed: ${tradeError.message}`);
  return [...new Set([
    ...(positions ?? []).map((row: any) => cleanTicker(row.ticker)),
    ...(trades ?? []).map((row: any) => cleanTicker(row.ticker)),
  ].filter(Boolean))].sort();
}

async function resolveSymbol(chart: any, registry: any, ticker: string) {
  const candidates = [...new Set([
    cleanTicker(registry?.history_symbol),
    cleanTicker(registry?.scanner_symbol),
    ticker,
    String(registry?.isin ?? "").trim().toUpperCase(),
  ].filter(Boolean))];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await chart.resolve(candidate, "EGX");
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`TradingView resolution failed for ${ticker}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function loadSessionRaw(sb: any, ticker: string, targetDate: string) {
  const start = `${targetDate}T00:00:00.000Z`;
  const end = `${addUtcDays(targetDate, 1)}T00:00:00.000Z`;
  const { data, error } = await sb
    .from("intraday_price_history")
    .select("ticker,bar_timestamp,open,high,low,close,volume")
    .eq("ticker", ticker)
    .eq("interval_minutes", RAW_INTERVAL)
    .gte("bar_timestamp", start)
    .lt("bar_timestamp", end)
    .order("bar_timestamp", { ascending: true });

  if (error) throw new Error(`Persisted raw-session read failed for ${ticker}: ${error.message}`);
  return (data ?? []).filter((row: any) => cairoDateKey(String(row.bar_timestamp)) === targetDate);
}

class SessionEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }
  off(event: string, listener: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  removeListener(event: string, listener: (...args: any[]) => void) {
    return this.off(event, listener);
  }
  once(event: string, listener: (...args: any[]) => void) {
    const wrapped = (...args: any[]) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }
  emit(event: string, ...args: any[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

async function createDenoTradingViewSession() {
  const emitter = new SessionEmitter();
  const socket = new WebSocket(
    "wss://data.tradingview.com/socket.io/websocket?&type=chart",
    {
      headers: {
        Origin: "https://www.tradingview.com",
        "User-Agent": "Mozilla/5.0",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      followRedirects: true,
    },
  );

  let closed = false;
  let protocol: Record<string, unknown> | undefined;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("TradingView WebSocket connection timeout.")), 10_000);
    socket.once("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });

  const send = async (event: string, payload: any): Promise<void> => {
    if (closed || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send on closed TradingView session.");
    }
    const message = typeof payload === "string"
      ? payload
      : (() => {
          const json = JSON.stringify({ m: event, p: payload });
          return `~m~${json.length}~m~${json}`;
        })();
    await new Promise<void>((resolve, reject) => {
      socket.send(message, (error) => error ? reject(error) : resolve());
    });
  };

  const close = async () => {
    if (closed) return;
    closed = true;
    try { socket.close(); } catch { /* best effort */ }
    emitter.emit("close");
  };

  const session = Object.assign(emitter, {
    protocol: protocol ?? {},
    socket,
    send,
    close,
  });

  const protocolReady = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("TradingView protocol negotiation timeout.")), 10_000);

    socket.on("message", (data) => {
      const text = typeof data === "string" ? data : data.toString();
      const packets = text.split("~m~").filter(Boolean).reduce((acc: string[], packet: string, index: number) => {
        if (index % 2 === 0) acc.push("~m~" + packet);
        else acc[acc.length - 1] += "~m~" + packet;
        return acc;
      }, []);

      for (const raw of packets) {
        if (raw.includes("~m~~h~")) {
          const match = raw.match(/~m~(\d+)~m~~h~(\d+)/);
          if (match) void send("heartbeat", `~m~${match[1]}~m~~h~${match[2]}`);
          continue;
        }

        if (raw.includes('~m~{"session_id"')) {
          const match = raw.match(/~m~(\d+)~m~(.+)/);
          if (match) {
            protocol = JSON.parse(match[2]);
            (session as any).protocol = protocol;
            emitter.emit("protocol", protocol);
            clearTimeout(timeout);
            resolve();
          }
          continue;
        }

        const match = raw.match(/~m~(\d+)~m~(.+)/);
        if (!match) continue;
        const message = JSON.parse(match[2]);
        const event = message.m;
        const payload = message.p;
        emitter.emit("message", { event, payload });
        if (event && typeof event === "string") {
          if (event.includes("error")) emitter.emit("error", event, payload);
          else emitter.emit(event, payload);
        }
      }
    });

    socket.on("error", (error) => {
      emitter.emit("error", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    socket.on("close", () => void close());
  });

  await protocolReady;
  await send("set_auth_token", ["unauthorized_user_token"]);
  await send("set_locale", ["en", "US"]);
  return session as any;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  const now = new Date();
  const clock = cairoClock(now);
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;
  const dryRun = body?.dryRun === true;
  const targetDate = String(body?.targetDate || clock.dateKey).slice(0, 10);
  const scheduled = body?.scheduler === "pg_cron";

  if (!force) {
    if (!clock.isTradingWeekday) {
      return Response.json({ ok: true, skipped: true, reason: "non-trading weekday", clock });
    }
    if (clock.minuteOfDay < SESSION_START_MINUTE || clock.minuteOfDay > INGESTION_END_MINUTE) {
      return Response.json({ ok: true, skipped: true, reason: "outside Cairo ingestion window", clock });
    }
    if (targetDate !== clock.dateKey) {
      return Response.json({ ok: true, skipped: true, reason: "target date differs from Cairo today", clock, targetDate });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return Response.json({ ok: false, error: "Supabase runtime credentials unavailable." }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = crypto.randomUUID();
  let lease = false;
  let session: any = null;
  const failures: Array<{ ticker: string; error: string }> = [];
  let rawRowsWritten = 0;
  let derivedRowsWritten = 0;
  let dailyRowsWritten = 0;
  let tickers: string[] = [];

  try {
    const { data: acquired, error: leaseError } = await sb.rpc("try_acquire_intraday_writer_lease", {
      p_owner: runId,
      p_ttl_seconds: 240,
    });
    if (leaseError) throw new Error(`Writer lease failed: ${leaseError.message}`);
    lease = Boolean(acquired);
    if (!lease) {
      return Response.json({ ok: true, skipped: true, reason: "another intraday writer owns the lease", runId });
    }

    if (!dryRun) {
      await sb.from("market_data_ingestion_runs").insert({
        id: runId,
        scheduler: scheduled ? "supabase-pg-cron" : "manual",
        target_session_date: targetDate,
        status: "running",
        started_at: now.toISOString(),
      });
    }

    tickers = await resolveUniverse(sb, targetDate);
    if (!tickers.length) throw new Error("No session-relevant tickers found.");

    const { data: registryRows, error: registryError } = await sb
      .from("ticker_registry")
      .select("ticker,isin,scanner_symbol,history_symbol")
      .in("ticker", tickers);
    if (registryError) throw new Error(`Ticker registry read failed: ${registryError.message}`);
    const registryByTicker = new Map((registryRows ?? []).map((row: any) => [cleanTicker(row.ticker), row]));

    session = await createDenoTradingViewSession();
    const chart = await createChart(session);
    const retrievedAt = new Date().toISOString();
    const nowMs = now.getTime();

    for (const ticker of tickers) {
      let series: any = null;
      try {
        const resolved = await resolveSymbol(chart, registryByTicker.get(ticker), ticker);
        series = await createSeries(session, chart, resolved, "1", SERIES_BARS);
        const history = [...((series.history ?? []) as Bar[])];
        const rawRows = history
          .filter((bar) => validRawBar(bar, targetDate, nowMs))
          .map((bar) => rawRow(ticker, bar, retrievedAt))
          .sort((a, b) => a.bar_timestamp.localeCompare(b.bar_timestamp));

        if (!rawRows.length) {
          throw new Error("TradingView returned no usable target-session 1m bars.");
        }

        if (!dryRun) {
          const { error: rawError } = await sb
            .from("intraday_price_history")
            .upsert(rawRows, { onConflict: "ticker,interval_minutes,bar_timestamp" });
          if (rawError) throw new Error(`Raw 1m write failed: ${rawError.message}`);
          rawRowsWritten += rawRows.length;

          const persistedRaw = await loadSessionRaw(sb, ticker, targetDate);
          const derived = aggregateFiveMinute(persistedRaw, ticker, retrievedAt);
          const { error: derivedError } = await sb
            .from("intraday_price_history")
            .upsert(derived, { onConflict: "ticker,interval_minutes,bar_timestamp" });
          if (derivedError) throw new Error(`Derived 5m write failed: ${derivedError.message}`);
          derivedRowsWritten += derived.length;

          if (clock.dateKey !== targetDate || clock.minuteOfDay >= SESSION_END_MINUTE) {
            const daily = aggregateDaily(persistedRaw, ticker, targetDate, retrievedAt);
            if (daily) {
              const { error: dailyError } = await sb
                .from("price_history")
                .upsert(daily, { onConflict: "ticker,trading_date" });
              if (dailyError) throw new Error(`Daily history write failed: ${dailyError.message}`);
              dailyRowsWritten += 1;
            }
          }
        } else {
          rawRowsWritten += rawRows.length;
          derivedRowsWritten += aggregateFiveMinute(rawRows, ticker, retrievedAt).length;
        }
      } catch (error) {
        failures.push({ ticker, error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (series) await series.close().catch(() => undefined);
      }
    }

    const status = failures.length === 0 ? "success" : failures.length < tickers.length ? "partial" : "failed";
    if (!dryRun) {
      await sb.from("market_data_ingestion_runs").update({
        status,
        finished_at: new Date().toISOString(),
        ticker_count: tickers.length,
        raw_rows_written: rawRowsWritten,
        derived_rows_written: derivedRowsWritten,
        daily_rows_written: dailyRowsWritten,
        failures,
      }).eq("id", runId);
    }

    return Response.json({
      ok: failures.length === 0,
      runId,
      targetDate,
      dryRun,
      tickers,
      rawRowsWritten,
      derivedRowsWritten,
      dailyRowsWritten,
      failures,
    }, { status: failures.length === 0 ? 200 : 500 });
  } catch (error) {
    if (!dryRun) {
      try {
        await sb.from("market_data_ingestion_runs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          ticker_count: tickers.length,
          raw_rows_written: rawRowsWritten,
          derived_rows_written: derivedRowsWritten,
          daily_rows_written: dailyRowsWritten,
          failures: [{ ticker: "*", error: error instanceof Error ? error.message : String(error) }, ...failures],
        }).eq("id", runId);
      } catch {
        // Preserve the original ingestion error.
      }
    }
    return Response.json({ ok: false, runId, error: error instanceof Error ? error.message : String(error), failures }, { status: 500 });
  } finally {
    if (session) {
      try { await session.close(); } catch { /* best-effort cleanup */ }
    }
    if (lease) {
      try { await sb.rpc("release_intraday_writer_lease", { p_owner: runId }); } catch { /* lease expires automatically */ }
    }
  }
});
