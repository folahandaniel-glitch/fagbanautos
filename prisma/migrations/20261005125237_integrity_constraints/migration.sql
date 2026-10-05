-- Database-level integrity rules. These hold even if application code has a bug.

-- Stock can never go negative and reservations can never exceed what is on hand.
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_nonneg" CHECK ("stockOnHand" >= 0 AND "stockReserved" >= 0 AND "stockSold" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_reserved_lte_onhand" CHECK ("allowBackorder" OR "stockReserved" <= "stockOnHand");
ALTER TABLE "Product" ADD CONSTRAINT "product_price_nonneg" CHECK ("price" >= 0 AND "discount" >= 0 AND "discount" <= "price");

-- Money can never be negative; order lines have positive quantity.
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amounts_nonneg" CHECK ("expectedAmount" >= 0 AND "paidAmount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "order_amounts_nonneg" CHECK ("subtotal" >= 0 AND "grandTotal" >= 0 AND "vatTotal" >= 0 AND "amountPaid" >= 0 AND "releaseThreshold" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "orderitem_qty_positive" CHECK ("quantity" >= 1);
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "installment_plan_sane" CHECK ("installmentPrice" >= "outrightPrice" AND "thresholdKobo" <= "installmentPrice" * 2 AND "deposit" >= 0);

-- A vehicle can only be actively reserved once at a time.
CREATE UNIQUE INDEX "reservation_one_active_per_vehicle" ON "Reservation" ("productId") WHERE "status" = 'ACTIVE' AND "quantity" = 1;

-- Ledger and audit log are append-only: block UPDATE and DELETE.
CREATE OR REPLACE FUNCTION fagdan_block_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ledger_no_update BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION fagdan_block_ledger_mutation();

CREATE OR REPLACE FUNCTION fagdan_block_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fagdan_block_audit_mutation();
