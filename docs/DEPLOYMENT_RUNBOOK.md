# Deployment runbook

Everything in this repo is code-complete and tested against real providers'
APIs (mocked in tests) or a real local Postgres. Nothing here can be
finished from an automated sandbox - every step below requires an account,
a payment method, a signing key, or a human decision that only you can make.
This is the checklist, in order.

## 1. Provision accounts

- [ ] **Twilio** account, a purchased/verified sender number, and API
      credentials (Account SID + Auth Token). Put them in
      `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`.
- [ ] **Razorpay** account (KYC'd business account for live mode, not just
      test mode) and API keys (Key ID + Key Secret) plus a webhook secret
      configured in the Razorpay dashboard pointing at
      `POST https://<your-api-host>/v1/payments/webhook/razorpay`. Put them
      in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Expo/EAS** account (`eas login`), then run `eas init` inside each of
      `apps/customer-app` and `apps/business-app` and copy the generated
      project ID into that app's `app.config.js` (`extra.eas.projectId`).
- [ ] **Google Play Console** developer account ($25 one-time fee).
- [ ] A **Postgres** instance for production (managed - RDS/Cloud SQL/etc -
      recommended over self-hosting) and a host to run the backend
      container (see `apps/backend/README.md`'s Production deployment
      section for the Docker image).
- [ ] A **domain + TLS certificate** for the backend API (e.g. via your
      host's load balancer or a reverse proxy like Caddy/nginx - the
      container itself serves plain HTTP on port 3000).

## 2. Backend deploy

```bash
cd apps/backend
cp .env.production.example .env.production   # fill in every value
docker build -t sptc-backend .
DATABASE_URL=<prod-url> npx prisma migrate deploy   # run once, before starting containers
docker run --env-file .env.production -p 3000:3000 sptc-backend
```

The backend refuses to boot in production with a missing/placeholder JWT
secret, missing `CORS_ORIGINS`, or an unsupported provider name (see
`src/config/validate-production-env.ts`) - if it exits immediately, the
error message names exactly what's missing.

Run `npm run prisma:seed` equivalent for production once, manually, to
create your first Branch and OWNER staff account (or write a
production-specific seed - review `prisma/seed.ts` first; it currently
prints a default password to the console, which is fine for local dev but
you should change that password immediately after first login in any real
deployment).

## 3. Mobile app builds

Both apps need `API_BASE_URL` pointed at your real backend domain (from
step 2) via each `eas.json` build profile's `env` block - update the
placeholder `https://api.sptcfinance.example.com` / `https://staging-api...`
values there first.

```bash
cd apps/customer-app   # then repeat for apps/business-app
eas build --profile development --platform android   # test build first
# install on a physical device or emulator, verify login, OTP, payment flow,
# push notifications, and (customer app only) biometric unlock end-to-end
eas build --profile production --platform android     # produces the .aab
```

`react-native-razorpay` (Customer App only) is a native module - it does
**not** work in Expo Go. You must test on an EAS development build or later.

## 4. Play Store listing

- [ ] Host `docs/PRIVACY_POLICY.md` and `docs/TERMS_OF_SERVICE.md`
      (filled in, legally reviewed) at public URLs and link the privacy
      policy in the Play Console listing.
- [ ] Complete the Data safety form using `docs/PLAY_STORE_DATA_SAFETY.md`
      as your answer key - verify it against the current Play Console
      fields, which change periodically.
- [ ] Replace the placeholder app icons
      (`apps/customer-app/assets/icon.png` and `adaptive-icon.png`,
      likewise for `apps/business-app`) with real branding. The current
      ones are a plain colored square with a white "S" - functional for a
      build to succeed, not real branding.
- [ ] Prepare store listing assets: screenshots (phone + optionally
      tablet), a feature graphic, short/full description, content rating
      questionnaire (this app handles financial data - answer accordingly).
- [ ] Decide whether the Business App is published on the Play Store at all,
      or distributed internally (Play Console's "Internal testing" /
      "Managed Google Play" for enterprise distribution) - a staff-only
      operational tool is often better kept off the public store.
- [ ] Upload the signed `.aab` from step 3 to a release track (start with
      Internal testing, then Closed/Open testing, then Production) and
      complete Google's review.

## 5. Post-launch

- [ ] Monitor Razorpay webhook delivery (Razorpay's dashboard shows
      delivery attempts/failures) - the webhook is the authoritative
      payment-confirmation path if a customer's app is killed mid-checkout.
- [ ] Set up log aggregation and uptime monitoring for the backend
      (nothing in this repo does this for you).
- [ ] Rotate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` if ever suspected
      compromised - this invalidates all existing sessions.
- [ ] Establish a real backup policy for the production database (point-in-time
      recovery, tested restores) - a financial ledger is not something to
      lose.
