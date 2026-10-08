import ExcelJS from "exceljs";
import { Prisma, type Condition, type ProductType } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { nairaToKobo } from "../money";
import { generateSku, generateInventoryId, generateStockNumber } from "../sku";

export const COLUMNS = [
  "Product Type", "Division", "SKU", "Inventory ID", "Stock Number", "VIN", "Make", "Model", "Trim", "Year", "Condition", "Origin", "Category", "Subcategory",
  "Body Type", "Fuel Type", "Transmission", "Drive Type", "Engine", "Horsepower", "Mileage", "Colour", "Price", "Discount", "VAT Applicable", "Installment Available",
  "Installment Percentage", "Minimum Deposit", "Release Threshold", "Stock Quantity", "Availability", "Description", "Features", "Compatibility", "Warranty",
  "Name", "Brand", "Part Number", "Part Grade", "Image 1", "Image 2", "Image 3", "Image 4", "Image 5", "Image 6", "Image 7", "Image 8", "Image 9", "Image 10",
  "Video URL", "SEO Title", "SEO Description", "Status",
] as const;
type Col = (typeof COLUMNS)[number];

const TYPES = ["VEHICLE", "PART", "ACCESSORY", "TECHNOLOGY", "OTHER"];
const CONDITIONS = ["BRAND_NEW", "FOREIGN_USED", "NIGERIAN_USED", "CERTIFIED_USED", "NEARLY_NEW", "EXECUTIVE_USED"];
const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"];

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FAGDAN Automotive Group";
  const ws = wb.addWorksheet("Inventory", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3A8F" } };
  head.height = 22;
  ws.addRow({ "Product Type": "VEHICLE", Division: "autogallery", SKU: "VEH-90001", "Inventory ID": "FAG-INV-900001", "Stock Number": "STK-2024-9001", VIN: "", Make: "Toyota", Model: "Camry", Trim: "SE", Year: 2021, Condition: "FOREIGN_USED", Origin: "USA", Category: "Sedans", "Body Type": "Sedan", "Fuel Type": "Petrol", Transmission: "Automatic", "Drive Type": "FWD", Engine: "2.5L 4-cyl", Horsepower: 203, Mileage: 45000, Colour: "Black", Price: 28500000, Discount: 0, "VAT Applicable": "YES", "Installment Available": "YES", "Stock Quantity": 1, Availability: "Available", Description: "Clean 2021 Camry SE.", Features: "Leather seats; Reverse camera", Warranty: "Inspection report", Name: "2021 Toyota Camry SE", Status: "DRAFT" });
  ws.addRow({ "Product Type": "ACCESSORY", Division: "auto-accessories", SKU: "ACC-90001", Category: "Floor Mats", Subcategory: "", Price: 75000, "VAT Applicable": "YES", "Stock Quantity": 20, Compatibility: "Toyota | Camry | 2018 | 2024", Name: "5D Floor Mat Set - Toyota Camry", Brand: "AutoLux", Description: "Custom-fit 5D mats.", "Image 1": "https://example.com/mat.jpg", Status: "DRAFT" });
  ws.getColumn("Product Type").eachCell({ includeEmpty: true }, (cell, row) => { if (row > 1 && row < 1000) cell.dataValidation = { type: "list", allowBlank: false, formulae: [`"${TYPES.join(",")}"`] }; });
  ws.getColumn("Condition").eachCell({ includeEmpty: true }, (cell, row) => { if (row > 1 && row < 1000) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${CONDITIONS.join(",")}"`] }; });
  ws.getColumn("Status").eachCell({ includeEmpty: true }, (cell, row) => { if (row > 1 && row < 1000) cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${STATUSES.join(",")}"`] }; });
  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 28 }, { width: 110 }];
  [
    ["How to use", "Fill the Inventory sheet (one product per row), save, then upload it in Admin > Excel import. You will see a preview with any errors before anything is imported."],
    ["Product Type", `One of: ${TYPES.join(", ")}.`], ["Division", "The division slug, e.g. autogallery, auto-parts, auto-accessories, auto-technology."],
    ["SKU", "Optional. Leave blank and the system generates the next code. A row whose SKU (or, when blank, name) matches an existing product updates it."], ["Vehicles", "Need Make, Model, Year, Body Type, Fuel Type, Transmission (Inventory ID and Stock Number are generated if blank). VIN must be unique."],
    ["Money", "Price and Discount are in Naira (not kobo). VAT Applicable and Installment Available: YES or NO."],
    ["Compatibility", "Separate vehicles with ';'. Each: Make | Model | Year from | Year to. Example: Toyota | Camry | 2018 | 2024; Honda | Accord | 2016 | 2022"],
    ["Features", "Separate with ';'."], ["Images", "Image 1-10: https URLs ending .jpg, .jpeg, .png or .webp. Rows with no image get a branded placeholder and are flagged 'needs image'."],
    ["Status", "DRAFT (default), ACTIVE or ARCHIVED. Review imported rows before setting ACTIVE."],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ParsedRow { rowNumber: number; data: Record<string, string>; errors: string[]; warnings: string[] }

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object") { if ("text" in v && typeof v.text === "string") return v.text.trim(); if ("result" in v) return String(v.result ?? "").trim(); if (v instanceof Date) return v.toISOString(); }
  return String(v).trim();
};

const isPrivateHost = (host: string) => /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host) || host.endsWith(".local") || host.endsWith(".internal") || host === "[::1]";

export function validateImageUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return "must be https";
    if (isPrivateHost(url.hostname)) return "private or internal address";
    if (!/\.(jpe?g|png|webp)(\?.*)?$/i.test(url.pathname + url.search)) return "must be a .jpg, .png or .webp image";
    return null;
  } catch { return "not a valid URL"; }
}

