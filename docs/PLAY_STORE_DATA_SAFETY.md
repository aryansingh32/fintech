# Play Console "Data safety" form - answer key

Google Play requires every app to declare, in the Play Console, what data it
collects/shares and why. This maps this codebase's actual data handling
(from `apps/backend/prisma/schema.prisma` and the notification/payment
providers wired in `apps/backend/src/notifications` and
`apps/backend/src/payments`) onto the Play Console's Data safety
categories. Fill this in per app (Customer App and Business App have
slightly different answers, noted below) when you complete the form -
this is a mapping to help you answer accurately, not a legal filing itself.

**Both apps: "Does your app collect or share any of the required user data
types?" → Yes.**

## Personal info

| Play category | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Name | Yes | No | Account management, App functionality | Customer/staff full name |
| Email address | Customer App: Yes (optional field) | No | Account management | Optional at signup |
| Phone number | Yes | Yes (Twilio) | Account management, App functionality | Used for OTP login and SMS reminders |
| Physical address | Customer App: Yes | No | App functionality | Loan/KYC address fields |
| National ID / government ID | Customer App: Yes | No | App functionality | KYC document type + masked identifier + a reference to securely stored document image, not the raw ID itself, is what backend rows hold |

## Financial info

| Play category | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Purchase history | Yes | No | App functionality | Loan, EMI, payment, receipt records |
| Payment info | Customer App: Yes | Yes (Razorpay) | App functionality | Payment amount/reference; card/UPI details are entered directly into Razorpay's checkout UI and never touch this app's servers |

## App activity

| Play category | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| App interactions | Yes | No | Analytics, App functionality | Support tickets, login/session activity |
| Other actions | Business App: Yes | No | App functionality | Staff actions (approvals, collections) for the audit log |

## Device or other identifiers

| Play category | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Device or other IDs | Yes | No | App functionality, Fraud prevention/security | Client-generated device identifier + push token, used for device recognition (staff step-up OTP) and push delivery |

## Data NOT collected

Location (precise or approximate), contacts, SMS/call logs, photos/videos
outside the explicit KYC document upload flow, web browsing history, and
any data for advertising/marketing personalization. Answer "No collection"
for all of these in the Play Console form.

## Security practices section

- Data is encrypted in transit: **Yes** (HTTPS/TLS enforced by the backend).
- Data is encrypted at rest: depends on your database/hosting
  provider's configuration - **verify and answer per your actual deployment**.
- You can request data deletion: **Yes** (see Privacy Policy §6) - answer
  Yes and link the privacy policy.
- Committed to following the Play Families policy: **N/A** - this app is
  not directed at children (see Privacy Policy §8).

## Third parties to declare

- **Twilio** - SMS delivery (phone number + message content).
- **Razorpay** - payment processing (name/contact/payment amount).
- **Expo (push notification infra)** - push token + notification content is
  relayed through Expo's push service to APNs/FCM; declare it under
  "Analytics"/"App functionality" per Play's current taxonomy for push
  infrastructure providers.
- **[FILL IN: your hosting/database provider]**.

Before submitting, re-verify this table against whatever the current Play
Console form fields actually ask (Google revises the taxonomy periodically)
and against the privacy policy URL you publish - the two must match.
