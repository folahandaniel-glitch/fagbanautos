import { describe, it, expect } from "vitest";
import { extractImages } from "../lib/images/vendor";
import { safeGet } from "../lib/images/safe-fetch";

describe("vendor picture extraction", () => {
  const base = new URL("https://www.brand.com/products/item");
  it("reads Open Graph, JSON-LD and large img tags, skipping logos", () => {
    const html = `<head><meta property="og:image" content="/img/main.jpg"/>
      <script type="application/ld+json">{"@type":"Product","image":["https://cdn.brand.com/a.webp",{"url":"https://cdn.brand.com/b.png"}]}</script></head>
      <body><img src="/assets/logo.png" width="500"><img src="/img/side.jpg" width="800"><img src="/img/tiny.jpg" width="40"><img src="http://insecure.com/x.jpg" width="900"></body>`;
    const out = extractImages(html, base);
    expect(out).toContain("https://www.brand.com/img/main.jpg");
    expect(out).toContain("https://cdn.brand.com/a.webp");
    expect(out).toContain("https://cdn.brand.com/b.png");
    expect(out).toContain("https://www.brand.com/img/side.jpg");
    expect(out.some((u) => /logo|tiny|insecure/.test(u))).toBe(false);
  });
});

describe("safe fetching", () => {
  it("refuses non-https, credentials and private addresses", async () => {
    const opts = { accept: "text/html", maxBytes: 1000 };
    await expect(safeGet("http://example.com/", opts)).rejects.toThrow();
    await expect(safeGet("https://user:pw@example.com/", opts)).rejects.toThrow();
    await expect(safeGet("https://127.0.0.1/", opts)).rejects.toThrow();
    await expect(safeGet("https://192.168.1.10/x", opts)).rejects.toThrow();
  });
});
