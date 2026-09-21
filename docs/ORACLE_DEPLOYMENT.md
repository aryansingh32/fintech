# Backend deployment: Oracle Cloud Free Tier

Deploys `apps/backend` + Postgres on a single Oracle Cloud "Always Free"
VM, fronted by Caddy for automatic HTTPS. Total cost: $0/month as long as
you stay within Always Free limits. Do these steps in order.

This is the concrete, Oracle-specific version of step 2 in
[`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — do the account
provisioning in that file's "1. Provision accounts" section first
(Twilio, Razorpay, a Cloudflare R2 bucket for uploads, a second private
R2 bucket for backups).

## Current live deployment (as of 2026-09-12)

- **VM**: `sptc-backend`, Oracle Cloud `ap-mumbai-1`, `VM.Standard.A1.Flex`
  (4 OCPU / 24 GB, Always Free), Ubuntu 24.04, public IP `161.118.171.193`.
  SSH key is a locally-generated ed25519 pair (the original instance's key
  was lost, so the instance was recreated) — ask whoever ran this session
  for the private key, or generate a new one and re-key the instance if
  it's lost again.
- **Domain**: `https://sptcfinance.duckdns.org` (free DuckDNS subdomain,
  account `jainarpit0064@gmail.com`) → `161.118.171.193`. Caddy has a live
  Let's Encrypt certificate for it. DuckDNS entries can silently expire —
  if the domain stops resolving, log into duckdns.org and hit "update ip".
  **Replace this with a real domain before going to production** — DuckDNS
  is fine for validation, not for a financial product's public API.
- **Storage**: Cloudflare R2, account `6dfc81a2a199fbf8bf12976a5601d3e7`.
  `sptc-finance-storage` (public, existing) for uploads,
  `sptc-finance-backups` (private, created this session) for nightly
  backups. API token `sptc-backend-prod` is scoped to just these two
  buckets (Object Read & Write). `R2_PUBLIC_BASE_URL` currently uses the
  bucket's R2.dev Public Development URL, which Cloudflare rate-limits —
  attach a custom domain to the bucket before relying on it for real
  traffic.
