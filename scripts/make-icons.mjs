// Generates favicon, PWA and social icons from the original FAGDAN logo (public/brand/logo-original.png).
// Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const src = "public/brand/logo-original.png";
mkdirSync("public/icons", { recursive: true });

// Trim the white margin, then make a transparent-background logo by keying out near-white.
const trimmed = await sharp(src).trim({ threshold: 18 }).toBuffer();
const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const min = Math.min(data[i], data[i + 1], data[i + 2]);
  if (min > 245) data[i + 3] = 0;
  else if (min > 215) data[i + 3] = Math.round(((245 - min) / 30) * 255);
}
const transparent = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
await sharp(transparent).resize({ width: 900 }).png({ compressionLevel: 9 }).toFile("public/brand/logo.png");

// Mark only (the "F" with car): crop the top ~62% of the trimmed logo.
const meta = await sharp(trimmed).metadata();
const mark = await sharp(trimmed)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.62) })
  .trim({ threshold: 18 })
  .toBuffer();

async function icon(size, file, { pad = 0.14, bg = "#FFFFFF" } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const m = await sharp(mark).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: m, gravity: "center" }])
    .png()
    .toFile(file);
}

await icon(512, "public/icons/icon-512.png");
await icon(192, "public/icons/icon-192.png");
await icon(512, "public/icons/maskable-512.png", { pad: 0.24 }); // extra safe zone for maskable
await icon(180, "public/icons/apple-touch-icon.png", { pad: 0.12 });
await icon(32, "public/icons/favicon-32.png", { pad: 0.04 });
await icon(16, "public/icons/favicon-16.png", { pad: 0.02 });

// favicon.ico (PNG-in-ICO, 32x32 + 16x16)
const png32 = await sharp("public/icons/favicon-32.png").toBuffer();
const png16 = await sharp("public/icons/favicon-16.png").toBuffer();
const entries = [[32, png32], [16, png16]];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
let offset = 6 + entries.length * 16;
const dirs = [];
for (const [s, buf] of entries) {
  const d = Buffer.alloc(16);
  d[0] = s; d[1] = s; d[2] = 0; d[3] = 0;
  d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
  d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12);
  offset += buf.length;
  dirs.push(d);
}
writeFileSync("app/favicon.ico", Buffer.concat([header, ...dirs, ...entries.map((e) => e[1])]));

// SVG favicon (brand colours)
writeFileSync(
  "public/icons/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#071F4D"/><path d="M18 14h30l-4 8H27l-2 6h16l-3 7H22l-5 14H9z" fill="#0B3A8F"/><path d="M22 28h30l-4 7H20z" fill="#C9A227"/></svg>`
);

// Open Graph image 1200x630 (navy background + logo)
const logoForOg = await sharp(transparent).resize({ height: 420 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#FFFFFF" } })
  .composite([{ input: logoForOg, gravity: "center" }])
  .png()
  .toFile("public/icons/og-image.png");

console.log("icons generated");
