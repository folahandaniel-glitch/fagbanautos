import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { settingPermission } from "../lib/settings-defaults";
import { optimiseImage } from "../lib/images/optimize";
import { accentLines } from "../lib/content";

describe("image optimiser", () => {
  it("compresses a large image to WebP within 1600x1200", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#356" } }).jpeg({ quality: 95 }).toBuffer();
    const out = await optimiseImage(big);
    expect(out.mime).toBe("image/webp");
    expect(out.width).toBeLessThanOrEqual(1600);
    expect(out.height).toBeLessThanOrEqual(1200);
    expect(out.bytes.length).toBeLessThan(big.length);
  });
  it("rejects data that is not an image", async () => {
    await expect(optimiseImage(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("website wording permissions", () => {
  it("lets content editors change homepage and page text but not tax settings", () => {
    expect(settingPermission("home.headline")).toBe("content:edit");
    expect(settingPermission("pages.cars.title")).toBe("content:edit");
    expect(settingPermission("vat.rate")).toBe("settings:vat");
  });
  it("parses *accent* words per line", () => {
    const lines = accentLines("Driven by *Trust.*\nPowered by *Choice.*");
    expect(lines).toHaveLength(2);
  });
});
