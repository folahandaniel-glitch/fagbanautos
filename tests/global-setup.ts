import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** Creates (if needed) and migrates an isolated `fagdan_test` database on the local dev PostgreSQL. */
export default async function setup() {
  const base = process.env.TEST_ADMIN_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/postgres?schema=public";
  const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/fagdan_test?schema=public";
  const admin = new PrismaClient({ datasources: { db: { url: base } } });
  try {
    const rows = await admin.$queryRaw<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname = 'fagdan_test'`;
    if (rows.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE fagdan_test`);
  } finally {
    await admin.$disconnect();
  }
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl } });
}
