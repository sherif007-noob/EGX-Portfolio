# Security Policy

## Scope

EGX Portfolio handles financial portfolio data and authentication credentials. Security issues should be treated as high priority even when the project is used by a single owner.

## Supported version

Security fixes target the current `main` branch.

## Reporting a vulnerability

Do not publish sensitive exploit details, credentials, access tokens, or private portfolio data in a public GitHub issue.

When reporting a security issue, provide enough non-secret detail to reproduce the problem:

- affected component/path;
- expected behavior;
- observed behavior;
- whether authentication is required;
- impact;
- minimal reproduction steps.

Never include:

- Supabase secret/service keys;
- account passwords;
- session tokens;
- Firebase Admin private keys;
- Google service-account private keys;
- private spreadsheet tokens.

## Security model

### Portfolio authentication

Supabase Auth provides portfolio identity.

### Authorization

Supabase Row Level Security scopes portfolio-owned tables by the authenticated user UUID stored in `portfolios.owner_key`.

### Browser keys

The browser may contain only public/publishable configuration such as:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Server secrets

The following must remain server-side:

- `SUPABASE_SECRET_KEY`
- Firebase Admin credentials
- Google service-account private keys

## High-risk changes

Changes in these areas require extra review:

- authentication/session handling;
- RLS policies;
- database privileges;
- SECURITY DEFINER functions;
- accounting snapshot RPCs;
- transaction delete/edit behavior;
- migration endpoints;
- secret handling;
- Google OAuth/service-account handling.

## Operational recommendations

- Enable leaked-password protection in Supabase Auth when available.
- Use a unique strong password for the portfolio account.
- Do not share server secrets across environments unnecessarily.
- Rotate a secret immediately if it appears in a log, screenshot, commit, or chat.
- Keep the legacy migration endpoint disabled except during a controlled migration.
- Review global `tickers` and `price_history` write permissions before adding more users.
- Periodically run Supabase security advisors.
- Keep dependencies and lockfiles reviewed and updated.

## Data integrity as a security property

For a financial application, integrity failures can be as harmful as unauthorized reads.

The project therefore treats these as security-sensitive behaviors:

- silent transaction deletion;
- silent duplicate creation;
- stale-client snapshot overwrite;
- unauthorized ownership reassignment;
- fabricated analytics.

Financial mutations should fail closed: if persistence fails, the UI should not claim success.
