# Environment variables

Copy `.env.example` to `.env` locally. On Vercel set them in Project > Settings > Environment Variables. Never commit real values.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Runtime connection. In production use the **pooled** string (Neon/Supabase pooler or Prisma Accelerate). |
| `DIRECT_URL` | yes | Non-pooled connection used by `prisma migrate`. |
| `APPLICATION_URL` | yes | Public base URL, e.g. `https://www.example.com`. Used in webhooks, sitemap and metadata. |
| `AUTH_SECRET` | yes | 32+ random characters (`openssl rand -base64 48`). Signs session cookies. Rotating it signs everyone out. |
| `SETTINGS_ENCRYPTION_KEY` | yes | AES-256-GCM master key for secrets stored in the database (Paystack key). **Losing it makes stored secrets unreadable**; back it up separately. |
| `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` | optional | If set, they take precedence over keys entered in Admin > Settings > Paystack. |
| `STORAGE_DRIVER` | yes in production | `blob` (Vercel Blob) in production. `local` writes to `./uploads` and is refused when `NODE_ENV=production`. |
| `BLOB_READ_WRITE_TOKEN` | with `blob` | Vercel Blob token. |
| `CRON_SECRET` | yes | Bearer token protecting `/api/cron/reservations` (Vercel Cron sends it automatically). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | recommended | Shared rate limiting across serverless instances. Without them an in-memory limiter is used. |
| `EMAIL_*`, `SMTP_*`, `WHATSAPP_*` | later | Reserved for outbound notifications (templates are editable now; sending adapters are not yet implemented, see ASSUMPTIONS). |
| `ALLOW_DEMO_SEED` | no | Demo data is refused when `NODE_ENV=production` unless this is `true`. Leave unset in production. |
