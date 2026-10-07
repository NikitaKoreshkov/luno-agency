import { getPool } from "@/lib/db/pool";

/** Удаляет просроченные и использованные коды — email/код не хранятся дольше 15 минут */
export async function purgeExpiredVerificationCodes(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM verification_codes
     WHERE expires_at <= NOW()
        OR (consumed = TRUE AND created_at < NOW() - INTERVAL '24 hours')`
  );
  return result.rowCount ?? 0;
}

export async function purgeRateLimitEntries(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM auth_rate_limits WHERE created_at < NOW() - INTERVAL '2 hours'`
  );
  return result.rowCount ?? 0;
}

export async function runAuthMaintenance(): Promise<void> {
  await Promise.all([purgeExpiredVerificationCodes(), purgeRateLimitEntries()]);
}
