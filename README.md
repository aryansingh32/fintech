# SPTC Finance

A production-oriented retail-financing / EMI-management platform for
mobile & electronics stores: KYC → product/IMEI selection → down payment →
finance plan → human-controlled loan approval → EMI schedule → payment
collection → configurable allocation → receipt → reminders → repayment
history.

Two client apps (Customer App, Business App) share one backend, one
database, one financial ledger, and one auth/RBAC system. See the master
blueprint provided for the full product spec; this repo tracks progress
against it phase by phase (blueprint section 26 / 62).

## Repo layout

```
apps/
  backend/        NestJS + PostgreSQL + Prisma backend (see apps/backend/README.md)
  customer-app/   React Native (Expo) customer app
  business-app/   React Native (Expo) business/staff app
packages/
  shared/         Shared TypeScript enums/models + a typed API client used by both apps
```

## Status

**Backend - done:**
- Full relational schema (branches, staff + RBAC, customers, KYC, products
  & IMEI/serial tracking, loan products & versions, loans, installments,
  payments, allocations, receipts, reversals, adjustments, append-only
  ledger, agreements, notifications, support, audit log).
- Dual auth: customer mobile+OTP+PIN, staff mobile+password+device-OTP
  step-up; JWT sessions backed by revocable DB session rows; device
  management; OTP rate limiting/abuse protection.
- Server-side RBAC (role defaults + per-staff permission overrides) and
  branch isolation, enforced in guards/services - never trusted from the
  client.
- Deterministic, versioned, unit-tested EMI/amortization engine (flat,
  reducing-balance, and zero-cost plans; weekly/biweekly/monthly).
- Transactional, idempotent payment posting with a server-validated
  allocation engine, append-only ledger, one-receipt-per-payment, and
  non-destructive reversal.
- Event-driven notifications (en/hi templates, PUSH/SMS/EMAIL/IN_APP,
  retry tracking, daily EMI-status/reminder sweep) that fail closed rather
  than fake delivery when no provider is configured.
- Support tickets (customer + staff, escalation), 10 filtered reports
  (collections, outstanding, overdue aging, EMI due, ledger, portfolio,
  product finance, staff performance, reconciliation, audit), and an
  offline-sync endpoint for the Business App keyed by client-generated
  transaction IDs (never a client-supplied idempotency key) so a queued
  payment can't double-post on retry.
- REST surface covering both identity domains: staff (branch-scoped
  customers/products/loans/payments/reports/sync) and customer-facing
  (own profile/loans/receipts/KYC status, support, notifications, an
  online-payment endpoint that fails closed with no gateway configured).
- Audit logging on every sensitive action; 54 automated tests (unit,
  integration against real Postgres, and full HTTP e2e walks) passing.

**Mobile apps - built, not run in this sandbox:**
- `apps/customer-app`: Expo + TypeScript. Mobile+OTP+PIN login, home
  dashboard (active loan, next EMI, overdue banner, progress), loan
  list/detail with full EMI schedule, Pay EMI (allocation preview, fails
  closed with no gateway configured), receipt history/detail, support
  chat, profile/KYC status/security devices/terms.
- `apps/business-app`: Expo + TypeScript. Staff login with device-OTP
  step-up, dashboard (today's collection, overdue, active loans, due
  today, pending approvals), global search, customer management, loan
  creation wizard + human approval with advisory risk profile, payment
  collection with allocation preview and an offline queue (auto-syncs on
  reconnect, shows an OFFLINE/SYNCING banner), overdue collections list,
  reports, support ticketing with escalation, and an owner-only loan
  products screen.
- Both apps type-check cleanly (`npx tsc --noEmit`) and consume the same
  `packages/shared` types/API client as the backend. Neither has been run
  or screenshotted: this sandbox has no Android SDK/emulator. They're
  ready for `npm run android` (or `expo start` + a physical device/Expo Go)
  in an environment that has one.

**Known gaps / deliberately out of scope for now:** real SMS/push/payment
gateway provider wiring (architecture supports it; fails closed rather than
faking success), Owner branch/staff/permission-management UI (backend has
no CRUD for this yet - branches/staff are provisioned via the seed script),
a dedicated dry-run EMI preview endpoint (the loan wizard creates a
`PENDING_APPROVAL` loan directly and shows the computed schedule before the
separate, required approval step), and real device testing of either app.

## Getting started

See `apps/backend/README.md` for the backend. For either mobile app:

```bash
cd apps/customer-app   # or apps/business-app
npm run typecheck      # verify without needing an emulator
npm run android        # requires an Android SDK/emulator or a device with Expo Go
```

Both apps read the backend URL from `app.json`'s `expo.extra.apiBaseUrl`
(defaults to `http://10.0.2.2:3000`, the standard Android-emulator alias
for the host machine's `localhost`).

## Non-negotiables carried through the whole codebase

- All financial calculations are server-side; the client never computes an
  authoritative balance.
- A loan's terms are frozen at origination; changing a `LoanProductVersion`
  later cannot alter an existing loan.
- Every payment is idempotent and produces exactly one receipt; duplicates
  (retries, double-taps, offline-sync replays) are structurally impossible,
  not just discouraged.
- Corrections are new rows (reversals/adjustments), never edits to
  historical financial records.
- Loan approval is always a human decision; any risk score is advisory and
  shown with its reasons.
- No fake payment confirmations, no fake KYC verification, no fake SMS/push
  delivery - an unconfigured provider fails closed, it does not pretend to
  succeed.
