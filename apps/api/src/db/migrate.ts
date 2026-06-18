import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pool } from "./client.js";

export async function runMigrations() {
  const migrationsDir = await findMigrationsDir();

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const applied = await pool.query("select 1 from schema_migrations where version = $1", [file]);
    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (version) values ($1)", [file]);
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

async function findMigrationsDir() {
  const candidates = [
    path.join(process.cwd(), "infra", "postgres", "migrations"),
    path.join(process.cwd(), "..", "..", "infra", "postgres", "migrations"),
  ];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Try the next expected monorepo layout.
    }
  }

  throw new Error(`PostgreSQL migrations directory not found from ${process.cwd()}`);
}
