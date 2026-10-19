import "dotenv/config";
import { Pool, PoolClient, QueryResultRow } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
export type DbClient = Pick<PoolClient, "query">;
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://lagani:lagani_local_only@127.0.0.1:54322/lagani",
  max: 20,
});
export async function query<T extends QueryResultRow = any>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await pool.query<T>(sql, values)).rows;
}
export async function tx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function migrate() {
  await pool.query(
    "CREATE SCHEMA IF NOT EXISTS app; CREATE TABLE IF NOT EXISTS app.migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const dir = resolve(__dirname, "../../../supabase/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await query("SELECT version FROM app.migrations WHERE version=$1", [
          file,
        ])
      ).length
    )
      continue;
    await tx(async (c) => {
      await c.query(readFileSync(resolve(dir, file), "utf8"));
      await c.query("INSERT INTO app.migrations(version) VALUES($1)", [file]);
    });
  }
}
export const one = async (c: DbClient, sql: string, values: unknown[] = []) =>
  (await c.query(sql, values)).rows[0];
