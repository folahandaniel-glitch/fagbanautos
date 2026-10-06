# Deployment (GitHub + Vercel)

Commands below are the ones defined in `package.json` (package manager: npm).

## 1. GitHub

```bash
# already configured: https://github.com/folahandaniel-glitch/fagbanautos
git push origin main
```

CI (`.github/workflows/ci.yml`) runs prisma validate, typecheck, lint, tests (against a Postgres service) and the production build.

## 2. Database

Create a managed PostgreSQL (Neon, Supabase or similar) with point-in-time recovery enabled. Use the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_URL`. Migrations run at build time (`vercel.json`: migrations run on production builds only).

## 3. Vercel

1. Import the GitHub repository (framework: Next.js, install: `npm ci`).
2. Add the environment variables from `docs/ENVIRONMENT.md` (`STORAGE_DRIVER=blob`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, etc.).
3. Create a Vercel Blob store and connect it.
4. Deploy a **preview**, then run the smoke checks in `docs/MANUAL_QA.md`.
5. Promote to production and add the domain.

## 4. First production run

```bash
# once, from a trusted machine with production DATABASE_URL set:
npx tsx prisma/seed.ts     # core seed only: roles, divisions, categories, settings. Demo data is refused in production.
```

This creates the Super Admin and the ten staff accounts with **one-time passwords** written to `.seed-credentials.txt` on that machine. Deliver them securely, then delete the file. Each user must change the password at first sign-in and should enable 2FA (Profile).

## 5. Go-live checklist

- Admin > Settings > Bank accounts: replace placeholder accounts with the real ones.
- Admin > Settings > Paystack: add keys, choose Live mode, **Save and test key**, then set the webhook URL shown there in the Paystack dashboard.
- Settings > General/Branding/Social: real phone, email, address, RC number.
- Replace demo vehicles and products (or delete them) and turn off the demo banner and "index demo data" is only enabled once real stock is live (Settings > SEO).
- Counsel reviews Terms, Privacy, Refunds, Installment Terms and Cookie pages (CMS).
- Complete the compliance items in `docs/SECURITY.md` (NDPA, SCUML, tax).
- Enable Vercel Cron (already in `vercel.json`) and confirm `/api/cron/reservations` returns 200 with the cron secret.

## Troubleshooting

- Build fails on `prisma migrate deploy`: check `DIRECT_URL` is the non-pooled string.
- Uploads fail in production: `STORAGE_DRIVER=blob` and the token must be set; local disk is not available on Vercel.
- Paystack payments stay "processing": confirm the webhook URL and that the secret key is for the same mode (test/live).

## Current production setup

- Project: Vercel team FODAN, project **fagbanautos**, Git-linked to github.com/folahandaniel-glitch/fagbanautos (every push to main deploys to production).
- URL: https://fagbanautos.vercel.app. Paystack webhook URL: https://fagbanautos.vercel.app/api/paystack/webhook
- Database: Neon (pooled DATABASE_URL, unpooled DIRECT_URL). Migrations run automatically on production builds only.
- Environment variables are stored in Vercel (Production): DATABASE_URL, DIRECT_URL, AUTH_SECRET, SETTINGS_ENCRYPTION_KEY, CRON_SECRET, APPLICATION_URL, STORAGE_DRIVER=blob, BLOB_READ_WRITE_TOKEN.
- Do not change SETTINGS_ENCRYPTION_KEY after saving Paystack keys in the admin: stored secrets would become unreadable.
- Cron: daily at 03:00 UTC (Hobby plan limit).
