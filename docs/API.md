# API Reference

## Overview

The Express server in `server.ts` provides integration endpoints for market data, Google Sheets, health checks, and retained legacy migration/server-persistence paths.

Normal browser portfolio persistence now uses the authenticated Supabase browser client directly with RLS. The `/api/supabase/*` routes remain available as a server-side compatibility path but are not the primary browser data path.

## Health

### GET /api/health

Response:

```json
{ "status": "ok" }
```

Use this endpoint for simple process/HTTP health checks.

## EGX market data

### POST /api/egx/scan

Proxies TradingView's Egypt scanner.

The server requests a broad EGX snapshot including:

- symbol/name;
- description;
- logo ID;
- close;
- absolute and percentage change;
- volume;
- high/low;
- 52-week range;
- sector;
- RSI.

Possible responses:

- `200`: TradingView payload;
- upstream status: TradingView returned an error;
- `500`: proxy/network failure.

### GET /api/tradingview/symbol-search

Query:

```text
?text=SWDY
```

Search is scoped to the EGX exchange.

Returns `400` when the `text` query is missing.

## Google Sheets

The server supports two authentication modes:

1. configured Google service account;
2. bearer token supplied by the browser OAuth flow.

Service account authentication is preferred when configured.

### GET /api/sheets/service-account-status

Returns whether a service account is configured and, when available, the account email that must be granted access to the spreadsheet.

### GET /api/sheets/metadata

Required query:

```text
?spreadsheetId=...
```

Returns spreadsheet title and sheet/tab metadata.

### GET /api/sheets/values

Required queries:

```text
?spreadsheetId=...&range=...
```

Reads values from a range.

### PUT /api/sheets/values

Body shape:

```json
{
  "spreadsheetId": "...",
  "range": "Sheet1!A1:D10",
  "values": [["..."]],
  "valueInputOption": "USER_ENTERED"
}
```

### POST /api/sheets/append

Appends values to a Google Sheets range.

### POST /api/sheets/batchUpdate

Proxies Google Sheets batch-update operations used by the spreadsheet integration.

### GET /api/sheets/drive-files

Lists accessible Google spreadsheets when the selected Google credentials have Drive read access.

## Supabase compatibility endpoints

These endpoints validate a Supabase access token and use the server-side secret key.

Authorization header:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

### GET /api/supabase/portfolio

Loads the portfolio belonging to the authenticated Supabase user.

### PUT /api/supabase/portfolio

Saves a complete portfolio snapshot for the authenticated user.

### POST /api/supabase/price-tick

Persists position/ticker market-price updates.

Body:

```json
{
  "positions": [],
  "tickers": [],
  "force": false
}
```

### GET /api/supabase/price-history

Required:

```text
?tickers=COMI,SWDY
```

Optional:

```text
&startDate=2026-01-01&endDate=2026-12-31
```

## Legacy Firestore migration endpoint

### POST /api/migration/firestore-to-supabase

This endpoint is disabled unless:

```env
ENABLE_SUPABASE_MIGRATION_UI=true
```

The body must explicitly include:

```json
{ "confirm": true }
```

Required server-only credentials include the Firebase Admin values and Supabase secret key documented in [DEVELOPMENT.md](DEVELOPMENT.md).

This endpoint is for one-time migration only and should remain disabled in normal deployments.

## Static migration page

### GET /supabase-migration.html

Serves the legacy migration utility page from `public/supabase-migration.html`.

## Security notes

- Do not expose server secret keys to the browser.
- Treat Google OAuth tokens as sensitive bearer credentials.
- Keep the migration endpoint disabled unless actively migrating.
- Portfolio authorization must be based on verified Supabase user identity and database RLS, not on client-provided owner IDs.
