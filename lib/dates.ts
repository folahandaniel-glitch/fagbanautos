/** Date helpers kept out of render functions (impure `Date.now()` calls live here). */
export function tomorrowIso(): string {
  return new Date(Date.now() + 86_400_000 + 3_600_000).toISOString().slice(0, 10);
}
