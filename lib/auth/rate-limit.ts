import { getPool } from "@/lib/db/pool";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function assertRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number
): Promise<void> {
  const pool = getPool();

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM auth_rate_limits
     WHERE rate_key = $1 AND created_at > NOW() - ($2::text || ' minutes')::interval`,
    [key, String(windowMinutes)]
  );

  const count = Number(rows[0]?.count ?? 0);
  if (count >= maxAttempts) {
    throw new RateLimitError(
      "Слишком много попыток. Подождите несколько минут и попробуйте снова"
    );
  }

  await pool.query(
    `INSERT INTO auth_rate_limits (rate_key) VALUES ($1)`,
    [key]
  );
}
