# Assumptions, decisions and known gaps

## Owner decisions (defaults used; change in Admin > Settings)

| ID | Decision | Default applied |
|---|---|---|
| D1 | Buyer VAT switch-off | Disabled. Super Admin can enable per product type, with reason and approval. Needs tax-adviser sign-off. |
| D2 | Legal form of the 10% installment uplift | Presented as the "FAGDAN installment price", fully disclosed; **not** described as interest or a regulated loan. Counsel must review. |
| D3 | 90% threshold basis | VAT-inclusive grand total. Switchable to pre-VAT (matches the original brief's figures). |
| D4 | Trade-in credit | Part-payment; VAT on the full price. |
| D5 | Discount vs uplift | Discount first, then 10% uplift. |
| D6 | Reservation | 48-hour hold; expired holds are released by a daily Vercel Cron job (Hobby plan limit) plus a throttled sweep whenever vehicles are browsed or ordered. |
| D7 | Real accounts and keys | GTBank account supplied by the owner is active (account type recorded as Savings: confirm). Paystack keys are entered in Admin > Settings > Paystack. |

## Implemented

Storefront (home with capability-tiered 3D hero, cars, parts, accessories, technology, dynamic divisions, universal fitment-aware search, product/vehicle pages with cross-sell, cart, 6-step checkout, order pages, bank-transfer proof upload, Paystack init/verify/webhook, auto care booking, finance application, imports request, trade-in and swap requests, CMS pages, FAQ, 404/error/loading/offline), PWA (dynamic manifest, service worker, install prompt with iOS and unsupported-browser fallbacks and frequency capping), admin (command centre, orders, release control, payments and reconciliation, VAT, inventory, product editor, Excel import/export, CRM leads, tasks, bookings, import cases, trade-ins, swaps, finance applications, CMS, divisions, system settings, Paystack and bank configuration, staff and roles, audit log, 2FA), security controls and test suites.

## Documents (PDF)

Tax invoice, quotation, payment receipt, payment statement, installment statement, reservation confirmation, trade-in valuation, swap proposal and service-booking confirmation are generated on demand at `/api/documents/<type>/<ref>` (links on order pages, the account page and admin screens). Numbers are sequential and stable per subject (INV-YYYYMMDD-000001, etc.). Access: the owning customer or staff with the matching permission; everyone else gets 404. The invoice shows the TIN and RC number from Settings > General when entered.

## Known gaps (not implemented, do not assume present)

- **Outbound notifications:** templates are stored and in-app notifications are created for key events, but email and WhatsApp sending adapters are not wired up.
- **Image fetching:** Excel image URLs are validated (https, no private hosts, image extension) and referenced; they are not downloaded and re-hosted.
- **Compare and favourites pages,** blog UI, push notifications, multi-currency and multi-language beyond the architecture-ready defaults.
- **Parts/accessory pending-order expiry:** only vehicle reservations expire automatically; unpaid parts orders keep their stock reserved until cancelled.
- **Test coverage not done:** browser E2E (Playwright), automated accessibility (axe) and load testing. Responsive overflow was checked manually at 375px; real-device checks (Safari iPhone, Samsung Internet, etc.) are listed in `MANUAL_QA.md` for the owner.
- **Paystack against the live API** was verified with a mocked gateway only; run the test-mode checks in `MANUAL_QA.md` with real test keys.
- **Vercel deployment** was not performed (requires the owner's Vercel authentication, a production database and environment variables). The code is on GitHub at https://github.com/folahandaniel-glitch/fagbanautos.

## Compliance items needing real-world action

NDPA 2023 / GAID 2025 (privacy notice review, DCPMI assessment/registration, breach runbook), SCUML registration and KYC process (motor dealers are DNFBPs), tax adviser review of VAT and installment treatment, legal review of all CMS legal pages.
