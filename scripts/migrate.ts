/**
 * Apply the SQL migrations to the database in DATABASE_URL, in filename order.
 * Uses node-postgres over TCP, which works against a plain Postgres (local, CI)
 * and against Neon alike — so `npm run db:migrate` behaves the same everywhere.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { splitStatements } from "../src/lib/adapters/postgres/sql-file.ts";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "lib",
  "adapters",
  "postgres",
  "migrations",
);

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const text = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`applying ${file} … `);
    for (const statement of splitStatements(text)) {
      await client.query(statement);
    }
    process.stdout.write("ok\n");
  }
  process.stdout.write(`${files.length} migration(s) applied\n`);
} finally {
  await client.end();
}
