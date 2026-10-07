# Environments

`main` and `simple-ui` are meant to run side by side without sharing anything.

| | main | simple-ui |
|---|---|---|
| Cloudflare Worker | `egx-portfolio` | currently the same Worker (production branch set to `simple-ui`). If a separate Worker is created, its name must match `name` in `wrangler.jsonc` |
| Supabase project | production | separate project |

## Variables for the simple-ui Worker
- Build variables (baked into the bundle at build time): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Runtime secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- Only if Google Sheets sync is used: add the Worker's domain to Firebase Authentication authorized domains.

## Separate Supabase project
1. Dump the schema from production: `supabase db dump --schema public -f schema.sql`, then run it in the new project.
2. Create your user (email and password). Set the Auth Site URL and redirect URLs to the new Worker address.
3. Copy market data once (prices are filled by manual GitHub workflows that point at production):
   `pg_dump --data-only -t price_history -t intraday_price_history -t ticker_registry -t ticker_aliases`
4. Export a backup from main and import it on the new Worker (rows are keyed by user id).

## Notes
- Scheduled and push workflows only run for `main`.
- A pull request into `main` fails the rendered visual regression until baselines are regenerated.