export async function parseWorkbook(buf: Buffer): Promise<{ rows: ParsedRow[]; fatal?: string }> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return { rows: [], fatal: "This file is not a valid .xlsx workbook." }; }
  const ws = wb.getWorksheet("Inventory") ?? wb.worksheets[0];
  if (!ws) return { rows: [], fatal: "The workbook has no sheets." };
  const headers = new Map<number, Col>();
  ws.getRow(1).eachCell((cell, n) => { const h = cellText(cell.value) as Col; if ((COLUMNS as readonly string[]).includes(h)) headers.set(n, h); });
  const missing = ["Product Type", "Price"].filter((c) => ![...headers.values()].includes(c as Col));
  if (missing.length) return { rows: [], fatal: `Missing required column(s): ${missing.join(", ")}. Download the latest template.` };
  if (ws.rowCount > 5001) return { rows: [], fatal: "Too many rows (maximum 5000 per import)." };
  const rows: ParsedRow[] = [];
  const seenSku = new Set<string>(), seenVin = new Set<string>(), seenStock = new Set<string>(), seenInv = new Set<string>();
  const divisions = new Set((await db.division.findMany({ select: { slug: true } })).map((d) => d.slug));
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Record<string, string> = {};
    headers.forEach((h, n) => { data[h] = cellText(row.getCell(n).value); });
    if (!Object.values(data).some(Boolean)) return;
    const errors: string[] = [], warnings: string[] = [];
    const t = data["Product Type"].toUpperCase();
    if (!TYPES.includes(t)) errors.push(`Product Type must be one of ${TYPES.join(", ")}`);
    data.SKU = data.SKU ?? "";
    if (data.SKU && data.SKU.length < 2) errors.push("SKU is too short (leave it blank to generate one)");
    else if (data.SKU) { if (seenSku.has(data.SKU.toLowerCase())) errors.push("Duplicate SKU in this file"); else seenSku.add(data.SKU.toLowerCase()); }
    if (!data.Division) errors.push("Division is required"); else if (!divisions.has(data.Division)) errors.push(`Unknown division "${data.Division}"`);
    const price = Number(data.Price.replace(/[,₦\s]/g, ""));
    if (!Number.isFinite(price) || price < 0) errors.push("Price must be a number in Naira");
    const disc = data.Discount ? Number(data.Discount.replace(/[,₦\s]/g, "")) : 0;
    if (!Number.isFinite(disc) || disc < 0 || disc > price) errors.push("Discount must be a number not above the price");
    if (data.Condition && !CONDITIONS.includes(data.Condition.toUpperCase())) errors.push(`Condition must be one of ${CONDITIONS.join(", ")}`);
    if (data.Status && !STATUSES.includes(data.Status.toUpperCase())) errors.push("Status must be DRAFT, ACTIVE or ARCHIVED");
    if (!data.Name && t !== "VEHICLE") errors.push("Name is required");
    if (t === "VEHICLE") {
      for (const c of ["Make", "Model", "Year", "Body Type", "Fuel Type", "Transmission"] as Col[]) if (!data[c]) errors.push(`${c} is required for vehicles`);
      if (data.Year && !/^(19|20)\d{2}$/.test(data.Year)) errors.push("Year must be a 4-digit year");
      if (data.VIN) { if (!/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(data.VIN)) errors.push("VIN must be 11-17 letters/digits (no I, O, Q)"); else if (seenVin.has(data.VIN.toUpperCase())) errors.push("Duplicate VIN in this file"); else seenVin.add(data.VIN.toUpperCase()); }
      if (data["Stock Number"]) { if (seenStock.has(data["Stock Number"])) errors.push("Duplicate Stock Number in this file"); else seenStock.add(data["Stock Number"]); }
      if (data["Inventory ID"]) { if (seenInv.has(data["Inventory ID"])) errors.push("Duplicate Inventory ID in this file"); else seenInv.add(data["Inventory ID"]); }
    }
    const imgs: string[] = [];
    for (let i = 1; i <= 10; i++) { const u = data[`Image ${i}`]; if (u) { const e = validateImageUrl(u); if (e) errors.push(`Image ${i}: ${e}`); else imgs.push(u); } }
    if (imgs.length === 0) warnings.push("No image: a placeholder will be used and the item flagged 'needs image'");
    rows.push({ rowNumber, data, errors, warnings });
  });
  // Cross-check against the database for conflicting unique values owned by OTHER products
  const skus = rows.map((r) => r.data.SKU).filter(Boolean);
  const names = rows.filter((r) => !r.data.SKU && r.data.Name).map((r) => r.data.Name);
  const byName = new Set((await db.product.findMany({ where: { name: { in: names } }, select: { name: true } })).map((e) => `${e.name.toLowerCase()}`));
  const existing = await db.product.findMany({ where: { sku: { in: skus } }, select: { sku: true, vehicle: { select: { vin: true, stockNumber: true, inventoryId: true } } } });
  const bySku = new Map(existing.map((e) => [e.sku.toLowerCase(), e]));
  const vins = rows.map((r) => r.data.VIN?.toUpperCase()).filter(Boolean);
  const stocks = rows.map((r) => r.data["Stock Number"]).filter(Boolean);
  const invs = rows.map((r) => r.data["Inventory ID"]).filter(Boolean);
  const clash = await db.vehicle.findMany({ where: { OR: [{ vin: { in: vins } }, { stockNumber: { in: stocks } }, { inventoryId: { in: invs } }] }, select: { vin: true, stockNumber: true, inventoryId: true, product: { select: { sku: true } } } });
  for (const r of rows) {
    const own = r.data.SKU?.toLowerCase() ?? "";
    for (const c of clash) {
      if (c.product.sku.toLowerCase() === own) continue;
      if (r.data.VIN && c.vin === r.data.VIN.toUpperCase()) r.errors.push(`VIN already belongs to ${c.product.sku}`);
      if (r.data["Stock Number"] && c.stockNumber === r.data["Stock Number"]) r.errors.push(`Stock Number already belongs to ${c.product.sku}`);
      if (r.data["Inventory ID"] && c.inventoryId === r.data["Inventory ID"]) r.errors.push(`Inventory ID already belongs to ${c.product.sku}`);
    }
    if (!own) r.warnings.push(byName.has((r.data.Name ?? "").toLowerCase()) ? "No SKU: a product with this name exists and will be UPDATED" : "No SKU: one will be generated automatically");
    else if (bySku.has(own)) r.warnings.push("SKU exists: this row will UPDATE the existing product");
  }
  return { rows };
}

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const yes = (v: string) => /^(y|yes|true|1)$/i.test(v.trim());

