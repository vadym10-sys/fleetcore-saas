import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const migrationsDir = path.join(process.cwd(), "infra", "postgres", "migrations");
const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const applied = await client.query("select 1 from schema_migrations where version = $1", [file]);
    if (applied.rowCount) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (version) values ($1)", [file]);
      await client.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  await client.end();
}

main().catch(async (error: unknown) => {
  await client.end().catch(() => undefined);
  throw error;
});
