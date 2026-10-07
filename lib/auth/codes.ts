import { getPool } from "@/lib/db/pool";
import { generateOtpCode, hashOtpCode, verifyOtpHash } from "@/lib/auth/code-crypto";
import { purgeExpiredVerificationCodes } from "@/lib/auth/cleanup";
import { CODE_TTL_MINUTES } from "@/lib/auth/constants";
import type { VerificationPurpose } from "@/lib/auth/types";

export { CODE_TTL_MINUTES };
const RESEND_COOLDOWN_SEC = 60;

export async function createVerificationCode(
  email: string,
  purpose: VerificationPurpose
): Promise<
  { ok: true; code: string; expiresAt: Date } | { ok: false; error: string }
> {
  await purgeExpiredVerificationCodes();

  const pool = getPool();
  const normalized = email.trim().toLowerCase();

  const recent = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM verification_codes
     WHERE email = $1 AND purpose = $2 AND consumed = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, purpose]
  );

  if (recent.rows[0]) {
    const elapsed =
      (Date.now() - recent.rows[0].created_at.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SEC) {
      return {
        ok: false,
        error: `Подождите ${Math.ceil(RESEND_COOLDOWN_SEC - elapsed)} сек. перед повторной отправкой`,
      };
    }
  }

  const plainCode = generateOtpCode();
  const codeHash = hashOtpCode(plainCode);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CODE_TTL_MINUTES);

  await pool.query(
    `UPDATE verification_codes SET consumed = TRUE
     WHERE email = $1 AND purpose = $2 AND consumed = FALSE`,
    [normalized, purpose]
  );

  await pool.query(
    `INSERT INTO verification_codes (email, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [normalized, codeHash, purpose, expiresAt]
  );

  return { ok: true, code: plainCode, expiresAt };
}

async function findValidCodeRow(
  email: string,
  purpose: VerificationPurpose,
  plainCode: string
) {
  const pool = getPool();
  const normalized = email.trim().toLowerCase();

  const { rows } = await pool.query<{ id: string; code: string }>(
    `SELECT id, code FROM verification_codes
     WHERE email = $1 AND purpose = $2
       AND consumed = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [normalized, purpose]
  );

  for (const row of rows) {
    if (verifyOtpHash(plainCode, row.code)) {
      return row;
    }
  }

  return null;
}

export async function checkVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<boolean> {
  await purgeExpiredVerificationCodes();
  const row = await findValidCodeRow(email, purpose, code);
  return Boolean(row);
}

export async function verifyCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<boolean> {
  await purgeExpiredVerificationCodes();
  const row = await findValidCodeRow(email, purpose, code);
  if (!row) return false;

  const pool = getPool();
  await pool.query(
    `UPDATE verification_codes SET consumed = TRUE WHERE id = $1`,
    [row.id]
  );

  return true;
}