- **Push notifications**: `PUSH_PROVIDER="fcm"` with a real
  `FIREBASE_SERVICE_ACCOUNT_JSON` from the `sptc-finance-platform` Firebase
  project (both apps' Android registrations already exist there) — this
  matters because both apps register native FCM device tokens
  (`getDevicePushTokenAsync()`), not Expo push tokens, so `PUSH_PROVIDER`
  must stay `"fcm"` here (setting it to `"expo"` would reject every token).
- **OTP without Twilio**: `ALLOW_DEV_OTP="true"` is set, so OTP login works
  end-to-end today even with `SMS_PROVIDER` blank — the OTP comes back in
  the API response and both apps show/auto-fill it via the "Dynamic Island"
  banner (`src/components/OtpIslandBanner.tsx`). This is a deliberate,
  visible-in-the-network-response tradeoff for launching without Twilio
  yet — see `DEPLOYMENT_RUNBOOK.md` §1 and turn it off once Twilio is live.
- **Not yet configured**: `PAYMENT_GATEWAY_PROVIDER` (Razorpay) is blank —
  online in-app EMI payment is disabled until that account is provisioned
  per `DEPLOYMENT_RUNBOOK.md` §1. Everything else (auth, loans, backups,
  push) is fully live.
- `apps/backend/.env.production` lives only on the VM
  (`/opt/sptc-finance/apps/backend/.env.production`, `chmod 600`) — it was
  never committed or stored in this repo.

## 1. Create the Oracle Cloud account

1. Sign up at Oracle Cloud (oracle.com/cloud/free) — requires a card for
   identity verification but is not charged as long as you stay in the
   Always Free tier.
2. Pick a **home region** carefully: Always Free resources are pinned to
   whichever region you pick at signup and cannot be moved later.

## 2. Create the Always Free compute instance

In the Console: **Compute → Instances → Create Instance**.

- **Name**: e.g. `sptc-backend`.
- **Image**: Canonical Ubuntu 22.04 (the "Always Free-eligible" image
  picker in the console flags which images qualify).
- **Shape**: click "Change shape" → **Ampere** → `VM.Standard.A1.Flex`
  (ARM). This is the shape worth using — Always Free includes up to 4
  OCPUs / 24 GB RAM total across Ampere instances, vastly more headroom
  than the alternative `VM.Standard.E2.1.Micro` (AMD, 1 GB RAM, too
  tight for Postgres + backend + Caddy together). Set it to 2 OCPU / 12
  GB (or all 4/24) — one instance is simplest to operate.
  - If you get an "Out of host capacity" error, that AD/region is
    temporarily out of free Ampere capacity — retry later, try a
    different Availability Domain in the same region, or (if you must)
    fall back to the E2.1.Micro shape and expect to trim what runs on it.
- **Add SSH key**: generate one locally if you don't have one
  (`ssh-keygen -t ed25519`) and paste the public key here — this is the
  only way in, there's no console/browser terminal by default.
- **Networking**: use the default VCN it offers to create, "Assign a
  public IPv4 address" checked.
- Create the instance and note its public IP.

Then reserve that IP so it survives a stop/start: **Networking → IP
Management → Reserved Public IPs** (or attach a reserved IP when creating
the instance) — an ephemeral IP can change if the instance is ever
stopped and started.

## 3. Open the firewall at the cloud level

The VM has two independent firewall layers; both must allow traffic.
This step is the cloud-level one (step 5 below and `setup-vm.sh` handle
the OS-level one).

**Networking → Virtual Cloud Networks → (your VCN) → Security Lists** →
the default security list → **Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

(Port 22/SSH is already open by default in the default security list.)

## 4. Point a domain at the VM

Caddy (used below) needs a real DNS name to request a Let's Encrypt
certificate — it cannot get one for a bare IP.

- Buy/use a domain you control, or use a free dynamic-DNS name (e.g.
  DuckDNS) if you don't want to buy one yet.
- Create an **A record** for e.g. `api.yourdomain.com` → the VM's
  reserved public IP.
- Wait for DNS to propagate (`dig api.yourdomain.com` should return the
  IP) before starting the stack, or Caddy's first certificate request
  will fail and retry with backoff.

## 5. SSH in and run the one-time VM setup

```bash
ssh -i ~/.ssh/<your-key> ubuntu@<vm-public-ip>
```

Copy `infra/oracle/setup-vm.sh` to the VM (or clone the repo first, see
step 6, then run it from there) and run it:

```bash
bash infra/oracle/setup-vm.sh
```

This installs Docker, opens 80/443 in both `ufw` and the OS-level
iptables rules Oracle's Ubuntu image ships with by default (a common trap
— the cloud security list from step 3 is not sufficient on its own), and
adds a 2 GB swapfile. Log out and back in afterward so your user's new
`docker` group membership takes effect.

## 6. Get the code onto the VM

```bash
sudo mkdir -p /opt/sptc-finance && sudo chown "$USER" /opt/sptc-finance
git clone <your-repo-url> /opt/sptc-finance
cd /opt/sptc-finance
```

(If the repo is private, either use a deploy key/PAT in the clone URL, or
`rsync` the working tree from your machine instead of cloning.)

## 7. Configure production secrets

```bash
cp apps/backend/.env.production.example apps/backend/.env.production
nano apps/backend/.env.production
```

Fill in every value (see the comments in the file). For this single-VM
setup specifically:

- `POSTGRES_PASSWORD` — generate with `openssl rand -base64 24`.
- `DOMAIN` — the DNS name from step 4, e.g. `api.yourdomain.com`.
- `DATABASE_URL` — leave the placeholder as-is; the compose file
  overrides it with `POSTGRES_PASSWORD` automatically (no `sslmode`
  needed, Postgres runs on the same private docker network).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — `openssl rand -base64 48`
  each, must differ.
