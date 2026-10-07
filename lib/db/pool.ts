import { Pool } from "pg";
import { getDatabaseUrl, isDatabaseEnabled } from "@/lib/env";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!isDatabaseEnabled()) {
    throw new Error("Database is disabled: DATABASE_URL is not set.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    });
  }
  return pool;
}
