import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Secure upload validation: extension, declared MIME, size AND magic bytes must agree. No executables, ever. */
export interface UploadRule { maxBytes: number; kinds: ("image" | "pdf")[] }

export const PROOF_RULE: UploadRule = { maxBytes: 4 * 1024 * 1024, kinds: ["image", "pdf"] }; // under Vercel's 4.5 MB body limit
export const PHOTO_RULE: UploadRule = { maxBytes: 4 * 1024 * 1024, kinds: ["image"] };

const SIGS: { kind: "image" | "pdf"; ext: string[]; mime: string; test: (b: Uint8Array) => boolean }[] = [
  { kind: "image", ext: ["jpg", "jpeg"], mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: "image", ext: ["png"], mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: "image", ext: ["webp"], mime: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { kind: "pdf", ext: ["pdf"], mime: "application/pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
];

export class UploadError extends Error {}

export async function validateUpload(file: File, rule: UploadRule): Promise<{ bytes: Uint8Array; ext: string; mime: string }> {
  if (!file || file.size === 0) throw new UploadError("No file received.");
  if (file.size > rule.maxBytes) throw new UploadError(`File is too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB).`);
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sig = SIGS.find((s) => rule.kinds.includes(s.kind) && s.ext.includes(ext));
  if (!sig) throw new UploadError("This file type is not allowed.");
  if (file.type && file.type !== sig.mime && !(sig.mime === "image/jpeg" && file.type === "image/jpg")) throw new UploadError("File type does not match its extension.");
  if (!sig.test(bytes)) throw new UploadError("The file content does not match its type.");
  return { bytes, ext: sig.ext[0], mime: sig.mime };
}

function r2Config() {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: key, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket, R2_PUBLIC_URL: publicUrl } = process.env;
  return account && key && secret && bucket && publicUrl ? { account, key, secret, bucket, publicUrl } : null;
}

/** Storage driver. Local disk in development; Vercel Blob (public store, SDK) in production. Files get random, unguessable names. */
export async function storeFile(bytes: Uint8Array, ext: string, mime: string, folder: string): Promise<string> {
  const name = `${folder}/${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  const r2 = r2Config();
  if (r2 && (process.env.STORAGE_DRIVER ?? "r2") === "r2") {
    // Cloudflare R2 (S3-compatible): free egress, public bucket address in R2_PUBLIC_URL.
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: "auto", endpoint: `https://${r2.account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: r2.key, secretAccessKey: r2.secret } });
    await client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: name, Body: Buffer.from(bytes), ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }));
    return `${r2.publicUrl.replace(/[/]+$/, "")}/${name}`;
  }
  const driver = process.env.STORAGE_DRIVER === "r2" ? "local" : (process.env.STORAGE_DRIVER ?? "local");
  if (driver === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
    const { put } = await import("@vercel/blob");
    const blob = await put(name, Buffer.from(bytes), { access: "public", contentType: mime, addRandomSuffix: false, token });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Configure STORAGE_DRIVER=blob (local disk is not available on Vercel)");
  const full = path.join(process.cwd(), "uploads", name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return `/api/files/${name}`;
}
