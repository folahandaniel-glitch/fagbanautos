import { describe, it, expect, vi, afterEach } from "vitest";
import { modelTokens, searchTerms, VENDOR_DOMAINS } from "../lib/images/search";
import { isBreachedPassword } from "../lib/auth/breach";
import { createHash } from "node:crypto";

describe("photo search helpers", () => {
  it("cleans condition words and keeps the brand", () => {
    expect(searchTerms("Camry SE (Foreign Used)", "Toyota")).toBe("Toyota Camry SE");
  });
  it("finds model tokens but not years or sizes", () => {
    expect(modelTokens("Bosch S4 battery 2.0L 2021 12v")).toEqual(["s4"]);
    expect(modelTokens("Michelin Pilot Sport 5 245/40R18")).toContain("40r18");
  });
  it("knows official sites for common brands", () => {
    expect(VENDOR_DOMAINS.toyota).toContain("toyota.com");
    expect(VENDOR_DOMAINS.bosch).toContain("bosch.com");
  });
});

describe("breached password check", () => {
  afterEach(() => vi.restoreAllMocks());
  it("flags a password whose hash suffix is in the range response", async () => {
    const sha = createHash("sha1").update("Password123").digest("hex").toUpperCase();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${sha.slice(5)}:42\nAAAAA:0`, { status: 200 }));
    expect(await isBreachedPassword("Password123")).toBe(true);
  });
  it("passes a password that is not listed and fails open when the service is down", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ABCDE:3", { status: 200 }));
    expect(await isBreachedPassword("a-very-unusual-Passphrase-93!")).toBe(false);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    expect(await isBreachedPassword("anything")).toBe(false);
  });
});
