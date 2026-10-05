/**
 * Seed script.
 *  - Core seed (always safe): permissions, roles, divisions, categories, brands, gateway rows, CMS, menus, templates, staff accounts.
 *  - Demo seed (blocked in production unless ALLOW_DEMO_SEED=true): vehicles, products, services, customers, leads, orders, etc.
 *    Every demo record has isDemo = true and uses generated placeholder imagery.
 *
 * Staff accounts get random one-time passwords, forced to change on first login. They are written to
 * .seed-credentials.txt (git-ignored) and never to source control or logs.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient, type Condition } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { ALL_PERMISSION_KEYS, ROLES, grantsToKeys } from "../lib/rbac/permissions";
import { randomPassword } from "../lib/crypto";
import { DIVISIONS, PRODUCT_TEMPLATES, SERVICES, FIRST_NAMES, LAST_NAMES } from "./seed-data/catalogue";
import { VEHICLE_SEEDS, COLOURS, NG_STATES, rng, pick } from "./seed-data/vehicles";
import { createOrder, applyVerifiedPayment, buildQuote } from "../lib/services/orders";
import { nairaToKobo as N } from "../lib/money";
import { LEGAL_PAGES } from "./seed-data/legal";

const db = new PrismaClient();
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ARGON = { algorithm: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const isProd = process.env.NODE_ENV === "production";
const allowDemo = !isProd || process.env.ALLOW_DEMO_SEED === "true";

const credentials: string[] = [];

async function seedAccess() {
  for (const key of ALL_PERMISSION_KEYS) {
    const [resource, action] = key.split(":");
    await db.permission.upsert({ where: { key }, create: { key, resource, action }, update: {} });
  }
  for (const r of ROLES) {
    const role = await db.role.upsert({ where: { key: r.key }, create: { key: r.key, name: r.name, description: r.description, isSystem: true }, update: { name: r.name, description: r.description } });
    const keys = grantsToKeys(r.grants);
    const perms = await db.permission.findMany({ where: { key: { in: keys } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  console.log(`roles: ${ROLES.length}, permissions: ${ALL_PERMISSION_KEYS.length}`);
}

const STAFF = [
  { role: "SUPER_ADMIN", email: "superadmin@fagdan.example", name: "Super Administrator" },
  { role: "INVENTORY_MANAGER", email: "inventory@fagdan.example", name: "Inventory Manager" },
  { role: "SALES_MANAGER", email: "sales@fagdan.example", name: "Sales Manager" },
  { role: "FINANCE_MANAGER", email: "finance@fagdan.example", name: "Finance Manager" },
  { role: "CUSTOMER_RELATIONS", email: "customers@fagdan.example", name: "Customer Relations Manager" },
  { role: "MARKETING_MANAGER", email: "marketing@fagdan.example", name: "Marketing Manager" },
  { role: "CONTENT_SEO_MANAGER", email: "content@fagdan.example", name: "Content and SEO Manager" },
  { role: "TRADEIN_SWAP_MANAGER", email: "tradein@fagdan.example", name: "Trade-in and Swap Manager" },
  { role: "AUTO_CARE_MANAGER", email: "autocare@fagdan.example", name: "Auto Care Manager" },
  { role: "IMPORTS_MANAGER", email: "imports@fagdan.example", name: "Imports Manager" },
  { role: "TECH_ADMIN", email: "tech@fagdan.example", name: "Technical and System Administrator" },
];

async function seedStaff() {
  for (const s of STAFF) {
    const existing = await db.user.findUnique({ where: { email: s.email } });
    if (existing) continue;
    const role = await db.role.findUniqueOrThrow({ where: { key: s.role } });
    const pw = randomPassword(16);
    await db.user.create({ data: { kind: "STAFF", email: s.email, name: s.name, passwordHash: await hash(pw, ARGON), roleId: role.id, mustChangePassword: true } });
    credentials.push(`${s.role.padEnd(22)} ${s.email.padEnd(34)} ${pw}`);
  }
  console.log(`staff accounts created: ${credentials.length}`);
}

async function seedStructure() {
  let order = 0;
  for (const d of DIVISIONS) {
    const div = await db.division.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, name: d.name, tagline: d.tagline, description: d.description, icon: d.icon, accent: d.accent, sortOrder: order++ },
      update: {},
    });
    let co = 0;
    for (const c of d.cats) {
      const parent = await db.category.upsert({ where: { slug: slugify(`${d.slug}-${c.name}`) }, create: { divisionId: div.id, slug: slugify(`${d.slug}-${c.name}`), name: c.name, sortOrder: co++ }, update: {} });
      let so = 0;
      for (const child of c.children ?? []) {
        await db.category.upsert({ where: { slug: slugify(`${d.slug}-${child}`) }, create: { divisionId: div.id, parentId: parent.id, slug: slugify(`${d.slug}-${child}`), name: child, sortOrder: so++ }, update: {} });
      }
    }
  }
  // Vehicle makes/models and part brands
  for (const v of VEHICLE_SEEDS) {
    const brand = await db.brand.upsert({ where: { slug: slugify(v.make) }, create: { name: v.make, slug: slugify(v.make), country: v.makeCountry, isVehicleMake: true }, update: {} });
    await db.vehicleModel.upsert({ where: { brandId_name: { brandId: brand.id, name: v.model } }, create: { brandId: brand.id, name: v.model, bodyType: v.body }, update: {} });
  }
  for (const t of PRODUCT_TEMPLATES) await db.brand.upsert({ where: { slug: slugify(t.brand) }, create: { name: t.brand, slug: slugify(t.brand) }, update: {} });
  console.log("divisions, categories, brands ready");
}

async function seedSystem() {
  await db.paymentGateway.upsert({ where: { key: "paystack" }, create: { key: "paystack", name: "Paystack", enabled: false, mode: "test" }, update: {} });
  // Company bank account supplied by the owner. Editable and extendable in Admin > Settings > Bank accounts.
  const REAL_ACCOUNT = { bankName: "GTBank", accountName: "Banjo Folahan Daniel", accountNumber: "0121041488", accountType: "Savings", currency: "NGN", instructions: "Transfer the exact amount payable and use your payment reference as the narration. Then upload your proof of payment on your order page. Payments are credited after our finance team verifies receipt." };
  if ((await db.bankAccount.count({ where: { accountNumber: REAL_ACCOUNT.accountNumber } })) === 0) {
    await db.bankAccount.create({ data: { ...REAL_ACCOUNT, isActive: true, isPlaceholder: false, sortOrder: 0 } });
  }
  // Placeholder accounts are removed as soon as a real account exists (they are never shown to customers while inactive).
  await db.bankAccount.deleteMany({ where: { isPlaceholder: true } });
  const pages: [string, string, string][] = [
    ["about", "About FAGDAN", "FAGDAN Automotive Group is a Nigerian automotive business founded by Fagbure and King Fodan. FAGDAN AutoGallery is our flagship vehicle marketplace, supported by Auto Parts, Auto Accessories, Auto Technology, Auto Care, Vehicle Finance and Imports. Driven by Trust. Powered by Choice."],
  ];
  for (const [slug, title, body] of pages) await db.cmsPage.upsert({ where: { slug }, create: { slug, title, body }, update: {} });
  // Legal pages: create, or upgrade the short placeholder stubs. Pages the business has already edited are never overwritten.
  for (const [slug, title, body] of LEGAL_PAGES) {
    const existing = await db.cmsPage.findUnique({ where: { slug } });
    if (!existing) await db.cmsPage.create({ data: { slug, title, body } });
    else if (existing.body.length < 800) await db.cmsPage.update({ where: { slug }, data: { title, body } });
  }

  if ((await db.menuItem.count()) === 0) {
    const items: [string, string][] = [["Home", "/"], ["Cars", "/cars"], ["Auto Parts", "/parts"], ["Accessories", "/accessories"], ["Auto Care", "/auto-care"], ["Vehicle Finance", "/finance"], ["FAGDAN Imports", "/imports"], ["Sell or Swap", "/sell-or-swap"], ["About", "/about"], ["Contact", "/contact"]];
    await db.menuItem.createMany({ data: items.map(([label, href], i) => ({ menu: "primary", label, href, sortOrder: i })) });
  }
  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({
      data: [
        { question: "How does FAGDAN installment work?", answer: "Eligible vehicles can be bought on FAGDAN installment terms at the outright price plus 10%. You pay a deposit, then instalments. The vehicle is released once at least 90% of the installment total has been paid and verified.", sortOrder: 1 },
        { question: "Is VAT included in the price?", answer: "VAT at the current statutory rate is shown separately at checkout. The amount is calculated by our system and shown before you pay.", sortOrder: 2 },
        { question: "Can you import a specific car for me?", answer: "Yes. Use the Imports request form. We will source, ship, clear and deliver the vehicle and keep you updated at every stage.", sortOrder: 3 },
        { question: "How do I pay?", answer: "You can pay by card, bank transfer or USSD through Paystack, or by direct bank transfer with proof of payment, which our finance team verifies.", sortOrder: 4 },
        { question: "Are the vehicles on this site real stock?", answer: "Items labelled DEMO are sample data used while the platform is being set up and are not for sale.", sortOrder: 5 },
      ],
    });
  }
  if ((await db.messageTemplate.count()) === 0) {
    await db.messageTemplate.createMany({
      data: [
        { key: "order.created", channel: "EMAIL", subject: "Your FAGDAN order {{orderNumber}}", body: "Hello {{name}}, we have received your order {{orderNumber}} for {{total}}. Complete your payment to secure your items." },
        { key: "payment.received", channel: "EMAIL", subject: "Payment received for {{orderNumber}}", body: "Thank you {{name}}. We have verified your payment of {{amount}} for order {{orderNumber}}." },
        { key: "payment.received.whatsapp", channel: "WHATSAPP", body: "FAGDAN: Payment of {{amount}} received for order {{orderNumber}}. Thank you!" },
        { key: "release.eligible", channel: "EMAIL", subject: "Your vehicle is eligible for release", body: "Hello {{name}}, you have reached the payment threshold for order {{orderNumber}}. Our team will contact you to arrange collection or delivery." },
        { key: "booking.confirmed", channel: "EMAIL", subject: "Service booking confirmed", body: "Hello {{name}}, your {{service}} is confirmed for {{date}} at {{location}}." },
        { key: "import.status", channel: "EMAIL", subject: "Import update {{caseNumber}}", body: "Hello {{name}}, your import case {{caseNumber}} is now: {{status}}." },
      ],
    });
  }
  console.log("system rows ready");
}

// ───────────────────────────── demo data ─────────────────────────────
const VEHICLE_FEATURES: Record<string, string[]> = {
  SUV: ["Leather seats", "Panoramic sunroof", "360 camera", "Apple CarPlay / Android Auto", "Keyless entry", "Blind-spot monitoring"],
  Sedan: ["Leather seats", "Dual-zone climate control", "Reverse camera", "Apple CarPlay / Android Auto", "Push-button start", "Cruise control"],
  Pickup: ["4x4 with low range", "Tow package", "Bed liner", "Reverse camera", "Touchscreen infotainment"],
  Van: ["Sliding doors", "Rear AC", "Reverse camera", "High capacity"],
  Bus: ["14-seat configuration", "Rear AC", "High roof", "Heavy-duty suspension"],
  Truck: ["Heavy-duty chassis", "Air brakes", "Sleeper cab option"],
  Coupe: ["Sport exhaust", "Performance brakes", "Sport seats", "Launch control"],
  Hatchback: ["Compact city size", "Touchscreen infotainment", "Reverse camera", "Bluetooth"],
};

async function seedVehicles(cat: Map<string, string>, brands: Map<string, string>) {
  if ((await db.vehicle.count({ where: { isDemo: true } })) > 0) return console.log("demo vehicles already present");
  const r = rng(20261005);
  const div = await db.division.findUniqueOrThrow({ where: { slug: "autogallery" } });
  const units: { v: (typeof VEHICLE_SEEDS)[number]; year: number }[] = [];
  VEHICLE_SEEDS.forEach((v, i) => {
    v.years.forEach((y) => units.push({ v, year: y }));
    if (i % 3 === 0) units.push({ v, year: 2025 }); // current-model brand-new unit
  });
  let n = 0;
  for (const { v, year } of units) {
    n++;
    const age = Math.max(0, 2026 - year);
    let condition: Condition = "FOREIGN_USED";
    let origin = v.origin;
    if (year >= 2025) { condition = "BRAND_NEW"; origin = v.makeCountry; }
    else if (age <= 3 && r() < 0.25) condition = "NEARLY_NEW";
    else if (r() < 0.22) { condition = "NIGERIAN_USED"; origin = "Nigeria"; }
    else if (r() < 0.18) condition = "CERTIFIED_USED";
    else if (v.basePriceNaira > 100_000_000 && r() < 0.3) condition = "EXECUTIVE_USED";
    const depreciation = condition === "BRAND_NEW" ? 1 : Math.max(0.34, 1 - 0.085 * age);
    let priceNaira = v.basePriceNaira * depreciation * (condition === "NIGERIAN_USED" ? 0.9 : 1) * (0.94 + r() * 0.12);
    priceNaira = Math.round(priceNaira / 50_000) * 50_000;
    const mileage = condition === "BRAND_NEW" ? 0 : Math.round(age * (9_000 + r() * 8_000) + (condition === "NIGERIAN_USED" ? 15_000 : 3_000));
    const colour = pick(r, COLOURS);
    const stockNumber = `STK-${year}-${String(n).padStart(4, "0")}`;
    const inventoryId = `FAG-INV-${String(n).padStart(6, "0")}`;
    const vin = `DEMO${(v.make.slice(0, 2) + v.model.replace(/\W/g, "").slice(0, 2)).toUpperCase()}${String(year).slice(2)}${String(n).padStart(7, "0")}`.slice(0, 17).padEnd(17, "X");
    const catName = v.fuel === "Electric" ? "Electric Vehicles" : v.body === "SUV" ? "SUVs" : v.body === "Sedan" ? "Sedans" : v.body === "Coupe" ? "Coupes" : v.body === "Hatchback" ? "Hatchbacks" : v.body === "Pickup" ? "Pickup Trucks" : v.body === "Van" ? "Vans" : v.body === "Bus" ? "Buses" : "Trucks";
    const categoryId = cat.get(`autogallery:${catName}`)!;
    const name = `${year} ${v.make} ${v.model}`;
    const installmentAvailable = priceNaira >= 12_000_000 && condition !== "NIGERIAN_USED" && r() < 0.65;
    const features = VEHICLE_FEATURES[v.body] ?? VEHICLE_FEATURES.Sedan;
    const slug = slugify(`${name}-${stockNumber}`);
    await db.product.create({
      data: {
        type: "VEHICLE", divisionId: div.id, categoryId, brandId: brands.get(v.make), sku: `VEH-${String(n).padStart(5, "0")}`, slug, name,
        shortDescription: `${condition.replace("_", " ").toLowerCase()} ${v.body.toLowerCase()} with ${v.engine}`,
        description: `${name} in ${colour}. ${v.engine} (${v.hp} hp), ${v.trans.toLowerCase()} transmission, ${v.drive}. ${mileage === 0 ? "Brand new, delivery mileage only." : `${mileage.toLocaleString("en-NG")} km on the clock.`} Sourced from ${origin}. DEMO listing: sample data, not real inventory.`,
        price: BigInt(N(priceNaira)), discount: BigInt(r() < 0.12 ? N(Math.round(priceNaira * 0.03 / 10_000) * 10_000) : 0),
        condition, origin, warranty: condition === "BRAND_NEW" ? "3 years manufacturer warranty" : condition === "CERTIFIED_USED" ? "12 months FAGDAN certified" : "Inspection report provided",
        features: features.slice(0, 4 + Math.floor(r() * 3)),
        specs: { engine: v.engine, horsepower: v.hp, transmission: v.trans, drive: v.drive, fuel: v.fuel, bodyType: v.body, colour, mileageKm: mileage },
        status: "ACTIVE", featured: r() < 0.14, stockOnHand: 1, stockReserved: 0, lowStockThreshold: 0, isDemo: true,
        seoTitle: `${name} for sale in Nigeria | FAGDAN AutoGallery`, seoDescription: `${name}, ${condition.replace("_", " ").toLowerCase()}, ${mileage.toLocaleString("en-NG")} km. Buy outright or on FAGDAN installment.`,
        vehicle: { create: { inventoryId, stockNumber, vin, makeName: v.make, modelName: v.model, year, bodyType: v.body, fuelType: v.fuel, transmission: v.trans, driveType: v.drive, engine: v.engine, horsepower: v.hp, mileageKm: mileage, colour, installmentAvailable, minDepositBps: installmentAvailable ? 3000 : null, isDemo: true } },
        images: { create: [1, 2, 3].map((i) => ({ url: `/api/placeholder?kind=vehicle&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&year=${year}&colour=${encodeURIComponent(colour)}&i=${i}`, alt: `${name} (placeholder image ${i})`, sortOrder: i, isPlaceholder: true })) },
      },
    });
  }
  console.log(`demo vehicles: ${n}`);
}

async function seedProducts(cat: Map<string, string>, brands: Map<string, string>) {
  if ((await db.product.count({ where: { type: { not: "VEHICLE" }, isDemo: true } })) > 0) return console.log("demo products already present");
  const r = rng(77);
  const divs = new Map((await db.division.findMany()).map((d) => [d.slug, d.id]));
  let n = 0;
  for (const t of PRODUCT_TEMPLATES) {
    n++;
    const categoryId = cat.get(`${t.division}:${t.category}`);
    if (!categoryId) throw new Error(`Unknown category ${t.division}:${t.category}`);
    const sku = `${t.type === "PART" ? "PRT" : t.type === "TECHNOLOGY" ? "TEC" : "ACC"}-${String(n).padStart(5, "0")}`;
    const stock = t.stock ?? 5 + Math.floor(r() * 80);
    await db.product.create({
      data: {
        type: t.type, divisionId: divs.get(t.division)!, categoryId, brandId: brands.get(t.brand), sku, slug: slugify(`${t.name}-${sku}`), name: t.name,
        shortDescription: `${t.brand} ${t.category.toLowerCase()}`, description: `${t.name} by ${t.brand}. ${t.compat && t.compat.length ? "Vehicle-specific fit; confirm compatibility with your vehicle before ordering." : "Universal fit."} DEMO listing: sample data.`,
        price: BigInt(N(t.priceNaira)), discount: BigInt(r() < 0.15 ? N(Math.round(t.priceNaira * 0.05 / 100) * 100) : 0),
        partGrade: t.grade, partNumber: t.type === "PART" ? `${t.brand.slice(0, 3).toUpperCase()}-${10000 + n * 7}` : undefined, warranty: t.warranty, origin: pick(r, ["Japan", "Germany", "China", "USA", "Turkey", "India"]),
        features: t.features ?? [], status: "ACTIVE", featured: r() < 0.1, stockOnHand: stock, lowStockThreshold: 5, isDemo: true,
        images: { create: [{ url: `/api/placeholder?kind=product&label=${encodeURIComponent(t.category)}&brand=${encodeURIComponent(t.brand)}`, alt: `${t.name} (placeholder image)`, isPlaceholder: true }] },
        compat: t.compat && t.compat.length ? { create: t.compat.map((c) => ({ makeName: c.make, modelName: c.model, yearFrom: c.from, yearTo: c.to })) } : undefined,
      },
    });
  }
  console.log(`demo products: ${n}`);
}

async function seedServices() {
  if ((await db.service.count()) > 0) return;
  const div = await db.division.findUniqueOrThrow({ where: { slug: "auto-care" } });
  await db.service.createMany({ data: SERVICES.map((s) => ({ divisionId: div.id, slug: s.slug, name: s.name, description: s.description, price: BigInt(N(s.priceNaira)), priceNote: "From", durationMin: s.durationMin, isDemo: true })) });
  console.log(`services: ${SERVICES.length}`);
}

async function seedPeopleAndOps() {
  if ((await db.customer.count({ where: { isDemo: true } })) > 0) return console.log("demo customers already present");
  const r = rng(555);
  const customers = [];
  for (let i = 0; i < 55; i++) {
    const fn = pick(r, FIRST_NAMES), ln = pick(r, LAST_NAMES);
    customers.push(await db.customer.create({ data: { name: `${fn} ${ln}`, email: `demo.${slugify(fn)}.${slugify(ln)}.${i}@example.test`, phone: `+23480000${String(10000 + i)}`, city: pick(r, ["Ikeja", "Lekki", "Victoria Island", "Garki", "Wuse", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Abeokuta"]), state: pick(r, NG_STATES), isDemo: true } }));
  }
  const staff = await db.user.findMany({ where: { kind: "STAFF" }, select: { id: true } });
  const stages = ["NEW", "CONTACTED", "QUALIFIED", "VEHICLE_SELECTED", "TEST_DRIVE", "NEGOTIATION", "PAYMENT_PENDING", "WON", "LOST"];
  for (let i = 0; i < 24; i++) {
    const c = customers[i];
    await db.lead.create({ data: { customerId: c.id, name: c.name, phone: c.phone, email: c.email, source: pick(r, ["Website", "WhatsApp", "Referral", "Walk-in", "Instagram"]), interest: pick(r, ["2021 Toyota Camry", "Lexus RX 350", "Mercedes C300", "Honda Accord", "Hyundai Tucson", "Brand-new SUV"]), stage: stages[i % stages.length], priority: pick(r, ["LOW", "MEDIUM", "HIGH"]), ownerId: pick(r, staff).id, nextAction: "Follow up by phone", nextFollowUpAt: new Date(Date.now() + (1 + Math.floor(r() * 10)) * 86400_000), isDemo: true } });
  }
  for (let i = 0; i < 10; i++) {
    await db.task.create({ data: { title: pick(r, ["Verify bank transfer proof", "Call customer about test drive", "Prepare inspection report", "Update vehicle photos", "Confirm shipping schedule"]), description: "Demo task", assigneeId: pick(r, staff).id, priority: pick(r, ["LOW", "MEDIUM", "HIGH"]), deadline: new Date(Date.now() + (1 + i) * 86400_000) } });
  }
  const services = await db.service.findMany({ take: 10 });
  for (let i = 0; i < 10; i++) {
    const slotStart = new Date(Date.now() + (1 + i) * 86400_000); slotStart.setHours(9 + (i % 6), 0, 0, 0);
    await db.serviceBooking.create({ data: { serviceId: services[i % services.length].id, customerId: customers[i].id, vehicleInfo: pick(r, ["2019 Toyota Camry", "2021 Honda Accord", "2018 Lexus RX 350"]), location: i % 2 ? "Lekki Workshop (demo)" : "Ikeja Workshop (demo)", slotStart, slotEnd: new Date(+slotStart + 3600_000), isDemo: true } });
  }
  const importStatuses = ["REQUEST_RECEIVED", "VEHICLE_SOURCING", "VEHICLE_FOUND", "CUSTOMER_APPROVAL", "SHIPPING", "IN_TRANSIT", "PORT_ARRIVAL", "CUSTOMS_PROCESSING"];
  for (let i = 0; i < 8; i++) {
    const ic = await db.importCase.create({ data: { caseNumber: `IMP-2026-${String(i + 1).padStart(4, "0")}`, customerId: customers[i + 10].id, make: pick(r, ["Toyota", "Lexus", "Mercedes-Benz", "Honda"]), model: pick(r, ["Camry", "RX 350", "GLE 350", "Accord"]), year: 2020 + (i % 5), country: pick(r, ["USA", "Canada", "Japan", "Germany", "UK"]), budget: BigInt(N(30_000_000 + i * 5_000_000)), condition: "Foreign Used", status: importStatuses[i], isDemo: true } });
    await db.importCaseEvent.create({ data: { caseId: ic.id, status: importStatuses[i], note: "Demo event" } });
  }
  for (let i = 0; i < 5; i++) await db.tradeIn.create({ data: { customerId: customers[20 + i].id, make: "Toyota", model: "Corolla", year: 2015 + i, mileageKm: 90_000 + i * 8_000, condition: "Good", status: ["SUBMITTED", "UNDER_REVIEW", "VALUED", "OFFER_SENT", "ACCEPTED"][i], valuation: i >= 2 ? BigInt(N(6_000_000 + i * 500_000)) : null, isDemo: true } });
  for (let i = 0; i < 4; i++) await db.swapRequest.create({ data: { customerId: customers[26 + i].id, ownVehicle: "2016 Honda Accord", status: ["REQUESTED", "VALUATION", "OFFER", "NEGOTIATION"][i], notes: "Demo swap request", isDemo: true } });
  for (let i = 0; i < 5; i++) await db.financeApplication.create({ data: { customerId: customers[30 + i].id, vehiclePrice: BigInt(N(40_000_000)), deposit: BigInt(N(12_000_000)), requested: BigInt(N(28_000_000)), termMonths: 12, status: ["SUBMITTED", "DOCUMENTS_REQUESTED", "UNDER_REVIEW", "APPROVED", "DECLINED"][i], isDemo: true } });
  await db.coupon.createMany({ data: [{ code: "WELCOME5", percentBps: 500, minSpend: BigInt(N(20_000)), isActive: true }, { code: "ACCESSORY10K", amountOff: BigInt(N(10_000)), minSpend: BigInt(N(100_000)), isActive: true }], skipDuplicates: true });
  console.log("demo customers, leads, tasks, bookings, imports, trade-ins, swaps, finance applications ready");
  return customers;
}

async function seedOrders() {
  if ((await db.order.count({ where: { isDemo: true } })) > 0) return console.log("demo orders already present");
  const customers = await db.customer.findMany({ where: { isDemo: true }, take: 12 });
  const vehicles = await db.product.findMany({ where: { type: "VEHICLE", status: "ACTIVE", vehicle: { installmentAvailable: true } }, take: 6, include: { vehicle: true } });
  const outright = await db.product.findMany({ where: { type: "VEHICLE", status: "ACTIVE", vehicle: { installmentAvailable: false } }, take: 3 });
  const parts = await db.product.findMany({ where: { type: { in: ["PART", "ACCESSORY"] }, status: "ACTIVE" }, take: 8 });
  const reference = (i: number) => `DEMO-PAY-${String(i).padStart(4, "0")}`;
  let pi = 0;

  // 1. Parts and accessories order, paid by Paystack (simulated, verified)
  const o1 = await createOrder({ customerId: customers[0].id, lines: [{ productId: parts[0].id, quantity: 1 }, { productId: parts[3].id, quantity: 2 }], mode: "OUTRIGHT", deliveryMethod: "DELIVERY", delivery: { address: "12 Demo Street", city: "Ikeja", state: "Lagos", contact: customers[0].phone ?? "" }, isDemo: true });
  const p1 = await db.payment.create({ data: { orderId: o1.id, method: "PAYSTACK", status: "INITIATED", reference: reference(++pi), expectedAmount: o1.grandTotal } });
  await applyVerifiedPayment({ paymentId: p1.id, paidAmount: Number(o1.grandTotal), gatewayReference: "DEMO-GW-1" });

  // 2. Outright vehicle awaiting bank transfer verification
  const o2 = await createOrder({ customerId: customers[1].id, lines: [{ productId: outright[0].id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
  await db.payment.create({ data: { orderId: o2.id, method: "BANK_TRANSFER", status: "AWAITING_VERIFICATION", reference: reference(++pi), expectedAmount: o2.grandTotal, proofUrl: "/api/placeholder?kind=proof" } });
  await db.order.update({ where: { id: o2.id }, data: { status: "PAYMENT_VERIFICATION" } });

  // 3-5. Installment vehicles at different payment levels (blocked / just below / eligible)
  const levels = [0.35, 0.8999, 0.9];
  for (let k = 0; k < 3; k++) {
    const v = vehicles[k];
    const q = await buildQuote({ lines: [{ productId: v.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 0 });
    const o = await createOrder({ customerId: customers[2 + k].id, lines: [{ productId: v.id, quantity: 1 }], mode: "INSTALLMENT", deposit: q.minDeposit, isDemo: true });
    const target = Math.floor(Number(o.releaseThreshold) / 0.9 * levels[k]);
    const pay = await db.payment.create({ data: { orderId: o.id, method: "BANK_TRANSFER", status: "INITIATED", reference: reference(++pi), expectedAmount: BigInt(target) } });
    await applyVerifiedPayment({ paymentId: pay.id, paidAmount: Math.min(target, Number(o.grandTotal)), note: "Demo installment payment" });
  }

  // 6. Pending-payment order
  await createOrder({ customerId: customers[6].id, lines: [{ productId: parts[5].id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
  // 7. Another outright vehicle, fully paid
  const o7 = await createOrder({ customerId: customers[7].id, lines: [{ productId: outright[1].id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
  const p7 = await db.payment.create({ data: { orderId: o7.id, method: "PAYSTACK", status: "INITIATED", reference: reference(++pi), expectedAmount: o7.grandTotal } });
  await applyVerifiedPayment({ paymentId: p7.id, paidAmount: Number(o7.grandTotal), gatewayReference: "DEMO-GW-7" });
  console.log(`demo orders: 7 (payments: ${pi})`);
}

async function main() {
  console.log(`seeding (production=${isProd}, demo=${allowDemo})`);
  await seedAccess();
  await seedStructure();
  await seedSystem();
  await seedStaff();
  if (allowDemo) {
    const cats = new Map<string, string>();
    for (const c of await db.category.findMany({ include: { division: true } })) cats.set(`${c.division.slug}:${c.name}`, c.id);
    const brands = new Map((await db.brand.findMany()).map((b) => [b.name, b.id]));
    await seedVehicles(cats, brands);
    await seedProducts(cats, brands);
    await seedServices();
    await seedPeopleAndOps();
    await seedOrders();
  } else console.log("demo seed skipped (production)");

  if (credentials.length) {
    writeFileSync(".seed-credentials.txt", `FAGDAN staff one-time passwords (forced change on first login). KEEP PRIVATE, DO NOT COMMIT.\n\n${credentials.join("\n")}\n`);
    console.log("one-time staff passwords written to .seed-credentials.txt");
  }
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
