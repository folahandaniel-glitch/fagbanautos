// The JS line separators cannot be written literally in source, so they are built from their code points.
const LS = new RegExp(String.fromCharCode(0x2028), "g");
const PS = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * Serialise structured data for a <script type="application/ld+json"> tag.
 * Escapes characters that could close the script element or open an HTML comment, plus the
 * JS line separators. The output is still valid JSON that parses back to the same data.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LS, "\\u2028")
    .replace(PS, "\\u2029");
}
