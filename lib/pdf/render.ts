import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** A document is a list of simple blocks, so every document type shares one tested renderer. */
export type Block =
  | { kind: "meta"; left: [string, string][]; right?: [string, string][] }
  | { kind: "heading"; text: string }
  | { kind: "table"; columns: { header: string; width: number; align?: "left" | "right" }[]; rows: string[][]; emptyText?: string }
  | { kind: "totals"; rows: { label: string; value: string; strong?: boolean }[] }
  | { kind: "paragraph"; text: string; small?: boolean }
  | { kind: "banner"; text: string; tone: "ok" | "warn" | "danger" | "info" }
  | { kind: "spacer"; height?: number };

export interface DocModel {
  title: string; // e.g. "TAX INVOICE"
  number: string;
  date: string; // display string
  seller: { name: string; lines: string[] };
  footerNote: string;
  blocks: Block[];
}

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 40, top: 40, bottom: 56 };
const BRAND = rgb(0x0b / 255, 0x3a / 255, 0x8f / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
const INK = rgb(0.07, 0.09, 0.13);
const MUTED = rgb(0.36, 0.4, 0.46);
const LINE = rgb(0.86, 0.89, 0.94);
const TONES = { ok: rgb(0.06, 0.48, 0.25), warn: rgb(0.6, 0.4, 0), danger: rgb(0.71, 0.14, 0.09), info: BRAND };

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
let fontBytes: Promise<[Buffer, Buffer, Buffer, Buffer, Buffer]> | undefined;
const loadFiles = () =>
  (fontBytes ??= Promise.all([
    readFile(path.join(FONT_DIR, "noto-sans-latin-400-normal.woff")), readFile(path.join(FONT_DIR, "noto-sans-latin-700-normal.woff")),
    readFile(path.join(FONT_DIR, "noto-sans-latin-ext-400-normal.woff")), readFile(path.join(FONT_DIR, "noto-sans-latin-ext-700-normal.woff")),
    readFile(path.join(process.cwd(), "public", "brand", "logo.png")),
  ]));

interface Fonts { reg: PDFFont; bold: PDFFont; extReg: PDFFont; extBold: PDFFont }

/** Characters are drawn with the Latin font, except the Naira sign which only the Latin-Extended subset contains. */
class Typesetter {
  private sets = new Map<PDFFont, Set<number>>();
  constructor(private f: Fonts) {
    for (const x of [f.reg, f.bold, f.extReg, f.extBold]) this.sets.set(x, new Set(x.getCharacterSet()));
  }
  private clean(text: string): string {
    return text.replace(/[\r\n\t]+/g, " ").split("").map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (ch === "₦") return ch;
      return this.sets.get(this.f.reg)!.has(cp) ? ch : "?";
    }).join("");
  }
  private runs(text: string, bold: boolean): { text: string; font: PDFFont }[] {
    const out: { text: string; font: PDFFont }[] = [];
    for (const part of this.clean(text).split(/(₦)/)) {
      if (!part) continue;
      out.push({ text: part, font: part === "₦" ? (bold ? this.f.extBold : this.f.extReg) : bold ? this.f.bold : this.f.reg });
    }
    return out;
  }
  width(text: string, size: number, bold = false): number {
    return this.runs(text, bold).reduce((a, r) => a + r.font.widthOfTextAtSize(r.text, size), 0);
  }
  draw(page: PDFPage, text: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) {
    const w = this.width(text, size, opts.bold);
    let cx = opts.align === "right" ? x - w : x;
    for (const r of this.runs(text, !!opts.bold)) {
      page.drawText(r.text, { x: cx, y, size, font: r.font, color: opts.color ?? INK });
      cx += r.font.widthOfTextAtSize(r.text, size);
    }
  }
  wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      let cur = "";
      for (const word of this.clean(para).split(" ")) {
        const next = cur ? `${cur} ${word}` : word;
        if (this.width(next, size, bold) <= maxWidth || !cur) {
          if (this.width(next, size, bold) > maxWidth) {
            // single long token: hard-split
            let chunk = "";
            for (const ch of next) { if (this.width(chunk + ch, size, bold) > maxWidth) { lines.push(chunk); chunk = ch; } else chunk += ch; }
            cur = chunk;
          } else cur = next;
        } else { lines.push(cur); cur = word; }
      }
      lines.push(cur);
    }
    return lines;
  }
}

