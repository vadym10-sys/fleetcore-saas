import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://fleetcore@127.0.0.1:5432/fleetcore",
});

export async function closeDatabase() {
  await pool.end();
}

