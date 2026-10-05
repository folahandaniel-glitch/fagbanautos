import { db } from "../db";

const num = (n: bigint | number | null | undefined) => Number(n ?? 0);

/** Aggregates for the command centre. Revenue counts VERIFIED ledger payments only. */
export async function dashboardStats() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [revenue, orders, vehiclesSold, productsSold, bookings, customers, leads, wonLeads, vat, vatOff, inv, installBal, statusGroups, ledger, pendingProofs, vatPending, lowStock, activeVehicles] = await Promise.all([
    db.ledgerEntry.aggregate({ where: { type: "PAYMENT" }, _sum: { amount: true } }),
    db.order.count(),
    db.orderItem.count({ where: { product: { type: "VEHICLE" }, order: { status: { in: ["PAID", "DELIVERED", "COMPLETED", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "PROCESSING"] } } } }),
    db.orderItem.aggregate({ where: { product: { type: { not: "VEHICLE" } } }, _sum: { quantity: true } }),
    db.serviceBooking.count(),
    db.customer.count(),
    db.lead.count(),
    db.lead.count({ where: { stage: "WON" } }),
    db.order.aggregate({ where: { vatEnabled: true, status: { notIn: ["CANCELLED"] } }, _sum: { vatTotal: true } }),
    db.vatRecord.aggregate({ where: { status: { in: ["APPLIED", "APPROVED"] } }, _sum: { vatRemoved: true } }),
    db.product.aggregate({ where: { status: "ACTIVE" }, _sum: { price: true } }),
    db.$queryRaw<{ s: bigint | null }[]>`SELECT COALESCE(SUM(o."grandTotal" - o."tradeInCredit" - o."amountPaid"),0) s FROM "Order" o WHERE o."paymentMode"='INSTALLMENT' AND o.status NOT IN ('CANCELLED','REFUNDED','COMPLETED')`,
    db.order.groupBy({ by: ["status"], _count: true }),
    db.$queryRaw<{ m: Date; s: bigint }[]>`SELECT date_trunc('month', "createdAt") m, SUM(amount) s FROM "LedgerEntry" WHERE type='PAYMENT' AND "createdAt" >= ${sixMonthsAgo} GROUP BY 1 ORDER BY 1`,
    db.payment.count({ where: { status: "AWAITING_VERIFICATION" } }),
    db.vatRecord.count({ where: { status: "PENDING_APPROVAL" } }),
    db.product.count({ where: { status: "ACTIVE", type: { not: "VEHICLE" }, stockOnHand: { lte: 3 } } }),
    db.product.count({ where: { status: "ACTIVE", type: "VEHICLE" } }),
  ]);
  // Inventory value = cost proxy: sum(price x available units) for active stock
  const invValue = await db.$queryRaw<{ v: bigint | null }[]>`SELECT COALESCE(SUM(price * GREATEST("stockOnHand" - "stockReserved",0)),0) v FROM "Product" WHERE status='ACTIVE'`;
  void inv;
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const byMonth = months.map((m) => ({ label: m.toLocaleString("en-NG", { month: "short" }), value: num(ledger.find((l) => new Date(l.m).getUTCFullYear() === m.getFullYear() && new Date(l.m).getUTCMonth() === m.getMonth())?.s) }));
  return {
    revenue: num(revenue._sum.amount), orders, vehiclesSold, productsSold: productsSold._sum.quantity ?? 0, bookings, customers, leads,
    conversion: leads ? Math.round((wonLeads / leads) * 1000) / 10 : 0, vatCollected: num(vat._sum.vatTotal), vatExempted: num(vatOff._sum.vatRemoved),
    inventoryValue: num(invValue[0]?.v), installmentBalance: num(installBal[0]?.s), statusGroups: statusGroups.map((g) => ({ status: g.status, count: g._count })), byMonth,
    pendingProofs, vatPending, lowStock, activeVehicles,
  };
}
