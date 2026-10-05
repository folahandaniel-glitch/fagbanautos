import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { SETTING_DEFS } from "./settings-defaults";
import { audit } from "./audit";
import type { PricingSettings } from "./pricing/engine";

type Cache = { at: number; map: Map<string, unknown> };
const g = globalThis as unknown as { __settingsCache?: Cache };
const TTL_MS = 15_000;

async function load(): Promise<Map<string, unknown>> {
  const now = Date.now();
  if (g.__settingsCache && now - g.__settingsCache.at < TTL_MS) return g.__settingsCache.map;
  const rows = await db.setting.findMany();
  const map = new Map<string, unknown>();
  for (const [k, d] of Object.entries(SETTING_DEFS)) map.set(k, d.value);
  for (const r of rows) map.set(r.key, r.value);
  g.__settingsCache = { at: now, map };
  return map;
}

export function invalidateSettings(): void {
  g.__settingsCache = undefined;
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const map = await load();
  return map.get(key) as T;
}

export async function getSettings(prefix?: string): Promise<Record<string, unknown>> {
  const map = await load();
  const out: Record<string, unknown> = {};
  for (const [k, v] of map) if (!prefix || k.startsWith(prefix)) out[k] = v;
  return out;
}

/** Versioned, audited setting write. Caller must already have checked the permission. */
export async function setSetting(key: string, value: unknown, actorId: string | null, reason?: string): Promise<void> {
  const def = SETTING_DEFS[key];
  if (!def) throw new Error(`Unknown setting: ${key}`);
  if (def.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`${key} must be a number`);
  if (def.type === "boolean" && typeof value !== "boolean") throw new Error(`${key} must be true or false`);
  if (def.type === "select" && !def.options?.includes(String(value))) throw new Error(`${key} has an invalid option`);

  await db.$transaction(async (tx) => {
    const existing = await tx.setting.findUnique({ where: { key } });
    const version = (existing?.version ?? 0) + 1;
    const json = value as Prisma.InputJsonValue;
    await tx.setting.upsert({
      where: { key },
      create: { key, value: json, group: def.group, version, updatedBy: actorId ?? undefined },
      update: { value: json, version, updatedBy: actorId ?? undefined },
    });
    await tx.settingVersion.create({
      data: { key, version, oldValue: (existing?.value ?? def.value) as Prisma.InputJsonValue, newValue: json, reason, actorId: actorId ?? undefined },
    });
    await audit({ actorId, action: `settings.${key}.update`, targetType: "Setting", targetId: key, before: existing?.value ?? def.value, after: value, reason }, tx);
  });
  invalidateSettings();
}

/** Pricing configuration as used by the central engine. Always read from settings, never hardcoded. */
export async function getPricingSettings(): Promise<PricingSettings> {
  const s = await getSettings();
  return {
    vatRateBps: Number(s["vat.rateBps"]),
    installmentUpliftBps: Number(s["installment.upliftBps"]),
    releaseThresholdBps: Number(s["installment.releaseThresholdBps"]),
    thresholdBasis: s["installment.thresholdBasis"] as PricingSettings["thresholdBasis"],
    tradeInTreatment: s["installment.tradeInTreatment"] as PricingSettings["tradeInTreatment"],
  };
}
