# EHGA Mobility Operations System

A secure, multi-role staff operations web app (PWA) for EHGA Mobility - passenger
bookings, dispatch, parcels, trips, fuel, fleet, private hire, school transport and
daily cash reconciliation. Mirrors the EHGA Mobility Operations Workbook sheet-for-sheet.

- **Stack**: Next.js 14 (App Router, JavaScript), node-postgres (`pg`), Neon Postgres,
  `bcryptjs` password hashing, `jose` signed JWT session cookie (httpOnly).
- **Money**: all amounts are Ghana Cedis (GHS).
- **PWA**: installable on drivers phones; responsive down to small screens.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and SESSION_SECRET
node scripts/setup-db.js     # creates tables, triggers, controlled lists
npm run seed                 # seeds 8 vehicles + 4 staff users (idempotent)
npm run dev                  # http://localhost:3000
```

Note: on some machines an EDR deletes files containing plaintext database credentials.
`lib/db.js` therefore also accepts `DATABASE_URL_B64` (the URL, base64-encoded) as a
fallback when `DATABASE_URL` is absent. On Vercel, set the normal `DATABASE_URL`.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Vercel + local | Neon Postgres connection string (`sslmode=require`) |
| `DATABASE_URL_B64` | local only | Optional base64-encoded `DATABASE_URL` fallback |
| `SESSION_SECRET` | Vercel + local | Signing key for the JWT session cookie (>= 32 random chars) |

## Roles

| Role | Access |
| --- | --- |
| MANAGING_DIRECTOR | Everything: all registers, Setup, Staff, dashboard |
| OPERATIONS_MANAGER | Fleet, fuel, trips, school, private hire, bookings, parcels, dispatch, Setup, dashboard |
| DISPATCHER | Bookings, dispatch, parcels, private hire, school; dashboard (read) |
| ACCOUNTANT | Cash reconciliation (own); everything else read; dashboard (read) |
| DRIVER | Read-only registers relevant to operations; dashboard (read) |
| RIDER | Parcels status updates; other registers read; dashboard (read) |

Server-side role checks run on every API route; the middleware only does a cheap
session-cookie gate so unauthenticated users never reach app pages.

## Pages

| Page | Purpose |
| --- | --- |
| `/login` | Staff sign-in (bcrypt verification, JWT cookie) |
| `/app` | Dashboard: reporting-period picker with Result / Target / Status metrics |
| `/app/bookings` | Passenger bookings (EL-B codes) |
| `/app/dispatch` | Daily dispatch board with Go/Hold/Consolidate decisions (EL-D codes) |
| `/app/parcels` | Parcel register with charge composition (EL-P codes) |
| `/app/trips` | Trip logs with odometers, revenue and direct contribution (EL-T codes) |
| `/app/fuel` | Fuel log with consumption per 100 km (EL-F codes) |
| `/app/fleet` | One row per vehicle (ELA-01..04, CAM-01, I10-01, BIKE-01/02) |
| `/app/private-hire` | Private hires with contribution (EL-H codes) |
| `/app/school` | School transport students with pickup codes (EL-S codes) |
| `/app/cash` | Daily cash reconciliation with variance escalation |
| `/app/setup` | Controlled lists + operating targets (MD + Ops Manager) |
| `/app/staff` | Staff account management (MD only) |

## Serial codes

Issued from a transactional `serial_counter` table via a Postgres function. Counters
only ever increment: deleting a row never releases its code (EL-B-0001, EL-B-0002, ...).

## API

REST under `/api`:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET|POST /api/registers/<register>` and `GET|PATCH|DELETE /api/registers/<register>/<id>`
  (register keys: bookings, dispatch, parcels, trips, fuel, fleet, private-hire, school, cash)
- `GET|PUT /api/setup`, `GET|POST /api/staff`, `PATCH /api/staff/<id>`
- `GET /api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`

DELETE is always a **soft delete** (`deleted = TRUE`): rows stay for audit, disappear
from lists, and codes are never reused.

## Adding staff

Sign in as MANAGING_DIRECTOR, open **Staff**, create the account with a temporary
password and hand it over securely; the user can change it later via password reset
by the MD. Passwords are stored as bcrypt hashes.

## Purging data

1. Test rows: delete them in the UI (soft delete) or verify emptiness via the API lists.
2. Full purge (start of a financial year, for example): run against production
   `psql`/Neon SQL editor:

```sql
UPDATE booking SET deleted = TRUE;
UPDATE dispatch SET deleted = TRUE;
UPDATE parcel SET deleted = TRUE;
UPDATE trip SET deleted = TRUE;
UPDATE fuel SET deleted = TRUE;
UPDATE private_hire SET deleted = TRUE;
UPDATE school_student SET deleted = TRUE;
UPDATE cash_reconciliation SET deleted = TRUE;
-- Serial counters are deliberately NOT reset: codes are never reused.
```

## Deployment

Deployed on Vercel (project `ehga-mobility`). `npx vercel --prod` from this folder.
Environment variables are set with `npx vercel env add DATABASE_URL` and
`npx vercel env add SESSION_SECRET` (Production + Preview + Development).
