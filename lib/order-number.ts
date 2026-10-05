/** Format FAG-YYYYMMDD-NNNNNN. The sequence value comes from a database counter row locked in the creating transaction. */
export function lagosDateStamp(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-");
  return parts.join("");
}

export function formatOrderNumber(dateStamp: string, seq: number): string {
  if (!/^\d{8}$/.test(dateStamp)) throw new Error("invalid date stamp");
  if (!Number.isInteger(seq) || seq < 1) throw new Error("invalid sequence");
  return `FAG-${dateStamp}-${String(seq).padStart(6, "0")}`;
}
