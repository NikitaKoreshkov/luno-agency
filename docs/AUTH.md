# Authentication and client area

The public site (landing, legal pages) renders without a database. Auth and the
client area become available once `DATABASE_URL` points at a Postgres instance
with `lib/db/schema.sql` applied:

```bash
psql "$DATABASE_URL" -f lib/db/schema.sql
```

`lib/env.ts` keeps the database optional: `isDatabaseEnabled()` returns false when
`DATABASE_URL` is unset, `getPool()` then refuses to connect, and every page treats
the resulting error as "logged out". No env means no crash, just a marketing site.

## Flows

| Flow | Route | Notes |
| --- | --- | --- |
| Register | `/register` | email → 6-digit code to inbox → set name and password |
| Login | `/login` | email + password |
| Reset | `/forgot-password` | code → new password, all previous sessions revoked |
| Google | `/api/auth/google` | OAuth code exchange with signed state |

Code TTL is 15 minutes (`lib/auth/constants.ts`), codes are compared by SHA-256
digest and never stored in plain text, and passwords use bcrypt with 12 rounds.

## Sessions

A session is an HS256 JWT (`jose`, signed with `AUTH_SECRET`) in an httpOnly,
`sameSite=lax` cookie named `luno_session`, 30 days long. The `jti` claim maps to a
row in `sessions`, so logout can revoke a single session server-side. Each account
holds at most 10 live sessions; the oldest are trimmed on create.

OAuth state is a short-lived JWT carrying the redirect target, which is what makes
the callback reject forged responses.

## Limits and maintenance

`auth_rate_limits` keeps per-key counters for code send, code verify and login, so
brute force is bounded by rows in the database rather than process memory. Expired
codes, sessions and limit rows are purged by `runAuthMaintenance()`, which runs on
auth requests instead of on a cron.

## Tables

`users`, `sessions`, `verification_codes`, `auth_rate_limits`, `company_profiles`,
`user_orders`, `support_tickets`, `ticket_messages`.

The client area at `/profile` reads company profile, orders and tickets from those
tables. Its dashboard figures are modelled from per-niche baselines in
`lib/profile/dashboard.ts`, not from live ad-platform data.
