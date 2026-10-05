/** Configuration for the generic admin workflow screens. Statuses are the single source of truth for both UI and server validation. */
export interface WorkflowDef {
  kind: string; title: string; view: string; edit: string; statuses: string[]; statusField: string;
  extra?: "valuation" | "cash" | "lead" | "task";
}

export const IMPORT_STATUSES = ["REQUEST_RECEIVED", "VEHICLE_SOURCING", "VEHICLE_FOUND", "CUSTOMER_APPROVAL", "PURCHASE_PROCESSING", "SHIPPING", "IN_TRANSIT", "PORT_ARRIVAL", "CUSTOMS_PROCESSING", "INSPECTION", "DOCUMENTATION", "READY_FOR_DELIVERY", "COMPLETED", "CANCELLED"];
export const LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "VEHICLE_SELECTED", "TEST_DRIVE", "NEGOTIATION", "PAYMENT_PENDING", "WON", "LOST"];

export const WORKFLOWS: Record<string, WorkflowDef> = {
  leads: { kind: "leads", title: "Leads (CRM pipeline)", view: "leads:view", edit: "leads:edit", statuses: LEAD_STAGES, statusField: "stage", extra: "lead" },
  tasks: { kind: "tasks", title: "Tasks", view: "tasks:view", edit: "tasks:edit", statuses: ["OPEN", "IN_PROGRESS", "DONE"], statusField: "status", extra: "task" },
  bookings: { kind: "bookings", title: "Service bookings", view: "bookings:view", edit: "bookings:edit", statuses: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"], statusField: "status" },
  imports: { kind: "imports", title: "Import cases", view: "imports:view", edit: "imports:edit", statuses: IMPORT_STATUSES, statusField: "status" },
  tradeins: { kind: "tradeins", title: "Trade-ins and valuations", view: "tradeins:view", edit: "tradeins:edit", statuses: ["SUBMITTED", "UNDER_REVIEW", "VALUED", "OFFER_SENT", "ACCEPTED", "DECLINED", "APPLIED"], statusField: "status", extra: "valuation" },
  swaps: { kind: "swaps", title: "Car swaps", view: "swaps:view", edit: "swaps:edit", statuses: ["REQUESTED", "VALUATION", "OFFER", "NEGOTIATION", "AGREED", "COMPLETED", "DECLINED"], statusField: "status", extra: "cash" },
  finance: { kind: "finance", title: "Finance applications", view: "finance_applications:view", edit: "finance_applications:edit", statuses: ["SUBMITTED", "DOCUMENTS_REQUESTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "CLOSED"], statusField: "status" },
};
