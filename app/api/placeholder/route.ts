import { NextRequest } from "next/server";
import { iconFor } from "@/lib/placeholder-icons";

/**
 * Generated placeholder imagery for demo inventory. These are clearly labelled illustrations,
 * never presented as photographs of real stock. Super Admin replaces them with real photos.
 */
const esc = (s: string) => s.replace(/[<>&"']/g, "").slice(0, 40);
const COLOURS: Record<string, string> = {
  black: "#1c1f26", white: "#f2f4f8", silver: "#aeb4c0", grey: "#6f7685", blue: "#1d4fb3", red: "#b3261e", "pearl white": "#eef0f6",
  "midnight blue": "#10286b", champagne: "#d8c79a", "dark green": "#1f5a3d", brown: "#6b4a2e",
};

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const kind = q.get("kind") ?? "vehicle";
  const w = 1200, h = 800;
  let body = "";
  if (kind === "vehicle") {
    const make = esc(q.get("make") ?? ""), model = esc(q.get("model") ?? ""), year = esc(q.get("year") ?? "");
    const paint = COLOURS[(q.get("colour") ?? "").toLowerCase()] ?? "#1d4fb3";
    const i = Number(q.get("i") ?? 1);
    const shift = [0, -40, 40][(i - 1) % 3] ?? 0;
    body = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1c46"/><stop offset="1" stop-color="#143a8c"/></linearGradient>
        <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e6ff" stop-opacity=".9"/><stop offset="1" stop-color="#8fb0ee" stop-opacity=".7"/></linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#bg)"/>
      <ellipse cx="${600 + shift}" cy="620" rx="430" ry="38" fill="#000" opacity=".35"/>
      <g transform="translate(${shift},0)">
        <path d="M170 520 C170 470 205 440 255 432 L400 330 C430 306 470 292 515 292 L735 292 C790 292 835 312 872 346 L960 430 C1010 436 1040 470 1040 520 L1040 560 L170 560 Z" fill="${paint}"/>
        <path d="M420 346 L520 306 L735 306 C775 306 805 320 832 346 L896 416 L400 416 Z" fill="url(#gl)"/>
        <path d="M640 306 L640 416" stroke="${paint}" stroke-width="10"/>
        <rect x="170" y="520" width="870" height="14" fill="#000" opacity=".18"/>
        <circle cx="350" cy="560" r="68" fill="#10131a"/><circle cx="350" cy="560" r="38" fill="#9aa3b5"/><circle cx="350" cy="560" r="14" fill="#10131a"/>
        <circle cx="860" cy="560" r="68" fill="#10131a"/><circle cx="860" cy="560" r="38" fill="#9aa3b5"/><circle cx="860" cy="560" r="14" fill="#10131a"/>
        <rect x="1000" y="468" width="46" height="22" rx="8" fill="#ffe9a8"/><rect x="164" y="470" width="34" height="20" rx="8" fill="#ff6b5e"/>
      </g>
      <text x="60" y="110" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#fff">${year} ${make}</text>
      <text x="60" y="170" font-family="Arial, Helvetica, sans-serif" font-size="44" fill="#c9a227">${model}</text>`;
  } else if (kind === "proof") {
    body = `<rect width="${w}" height="${h}" fill="#f4f6fb"/><text x="600" y="400" text-anchor="middle" font-family="Arial" font-size="48" fill="#5b6475">Demo proof of payment</text>`;
  } else {
    const label = esc(q.get("label") ?? "Product"), brand = esc(q.get("brand") ?? "");
    body = `
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fd"/><stop offset="1" stop-color="#d6e2f8"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#bg)"/>
      <circle cx="600" cy="340" r="300" fill="url(#glow)"/>
      <ellipse cx="600" cy="545" rx="190" ry="22" fill="#071f4d" opacity=".12"/>
      <g transform="translate(600,330) scale(1.45)">${iconFor(label)}</g>
      <text x="600" y="660" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="#071f4d">${label}</text>
      <text x="600" y="712" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#5b6475">${brand}</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${body}</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
