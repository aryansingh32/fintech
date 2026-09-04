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
  customer-app/   React Native customer app (not yet started)
  business-app/   React Native business/owner app (not yet started)
packages/
  shared/         Shared TypeScript types/DTOs between backend and both apps (not yet started)
```

## Status

**Done (Phase 1, plus the start of Phase 2-3):**
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
  non-destructive reversal - covered by integration tests against a real
  Postgres database, including a concurrent-duplicate-request race test.
- Minimal but real REST surface (auth, customers, products/IMEI, loan
  products, loans + human approval, payments + allocation preview +
  reversal) with an end-to-end HTTP test walking the full lifecycle.
- Audit logging on every sensitive action (customer creation, login,
  loan creation/approval/decline, payment creation/reversal).

**Not yet built:** notification delivery integrations (push/SMS provider
wiring - the architecture supports it, no provider is faked), support
ticketing, reports/analytics, offline-first sync for the Business App, and
both mobile apps themselves.

## Getting started

See `apps/backend/README.md`.

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
