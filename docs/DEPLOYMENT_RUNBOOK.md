# Deployment runbook

Everything in this repo is code-complete and tested against real providers'
APIs (mocked in tests) or a real local Postgres. This is the checklist, in
order. **Status as of 2026-09-12**: the backend is live in production (see
step 2), R2 storage/backups and push notifications (FCM) are configured;
Twilio and Razorpay are the two accounts still outstanding, and the mobile
builds/Play Store submission (steps 3-4) haven't been done yet.

## 1. Provision accounts

- [x] ~~A Postgres instance and a host for the backend~~ - done, see
      [`ORACLE_DEPLOYMENT.md`](./ORACLE_DEPLOYMENT.md) (self-hosted on the
      Oracle VM alongside the backend).
- [x] ~~A domain + TLS certificate~~ - done: `sptcfinance.duckdns.org`
      (free DuckDNS subdomain) with a live Let's Encrypt cert via Caddy.
      **Replace with a real purchased domain before a real public launch**
      - DuckDNS entries can be reclaimed/expire and aren't a durable base
      for a financial product's API.
- [x] ~~Cloudflare R2 buckets for storage + backups~~ - done:
      `sptc-finance-storage` (public, uploads) and `sptc-finance-backups`
      (private, nightly encrypted backups), with a scoped API token
      (`sptc-backend-prod`) limited to just those two buckets.
- [x] ~~Firebase Cloud Messaging~~ - done: both apps' Android registrations
      exist in the `sptc-finance-platform` Firebase project, and the
      backend has a service account key (`PUSH_PROVIDER=fcm`,
      `FIREBASE_SERVICE_ACCOUNT_JSON` set) so push notifications work.
- [ ] **Twilio** account, a purchased/verified sender number, and API
      credentials (Account SID + Auth Token). Put them in
      `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`, and
      set `SMS_PROVIDER="twilio"`. **Until this is done**, OTP login works
      via the dev-OTP fallback (`ALLOW_DEV_OTP="true"` is set on the live
      server) - the OTP is returned in the API response and shown in-app
      via the "Dynamic Island" banner instead of a real SMS. This is fine
      for early testing, not for real customer accounts at scale (anyone
      who can see the network response can see the OTP) - set up Twilio and
      turn `ALLOW_DEV_OTP` back to `"false"` before a real public launch.