export async function importRows(rows: ParsedRow[], actorId: string, jobId: string) {
  const divisions = new Map((await db.division.findMany()).map((d) => [d.slug, d.id]));
  const categories = await db.category.findMany();
  const brands = new Map((await db.brand.findMany()).map((b) => [b.name.toLowerCase(), b.id]));
  let ok = 0;
  const failures: { rowNumber: number; error: string }[] = [];
  for (const r of rows) {
    if (r.errors.length) { failures.push({ rowNumber: r.rowNumber, error: r.errors.join("; ") }); continue; }
    const d = r.data;
    try {
      await db.$transaction(async (tx) => {
        const type = d["Product Type"].toUpperCase() as ProductType;
        const divisionId = divisions.get(d.Division)!;
        const catName = d.Subcategory || d.Category;
        const cat = catName ? categories.find((c) => c.divisionId === divisionId && c.name.toLowerCase() === catName.toLowerCase()) : undefined;
        let brandId = d.Brand ? brands.get(d.Brand.toLowerCase()) : d.Make ? brands.get(d.Make.toLowerCase()) : undefined;
        if (!brandId && (d.Brand || d.Make)) { const nm = d.Brand || d.Make; const b = await tx.brand.upsert({ where: { slug: slugify(nm) }, create: { name: nm, slug: slugify(nm), isVehicleMake: type === "VEHICLE" }, update: {} }); brandId = b.id; brands.set(nm.toLowerCase(), b.id); }
        const price = nairaToKobo(Number(d.Price.replace(/[,₦\s]/g, "")));
        const name = d.Name || `${d.Year} ${d.Make} ${d.Model}${d.Trim ? " " + d.Trim : ""}`;
        const imgs = Array.from({ length: 10 }, (_, i) => d[`Image ${i + 1}`]).filter(Boolean);
        const features = d.Features ? d.Features.split(";").map((s) => s.trim()).filter(Boolean) : [];
        const common = {
          type, divisionId, categoryId: cat?.id ?? null, brandId: brandId ?? null, name, shortDescription: d.Description ? d.Description.slice(0, 140) : null, description: d.Description || null,
          price: BigInt(price), discount: BigInt(d.Discount ? nairaToKobo(Number(d.Discount.replace(/[,₦\s]/g, ""))) : 0), vatApplicable: d["VAT Applicable"] ? yes(d["VAT Applicable"]) : true,
          condition: (d.Condition ? (d.Condition.toUpperCase() as Condition) : null), origin: d.Origin || null, partNumber: d["Part Number"] || null, partGrade: d["Part Grade"] === "OEM" ? ("OEM" as const) : d["Part Grade"] === "AFTERMARKET" ? ("AFTERMARKET" as const) : null,
          warranty: d.Warranty || null, features, videoUrl: d["Video URL"] || null, seoTitle: d["SEO Title"] || null, seoDescription: d["SEO Description"] || null,
          status: (d.Status ? d.Status.toUpperCase() : "DRAFT") as "DRAFT" | "ACTIVE" | "ARCHIVED", needsImage: imgs.length === 0,
        };
        const stock = type === "VEHICLE" ? 1 : Math.max(0, Math.floor(Number(d["Stock Quantity"] || 0)));
        const type2 = type;
        const existing = d.SKU ? await tx.product.findUnique({ where: { sku: d.SKU } }) : await tx.product.findFirst({ where: { name, type: type2, condition: common.condition ?? undefined } });
        const newSku = existing ? existing.sku : d.SKU || (await generateSku(type));
        const p = existing
          ? await tx.product.update({ where: { id: existing.id }, data: { ...common, ...(type === "VEHICLE" ? {} : { stockOnHand: stock }) } })
          : await tx.product.create({ data: { ...common, sku: newSku, slug: `${slugify(name)}-${slugify(newSku)}`, stockOnHand: stock } });
        if (type === "VEHICLE") {
          const prior = existing ? await tx.vehicle.findUnique({ where: { productId: existing.id } }) : null;
          const veh = { inventoryId: d["Inventory ID"] || prior?.inventoryId || (await generateInventoryId()), stockNumber: d["Stock Number"] || prior?.stockNumber || (await generateStockNumber(Number(d.Year))), vin: d.VIN ? d.VIN.toUpperCase() : null, makeName: d.Make, modelName: d.Model, trim: d.Trim || null, year: Number(d.Year), bodyType: d["Body Type"], fuelType: d["Fuel Type"], transmission: d.Transmission, driveType: d["Drive Type"] || null, engine: d.Engine || null, horsepower: d.Horsepower ? Number(d.Horsepower) : null, mileageKm: d.Mileage ? Number(d.Mileage) : null, colour: d.Colour || null, installmentAvailable: yes(d["Installment Available"] || ""), minDepositBps: d["Minimum Deposit"] ? Math.round(Number(d["Minimum Deposit"]) * 100) : null };
          await tx.vehicle.upsert({ where: { productId: p.id }, create: { productId: p.id, ...veh }, update: veh });
        }
        if (d.Compatibility) {
          await tx.compatibility.deleteMany({ where: { productId: p.id } });
          const rowsC = d.Compatibility.split(";").map((s) => s.split("|").map((x) => x.trim())).filter((x) => x[0]).map((x) => ({ productId: p.id, makeName: x[0], modelName: x[1] || null, yearFrom: x[2] ? Number(x[2]) : null, yearTo: x[3] ? Number(x[3]) : null }));
          if (rowsC.length) await tx.compatibility.createMany({ data: rowsC });
        }
        if (imgs.length) { await tx.productImage.deleteMany({ where: { productId: p.id } }); await tx.productImage.createMany({ data: imgs.map((url, i) => ({ productId: p.id, url, alt: name, sortOrder: i })) }); }
        else if ((await tx.productImage.count({ where: { productId: p.id } })) === 0) {
          const ph = type === "VEHICLE" ? `/api/placeholder?kind=vehicle&make=${encodeURIComponent(d.Make)}&model=${encodeURIComponent(d.Model)}&year=${d.Year}&colour=${encodeURIComponent(d.Colour || "")}&i=1` : `/api/placeholder?kind=product&label=${encodeURIComponent(d.Category || "Product")}&brand=${encodeURIComponent(d.Brand || "")}`;
          await tx.productImage.create({ data: { productId: p.id, url: ph, alt: `${name} (placeholder image)`, isPlaceholder: true } });
        }
      });
      ok++;
    } catch (e) {
      const msg = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? `Duplicate value (${(e.meta?.target as string[] | undefined)?.join(", ")})` : e instanceof Error ? e.message.split("\n").pop()! : "Unknown error";
      failures.push({ rowNumber: r.rowNumber, error: msg });
    }
  }
  await db.importJob.update({ where: { id: jobId }, data: { status: failures.length ? (ok ? "PARTIAL" : "FAILED") : "IMPORTED", succeeded: ok, failed: failures.length } });
  await audit({ actorId, action: "inventory.import", targetType: "ImportJob", targetId: jobId, after: { ok, failed: failures.length } });
  return { ok, failures };
}

export async function exportWorkbook(name: string, columns: { header: string; key: string; width?: number }[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FAGDAN Automotive Group";
  const ws = wb.addWorksheet(name.slice(0, 30), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ ...c, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3A8F" } };
  // Values are written as typed cells (strings stay strings), so text like "=SUM(A1)" is never evaluated as a formula in .xlsx.
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

