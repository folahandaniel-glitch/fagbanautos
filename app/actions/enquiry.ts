"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth/session";

const phone = z.string().trim().min(7).max(20).regex(/^[+\d][\d\s-]+$/, "Enter a valid phone number");

const testDriveSchema = z.object({ productId: z.string().min(1), name: z.string().trim().min(2).max(80), phone, preferredAt: z.string().min(8), notes: z.string().max(500).optional() });

export async function requestTestDrive(formData: FormData) {
  if (!(await rateLimit("testdrive", 5, 600))) redirect("/contact?error=rate");
  const data = testDriveSchema.parse(Object.fromEntries(formData));
  const when = new Date(data.preferredAt);
  if (Number.isNaN(+when) || when < new Date()) redirect(`/cars?error=date`);
  const user = await getSessionUser();
  await db.testDrive.create({ data: { productId: data.productId, name: data.name, phone: data.phone, preferredAt: when, notes: data.notes } });
  await db.lead.create({ data: { customerId: user?.customerId ?? undefined, name: data.name, phone: data.phone, source: "Website", interest: `Test drive: ${data.productId}`, stage: "TEST_DRIVE", priority: "HIGH", nextAction: "Confirm test drive", nextFollowUpAt: new Date(Date.now() + 86400_000) } });
  redirect("/thank-you?type=test-drive");
}

const contactSchema = z.object({ name: z.string().trim().min(2).max(80), phone, email: z.string().trim().email().optional().or(z.literal("")), message: z.string().trim().min(5).max(1500), consent: z.literal("on") });

export async function submitContact(formData: FormData) {
  if (!(await rateLimit("contact", 5, 600))) redirect("/contact?error=rate");
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/contact?error=invalid");
  const d = parsed.data;
  await db.lead.create({ data: { name: d.name, phone: d.phone, email: d.email || undefined, source: "Contact form", interest: d.message.slice(0, 200), stage: "NEW", nextAction: "Respond to enquiry", nextFollowUpAt: new Date(Date.now() + 86400_000) } });
  await db.consentRecord.create({ data: { subject: d.phone, purpose: "contact-enquiry", granted: true } });
  redirect("/thank-you?type=contact");
}