- [ ] **Razorpay** account (KYC'd business account for live mode, not just
      test mode) and API keys (Key ID + Key Secret) plus a webhook secret
      configured in the Razorpay dashboard pointing at
      `POST https://sptcfinance.duckdns.org/v1/payments/webhook/razorpay`.
      Put them in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` /
      `RAZORPAY_WEBHOOK_SECRET`, and set `PAYMENT_GATEWAY_PROVIDER="razorpay"`.
      Until this is done, online in-app EMI payment fails closed (branch
      cash/manual collection still works).
- [ ] **Expo/EAS** account (`eas login`), then run `eas init` inside each of
      `apps/customer-app` and `apps/business-app` and copy the generated
      project ID into that app's `app.config.js` (`extra.eas.projectId`,
      currently the placeholder `REPLACE_WITH_EAS_PROJECT_ID` in both).
- [ ] **Google Play Console** developer account ($25 one-time fee).

To change any of the settings above, edit
`/opt/sptc-finance/apps/backend/.env.production` on the VM directly (it's
`chmod 600`, was never committed to this repo, and isn't tracked by git on
the VM either) then redeploy with `./infra/oracle/deploy.sh`.

## 2. Backend deploy

**Done** - live at `https://sptcfinance.duckdns.org` on the Oracle VM
described in [`ORACLE_DEPLOYMENT.md`](./ORACLE_DEPLOYMENT.md) (that doc's
"Current live deployment" section has the exact VM/domain/bucket details).
`curl https://sptcfinance.duckdns.org/v1/health` should return
`{"status":"ok",...}`. To redeploy after a code change: rsync/push the
updated `apps/backend` to the VM and run `./infra/oracle/deploy.sh` (or
`git pull` first if you've since made the VM a proper git checkout - it
currently isn't one, see the note in that script).

Generic steps for anyone deploying elsewhere (any Docker host + your own
reverse proxy/TLS + a managed Postgres) instead of Oracle:

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

`eas.json` in both apps already points `API_BASE_URL` (preview and
production profiles) at the live backend, `https://sptcfinance.duckdns.org`
- update this once you have a real production domain (see step 1).

```bash
npm install -g eas-cli   # if not already installed
eas login                 # your own Expo account - interactive, can't be scripted

cd apps/customer-app
eas init                  # replaces the REPLACE_WITH_EAS_PROJECT_ID placeholder in app.config.js
eas build --profile development --platform android   # test build first
# install on a physical device or emulator, verify login, OTP (see the
# "Dynamic Island" banner note in step 1), payment flow, push notifications,
# and biometric unlock end-to-end
eas build --profile production --platform android     # produces the .aab

cd ../business-app
eas init
eas build --profile development --platform android
# verify staff login/device step-up OTP, loan/payment workflows, and the
# Database Backups screen (Settings > More > Database Backups, SUPER_ADMIN
# only) - both "Download" and "Send to Drive" (Drive needs its own one-time
# setup, see src/backup/google-drive.service.ts - skip it and use Download
# if you haven't done that setup)
eas build --profile production --platform android
```

`react-native-razorpay` (Customer App only) is a native module - it does
**not** work in Expo Go. You must test on an EAS development build or later.

## 4. Play Store listing

- [x] ~~Host the Privacy Policy and Terms of Service at public URLs~~ -
      done, published and cross-linked:
      - Privacy Policy: https://claude.ai/code/artifact/7f50bfa5-7569-4a49-9f4c-46db00bec0bd
      - Terms of Service: https://claude.ai/code/artifact/61caab58-8a15-482d-8a54-e1d2774a021d
      - **Before submitting**: open each link's share menu and make it
        public (Artifacts are private by default) - Play Console needs to
        be able to fetch the privacy policy URL, and both docs still need
        the "not a substitute for legal review" disclaimer in them
        addressed (a lawyer's pass) before relying on them at real scale.
        The source Markdown (`docs/PRIVACY_POLICY.md`,
        `docs/TERMS_OF_SERVICE.md`) is the version-controlled source of
        truth - re-publish the artifacts from it if you edit it.
- [ ] Complete the Data safety form using `docs/PLAY_STORE_DATA_SAFETY.md`
      as your answer key (now fully filled in, no more `[FILL IN]`
      placeholders) - verify it against the current Play Console fields,
      which change periodically.
- [ ] Replace the placeholder app icons
      (`apps/customer-app/assets/icon.png` and `adaptive-icon.png`,
      likewise for `apps/business-app`) with real branding if you want
      something beyond the current simple "S" wordmark.
- [ ] Prepare store listing assets: screenshots (phone + optionally
      tablet), a feature graphic, short/full description, content rating
      questionnaire (this app handles financial data - answer accordingly).
- [ ] Decide whether the Business App is published on the Play Store at all,
      or distributed internally (Play Console's "Internal testing" /
      "Managed Google Play" for enterprise distribution) - a staff-only
      operational tool is often better kept off the public store.
- [ ] Upload the signed `.aab` from step 3 to a release track (`eas.json`'s
      `submit.production.android.track` is currently `"internal"` - start
      there, then promote to Closed/Open testing, then Production once
      confident) and complete Google's review. `eas submit` can do the
      upload directly once you've set up a Play Console service account
      key (Play Console > Setup > API access).

## 5. Post-launch

- [ ] Once Twilio is live, set `SMS_PROVIDER="twilio"` and
      `ALLOW_DEV_OTP="false"` in `.env.production` and redeploy - otherwise
      OTPs remain visible in the API response indefinitely.
- [ ] Replace the DuckDNS domain with a real purchased one before treating
      this as a durable public launch (update `DOMAIN` in `.env.production`,
      `CORS_ORIGINS`, both apps' `eas.json` `API_BASE_URL`, and the
      Razorpay webhook URL to match).
- [ ] Monitor Razorpay webhook delivery (Razorpay's dashboard shows
      delivery attempts/failures) - the webhook is the authoritative
      payment-confirmation path if a customer's app is killed mid-checkout.
- [ ] Set up log aggregation and uptime monitoring for the backend
      (nothing in this repo does this for you).
- [ ] Rotate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` if ever suspected
      compromised - this invalidates all existing sessions.
- [ ] Daily encrypted backups run automatically once `BACKUP_ENCRYPTION_PASSPHRASE`
      and `BACKUP_R2_BUCKET_NAME` are set (see `src/backup/backup.service.ts` -
      required in production, checked at boot). Once live: trigger one manual
      backup (`POST /v1/backups/run`, SUPER_ADMIN only) and confirm
      the object lands in the R2 bucket, then periodically (monthly) actually
      restore a backup into a scratch database to confirm it's valid - an
      untested backup is not a backup. The Super Admin can browse/filter
      backups by date, download one to their device, or manually export one
      to Google Drive from the Business App's "Database Backups" screen.
      Google Drive export is optional and needs its own one-time OAuth setup
      (see `src/backup/google-drive.service.ts`).