- `CORS_ORIGINS` — leave blank/unused for the mobile apps (they don't
  send an `Origin` header); set it only if you also serve a web admin
  console.
- Twilio, Razorpay, R2 (storage + backups) credentials from the account
  provisioning step in `DEPLOYMENT_RUNBOOK.md`.

`apps/backend/src/config/validate-production-env.ts` fails the container
at boot with a clear error naming exactly what's missing or looks like a
placeholder — treat a container that exits immediately as that check
doing its job, not a mystery.

## 8. Start the stack

```bash
./infra/oracle/deploy.sh
```

This builds the backend image, starts Postgres → backend → Caddy (in
that order via `depends_on`/healthchecks), and Caddy automatically
requests and renews the Let's Encrypt certificate for `DOMAIN`. Migrations
and the idempotent seed run automatically inside the backend container's
entrypoint before it starts serving traffic.

Verify:

```bash
curl https://<your-domain>/v1/health
docker compose -f infra/oracle/docker-compose.prod.yml logs -f caddy   # watch for "certificate obtained successfully"
```

## 9. Create your first real Branch + OWNER account

The seed script only creates a Super Admin if `SEED_SUPERADMIN_*` vars
are set. If you set them, log in with that account and change the
password immediately. Otherwise create the first Branch/OWNER manually
per `apps/backend/prisma/seed.ts`.

## 10. Point the mobile apps at this backend

In both `apps/business-app/eas.json` and `apps/customer-app/eas.json`,
replace the placeholder `production`/`preview` `API_BASE_URL` values with
`https://<your-domain>` — then continue with the Play Store steps in
`DEPLOYMENT_RUNBOOK.md` section 3.

## 11. Redeploying later

Every future deploy is the same one command, re-run on the VM:

```bash
cd /opt/sptc-finance && ./infra/oracle/deploy.sh
```

It pulls the latest commit, rebuilds only what changed, and restarts —
no manual migration step (the entrypoint runs `prisma migrate deploy` on
every backend container start, which is safe to repeat).

To automate this from CI, see the optional GitHub Actions workflow at
`.github/workflows/deploy-backend.yml` (manual trigger by default —
add secrets `ORACLE_SSH_HOST`, `ORACLE_SSH_USER`, `ORACLE_SSH_KEY` in the
repo's Settings → Secrets to enable it).

## Operational notes specific to Oracle's Always Free tier

- **Idle reclamation**: Oracle can reclaim Always Free compute instances
  that stay idle (near-zero CPU, network, and memory usage) for 7
  consecutive days. A live backend serving even occasional traffic and
  running nightly backup jobs should not trip this, but if you're
  between launches with zero traffic, log in periodically or set up a
  simple external uptime ping (see `DEPLOYMENT_RUNBOOK.md` section 5) —
  which also doubles as monitoring.
- **No managed Postgres backups from Oracle**: this stack self-hosts
  Postgres in a container, so Oracle provides no automatic DB backups.
  This repo's own nightly encrypted backup job (`src/backup/backup.service.ts`)
  is what protects you here — confirm `BACKUP_ENCRYPTION_PASSPHRASE` and
  `BACKUP_R2_BUCKET_NAME` are set in `.env.production` before you
  consider this deployment done, and periodically test a restore.
- **Single point of failure**: one VM running everything means an
  Oracle-side host issue takes down DB + API together. Acceptable for a
  free-tier launch; if you outgrow it later, split Postgres onto a
  managed provider and keep only the backend + Caddy on the VM (the
  generic path in `DEPLOYMENT_RUNBOOK.md` section 2 already supports
  this — just point `DATABASE_URL` at the managed instance instead of
  the local `postgres` service).