export async function renderDocument(model: DocModel): Promise<Uint8Array> {
  const [regB, boldB, extRegB, extBoldB, logoB] = await loadFiles();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${model.title} ${model.number}`);
  pdf.setAuthor(model.seller.name);
  pdf.setCreator("FAGDAN Automotive Group");
  const fonts: Fonts = {
    reg: await pdf.embedFont(regB, { subset: true }), bold: await pdf.embedFont(boldB, { subset: true }),
    extReg: await pdf.embedFont(extRegB, { subset: true }), extBold: await pdf.embedFont(extBoldB, { subset: true }),
  };
  const ts = new Typesetter(fonts);
  const logo: PDFImage = await pdf.embedPng(logoB);
  const contentW = A4.w - M.x * 2;

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const header = (first: boolean) => {
    if (first) {
      const lh = 46, lw = (logo.width / logo.height) * lh;
      page.drawImage(logo, { x: M.x, y: y - lh, width: lw, height: lh });
      ts.draw(page, model.title, A4.w - M.x, y - 18, 20, { bold: true, color: BRAND, align: "right" });
      ts.draw(page, model.number, A4.w - M.x, y - 34, 10, { bold: true, align: "right" });
      ts.draw(page, model.date, A4.w - M.x, y - 47, 9, { color: MUTED, align: "right" });
      y -= lh + 10;
      page.drawRectangle({ x: M.x, y: y - 2, width: contentW, height: 2, color: GOLD });
      y -= 14;
      ts.draw(page, model.seller.name, M.x, y, 10, { bold: true });
      y -= 12;
      for (const l of model.seller.lines) { ts.draw(page, l, M.x, y, 8.5, { color: MUTED }); y -= 11; }
      y -= 8;
    } else {
      ts.draw(page, `${model.title} ${model.number}`, M.x, y - 8, 9, { bold: true, color: MUTED });
      y -= 26;
    }
  };
  header(true);

  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); y = A4.h - M.top; header(false); };
  const ensure = (h: number) => { if (y - h < M.bottom) newPage(); };

  for (const b of model.blocks) {
    if (b.kind === "spacer") { y -= b.height ?? 10; continue; }
    if (b.kind === "heading") {
      ensure(30);
      ts.draw(page, b.text.toUpperCase(), M.x, y - 10, 9, { bold: true, color: BRAND });
      page.drawRectangle({ x: M.x, y: y - 14, width: contentW, height: 0.6, color: LINE });
      y -= 22;
    } else if (b.kind === "meta") {
      const colW = b.right ? contentW / 2 - 8 : contentW;
      const render = (rows: [string, string][], x: number) => {
        let yy = y;
        for (const [k, v] of rows) {
          ts.draw(page, k, x, yy - 9, 8, { color: MUTED });
          const lines = ts.wrap(v, colW - 92, 9.5);
          lines.forEach((ln, i) => ts.draw(page, ln, x + 92, yy - 9 - i * 11.5, 9.5));
          yy -= Math.max(14, lines.length * 11.5 + 3);
        }
        return yy;
      };
      const estimate = Math.max(b.left.length, b.right?.length ?? 0) * 16;
      ensure(Math.min(estimate, 120));
      const yl = render(b.left, M.x);
      const yr = b.right ? render(b.right, M.x + contentW / 2 + 8) : y;
      y = Math.min(yl, yr) - 6;
    } else if (b.kind === "table") {
      const total = b.columns.reduce((a, c) => a + c.width, 0);
      const cw = b.columns.map((c) => (c.width / total) * contentW);
      const size = 8.5, pad = 5;
      const drawHeader = () => {
        ensure(26);
        page.drawRectangle({ x: M.x, y: y - 20, width: contentW, height: 20, color: BRAND });
        let x = M.x;
        b.columns.forEach((c, i) => { ts.draw(page, c.header, c.align === "right" ? x + cw[i] - pad : x + pad, y - 13.5, size, { bold: true, color: rgb(1, 1, 1), align: c.align === "right" ? "right" : "left" }); x += cw[i]; });
        y -= 20;
      };
      drawHeader();
      if (b.rows.length === 0) { ts.draw(page, b.emptyText ?? "No records.", M.x + pad, y - 14, 9, { color: MUTED }); y -= 24; }
      b.rows.forEach((row, ri) => {
        const cells = row.map((v, i) => ts.wrap(v, cw[i] - pad * 2, size));
        const h = Math.max(...cells.map((c) => c.length)) * 11 + 9;
        if (y - h < M.bottom) { newPage(); drawHeader(); }
        if (ri % 2 === 1) page.drawRectangle({ x: M.x, y: y - h, width: contentW, height: h, color: rgb(0.965, 0.973, 0.988) });
        let x = M.x;
        cells.forEach((lines, i) => {
          lines.forEach((ln, li) => ts.draw(page, ln, b.columns[i].align === "right" ? x + cw[i] - pad : x + pad, y - 12 - li * 11, size, { align: b.columns[i].align === "right" ? "right" : "left" }));
          x += cw[i];
        });
        page.drawRectangle({ x: M.x, y: y - h, width: contentW, height: 0.4, color: LINE });
        y -= h;
      });
      y -= 8;
    } else if (b.kind === "totals") {
      const w = 230, x0 = A4.w - M.x - w;
      ensure(b.rows.length * 17 + 10);
      for (const r of b.rows) {
        if (r.strong) { page.drawRectangle({ x: x0 - 6, y: y - 19, width: w + 6, height: 21, color: rgb(0.92, 0.94, 0.98) }); }
        ts.draw(page, r.label, x0, y - 13, r.strong ? 10 : 9, { bold: r.strong, color: r.strong ? INK : MUTED });
        ts.draw(page, r.value, A4.w - M.x - 4, y - 13, r.strong ? 11 : 9.5, { bold: r.strong, align: "right" });
        y -= r.strong ? 23 : 16;
      }
      y -= 8;
    } else if (b.kind === "paragraph") {
      const size = b.small ? 8 : 9.5;
      const lines = ts.wrap(b.text, contentW, size);
      for (const ln of lines) { ensure(size + 6); ts.draw(page, ln, M.x, y - size, size, { color: b.small ? MUTED : INK }); y -= size + 3.5; }
      y -= 6;
    } else if (b.kind === "banner") {
      const c = TONES[b.tone];
      const lines = ts.wrap(b.text, contentW - 24, 10, true);
      const h = lines.length * 13 + 14;
      ensure(h + 8);
      page.drawRectangle({ x: M.x, y: y - h, width: contentW, height: h, color: rgb(c.red * 0.12 + 0.88, c.green * 0.12 + 0.88, c.blue * 0.12 + 0.88), borderColor: c, borderWidth: 0.8 });
      lines.forEach((ln, i) => ts.draw(page, ln, M.x + 12, y - 17 - i * 13, 10, { bold: true, color: c }));
      y -= h + 10;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: M.x, y: 44, width: contentW, height: 0.6, color: LINE });
    for (const [li, ln] of ts.wrap(model.footerNote, contentW - 70, 7).slice(0, 2).entries()) ts.draw(p, ln, M.x, 34 - li * 9, 7, { color: MUTED });
    ts.draw(p, `Page ${i + 1} of ${pages.length}`, A4.w - M.x, 34, 7.5, { color: MUTED, align: "right" });
  });
  return pdf.save();
}
