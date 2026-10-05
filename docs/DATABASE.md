# Database

PostgreSQL via Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations`).

## Conventions

- Money: `BigInt` kobo. Order numbers `FAG-YYYYMMDD-NNNNNN` from a per-day counter row locked in the creating transaction (Africa/Lagos date).
- Demo/seed rows carry `isDemo = true`.
- Divisions, categories, settings and menus are rows, not code.

## Integrity enforced by the database itself (migration `integrity_constraints`)

- Stock cannot be negative; reserved cannot exceed on-hand (unless backorder allowed); price/discount non-negative.
- Payment, order and installment amounts non-negative; order lines have quantity >= 1.
- A vehicle can have only one ACTIVE reservation at a time (partial unique index).
- `LedgerEntry` and `AuditLog` are **append-only** (UPDATE and DELETE are blocked by triggers).
- Unique: VIN, stock number, inventory ID, SKU, slug, order number, payment reference, invoice number, (location, slot start) for bookings, (payment, ledger type) for idempotent crediting.

## Concurrency

Purchases and reservations lock product rows (`SELECT ... FOR UPDATE`, ordered to avoid deadlocks); payments lock the order row; service bookings take a per-location/day advisory lock. Covered by tests (10 simultaneous buyers, one winner).

## Backups

Enable point-in-time recovery at the provider and test a restore once before launch.
