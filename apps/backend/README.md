# SPTC Finance - Backend

Secure backend for the SPTC Finance retail-financing / EMI platform: auth, RBAC,
the loan/EMI engine, the payment allocation + ledger engine, and the REST API
consumed by the Customer App and Business App.

Stack: NestJS + TypeScript + PostgreSQL + Prisma. Money math uses `decimal.js`
everywhere - never native `Number`/`Float` - and every `Decimal` field is
stored as `Decimal(14,2)` in Postgres.

## Status

This is Phase 1 (architecture / database / auth / RBAC / core financial
ledger) plus the start of Phase 2-3 (loan engine, payment engine, minimal
CRUD to exercise the full lifecycle end-to-end). See `/docs` at the repo
root (once added) for the full phase plan. Not yet built: notifications
integrations, support/reports modules, offline sync, the two mobile apps.

## Getting started

Requires Node 20+, PostgreSQL 14+.

```bash
cp .env.example .env          # then edit DATABASE_URL / JWT secrets
npm install
npm run prisma:migrate        # creates the schema
npm run prisma:seed           # creates a Branch + OWNER staff account
npm run start:dev
```

The seed script prints the owner mobile number + password to log in with
(defaults: `9999999999` / `ChangeMe123!` - override via `SEED_OWNER_MOBILE`
/ `SEED_OWNER_PASSWORD` env vars, and always change the password in any
real deployment).

## Tests

```bash
npm test          # unit + integration + e2e tests, against sptc_finance_test
```

Tests run against a real local Postgres database (see `.env.test`), not
mocks, for anything touching money: the EMI engine, the allocation engine,
transactional payment posting (including a concurrent-idempotency-key race),
reversal, and a full HTTP walk of customer -> product/IMEI -> loan ->
approval -> payment -> receipt -> reversal.

## Architecture notes

- **Two identity domains.** `StaffUser` (Business App, role-based) and
  `Customer` (Customer App, OTP/PIN) are separate tables with separate auth
  flows, never conflated. `SubjectType` on `Session`/`Device` distinguishes
  them, and `@RequireSubject(...)` enforces it on every endpoint.
- **RBAC is server-side only.** `src/rbac/permissions.ts` defines role
  defaults; `StaffPermission` rows layer per-staff overrides on top. Guards
  (`AccessGuard`) and `assertBranchAccess`/`branchWhereClause` are the only
  things that decide access - never the client.
- **The loan engine is pure and deterministic.**
  `src/loans/emi-calculator.ts` has no I/O; the same input always produces
  the same schedule, rounding remainders land on the last installment so
  the schedule sums exactly to the total payable. A loan stores its
  computed terms directly - editing a `LoanProductVersion` later never
  changes an existing loan (loans reference a specific, immutable version).
- **Payments are the most guarded code path.**
  `src/payments/payments.service.ts` posts a payment inside one
  serializable DB transaction, keyed by a unique `idempotencyKey`; a retry
  or a concurrent duplicate request is detected and returns the *same*
  payment/receipt rather than creating a second one. Allocation is either
  the system's suggested split or a staff-supplied one, but either way it
  is validated server-side against actual remaining balances before
  anything is written.
- **Nothing is deleted on correction.** Reversals
  (`src/payments/reversal.service.ts`) create a new `Reversal` row and
  restore balances; the original `Payment` row is never touched beyond a
  status change. `AuditEvent` rows are append-only by convention - no
  service in this codebase updates or deletes one.
- **No fake integrations.** With no `SMS_PROVIDER`/`PAYMENT_GATEWAY_PROVIDER`
  configured, the backend either fails closed in production or (dev/test
  only) surfaces the OTP out-of-band for testing - it never claims an SMS
  was delivered or a payment gateway confirmed something that didn't
  happen.

## Local dev database note

`DATABASE_URL` may already be present in your shell environment (e.g. a
managed Postgres your organization provisioned) - `.env`/`.env.test` here
are deliberately loaded with override (`dotenv -e -o`) so `npm run
start:dev` / `npm test` always use the values in those files rather than
whatever else is in the ambient environment. Point them at your own
Postgres instance.
