import { describe, it, expect } from "vitest";
import { jsonLd } from "../lib/json-ld";

describe("JSON-LD serialiser", () => {
  it("cannot be used to break out of the script element", () => {
    const out = jsonLd({ name: '</script><script>alert(1)</script>', note: '<!-- x -->', amp: 'a&b' });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>'); // data survives round-trip
  });
});
