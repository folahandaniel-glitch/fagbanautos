# Security

## Implemented controls

- **Authentication:** Argon2id password hashing; httpOnly, SameSite=Lax, Secure (in production) signed session cookies; sessions re-validated against the database on every request (suspension and role changes take effect immediately via `sessionVersion`); lockout after 5 failed attempts (15 minutes); timing-equalised failed logins; rate limiting on login, registration, checkout, uploads and public forms; optional TOTP 2FA for staff; forced password change for one-time passwords.
- **Authorisation:** every server action and route handler checks a permission in the backend (`requirePermission`); the UI merely hides what a role cannot do. 518 permissions, 12 roles; financial-authority keys (VAT, installment, bank, Paystack, refund settings, payment/release override, role management) exist only on the Super Admin. See `tests/security.test.ts`.
- **Payments:** Paystack webhooks verified by HMAC-SHA512 over the raw body (constant-time compare), then every transaction is re-verified with Paystack (status, currency, reference, exact amount) before crediting; idempotent crediting (unique ledger row per payment); browser success messages are never trusted.
- **Secrets:** Paystack secret encrypted with AES-256-GCM (`SETTINGS_ENCRYPTION_KEY`), write-only in the UI, never logged or sent to the browser; environment variables take precedence.
- **Input and files:** Zod validation; Prisma parameterised queries; uploads checked for extension, declared MIME, magic bytes and size, random file names, authenticated downloads; Excel image URLs restricted to public https images; no `dangerouslySetInnerHTML` of user content (only JSON-LD built from server data).
- **Headers:** CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS (production); admin pages are `noindex` and `no-store`.
- **Integrity and audit:** database constraints and append-only audit/ledger tables (`docs/DATABASE.md`); audit entries for logins, price and stock changes, VAT, installment and settings changes, payment decisions, overrides, refunds, role changes, imports and exports.

## Before going live

1. Set strong `AUTH_SECRET` and `SETTINGS_ENCRYPTION_KEY`; back up the encryption key separately.
2. Enable 2FA for every staff account; change all one-time passwords.
3. Configure Upstash Redis for shared rate limits.
4. Add a malware-scanning step for uploads if proof-of-payment volume grows (hook point: `lib/uploads.ts`).
5. Run a dependency audit (`npm audit`) and keep dependencies current.

## Compliance (owner action)

- **NDPA 2023 / GAID 2025:** review the Privacy Policy; assess whether FAGDAN is a data controller of major importance (register with the NDPC if so); keep a 72-hour breach-notification runbook; honour access/correction/deletion requests.
- **Anti-money-laundering:** motor dealers are designated non-financial businesses. Register with SCUML, collect customer identification for high-value purchases, and keep records. KYC fields exist on the customer record.
- **Tax and consumer finance:** have counsel and a tax adviser confirm VAT handling, the installment structure, and refund/cancellation terms. FAGDAN must not present itself as a regulated lender unless licensed.

## Reporting a vulnerability

Email the site owner (Settings > General > Contact email) with details; do not post publicly.
