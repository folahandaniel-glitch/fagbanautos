import { cache } from "react";
import { getSettings } from "./settings";

/** Website wording lives in Admin > System settings > Homepage / Page text. This returns a lookup for the current request. */
export const getContent = cache(async () => {
  const s = await getSettings();
  const t = (key: string): string => String(s[key] ?? "");
  const list = (key: string): string[] => t(key).split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  const lines = (key: string): string[] => t(key).split("\n").map((x) => x.trim()).filter(Boolean);
  const flag = (key: string): boolean => s[key] === true;
  return { t, list, lines, flag };
});

export interface AccentSegment { text: string; accent: boolean }

/** "Driven by *Trust.*" -> [{Driven by , false}, {Trust., true}]. One array per line. */
export function accentLines(text: string): AccentSegment[][] {
  return text.split("\n").filter((l) => l.trim()).map((line) =>
    line.split(/(\*[^*]+\*)/).filter(Boolean).map((seg) => (seg.startsWith("*") && seg.endsWith("*") ? { text: seg.slice(1, -1), accent: true } : { text: seg, accent: false })),
  );
}
