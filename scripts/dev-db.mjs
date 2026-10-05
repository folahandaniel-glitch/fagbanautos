// Local development PostgreSQL (real Postgres binaries via the `embedded-postgres` package).
// Production uses a managed PostgreSQL; this is for development and CI only.
// Usage: node scripts/dev-db.mjs        (starts and keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const port = Number(process.env.DEV_DB_PORT ?? 54329);
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port, persistent: true });

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("fagdan");
} catch {
  // database already exists
}
console.log(`PostgreSQL ready on 127.0.0.1:${port} (database: fagdan)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
