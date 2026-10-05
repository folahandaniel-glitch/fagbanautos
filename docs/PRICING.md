# Pricing, VAT and installment rules

All money is an **integer number of kobo**. Percentages use basis points (750 = 7.5%) and BigInt arithmetic with one half-up rounding step per line. The only implementation is `lib/pricing/engine.ts`; the cart, checkout, payment initialisation, order creation, invoices and admin screens all call it. The browser never computes a total.

## Calculation order (fixed)

1. Base price P x quantity
2. Line discount, then coupon (allocated pro-rata, largest-remainder) gives the discounted price D (never below 0)
3. Installment uplift (installment-eligible vehicles only): I = D + uplift% x D (default 10%, so I = D x 1.10). Per-vehicle override allowed.
4. Taxable base T = I for VAT-applicable lines
5. VAT = rate x T per line (default 7.5%), 0 where VAT is switched off
6. Charges (delivery etc.), each flagged taxable or not
7. Trade-in credit: treated as a part-payment by default (VAT is computed on the full price). `installment.tradeInTreatment` can change this.
8. Grand total = priced lines + VAT + charges. Amount due now = deposit (installment) or the full payable amount.

## Release rule

`releaseThreshold = thresholdBps x basis`, where basis is the **VAT-inclusive grand total** by default (`installment.thresholdBasis = VAT_INCLUSIVE_TOTAL`). The alternative `PRE_VAT_PRICE` reproduces the original brief's figures (N50m car: N55m installment price, N49.5m threshold; blocked at N49,499,999, eligible at N49,500,000). Both are covered by tests.

Only **verified** payments count. A vehicle order cannot enter READY_FOR_COLLECTION, READY_FOR_DELIVERY, DELIVERED or COMPLETED unless the release rule is met (installment) or the order is fully paid (outright). This is enforced in `transitionOrder` on the server; refused attempts are written to the audit log. Only a role holding `release:override` (Super Admin) can override, with a written reason, also audited.

## VAT switch-off

Off for buyers by default (VAT is a statutory tax). The Super Admin can enable it per product type under Settings > VAT. When a buyer switches VAT off: a reason is required (setting), the order may be held for Finance approval (setting), a `VatRecord` and an audit entry are written (customer, order, time, previous and new state, amount removed, reason, IP, session), and an approved/rejected decision recalculates the order from its stored inputs (`recalculateOrderVat`).

Confirm the legal position with a tax adviser before enabling any buyer opt-out.

## Tests

`tests/pricing.test.ts` (golden cases incl. all spec examples and 500 randomised reconciliations), `tests/integration.test.ts` (DB-backed), `tests/security.test.ts`.
