# FAGDAN Automotive Group

Nigerian automotive digital commerce platform. Flagship marketplace: **FAGDAN AutoGallery**. *Driven by Trust. Powered by Choice.*

Divisions (all data-driven; the Super Admin can add more): AutoGallery (vehicles), Auto Parts, Auto Accessories, Auto Technology, Auto Care, Vehicle Finance, Imports.

## Stack

Next.js 16 (App Router, TypeScript strict) · PostgreSQL + Prisma 6 · Tailwind CSS 4 · three.js / React Three Fiber (optional 3D hero, lazy-loaded with a static fallback) · jose sessions + Argon2id · otplib (staff 2FA) · ExcelJS · Zod · Vitest.

Package manager: **npm** (see `package-lock.json`).

## Quick start (development)

```bash
npm install
npm run db:dev          # starts a local PostgreSQL on port 54329 (keep it running)
cp .env.example .env    # then set AUTH_SECRET and SETTINGS_ENCRYPTION_KEY (see docs/ENVIRONMENT.md)
npx prisma migrate deploy
npm run db:seed         # roles, divisions, settings + DEMO data (never in production)
npm run dev             # http://localhost:3000
```

The seed writes one-time staff passwords to `.seed-credentials.txt` (git-ignored). Sign in at `/admin/login`; you are forced to choose a new password at first sign-in.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Dev server / production build / production server |
| `npm test` | Unit, database integration and security tests (needs the local PostgreSQL running) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations and seeding |
| `npm run icons` | Regenerate favicon and PWA icons from `public/brand/logo-original.png` |

## Where things live

- `lib/pricing/` the single pricing engine (integer kobo) and the release rule. See `docs/PRICING.md`
- `lib/services/` orders, payments, Paystack, bookings, Excel, reports
- `lib/rbac/permissions.ts` permission catalogue and the 10 staff roles
- `app/(site)/` storefront · `app/admin/` back office · `app/actions/` server actions · `app/api/` webhook, files, cron
- `prisma/` schema, migrations (including database-level integrity constraints), seed
- `tests/` Vitest suites

## Documentation

`docs/`: DEPLOYMENT, DATABASE, ENVIRONMENT, ADMIN_GUIDE, SECURITY, PRICING, ASSUMPTIONS, MANUAL_QA.
