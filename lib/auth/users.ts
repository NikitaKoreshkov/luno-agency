import { getPool } from "@/lib/db/pool";
import { hashPassword } from "@/lib/auth/password";
import type { DbUser } from "@/lib/auth/types";
import type { GoogleProfile } from "@/lib/auth/google";

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbUser>(
    `SELECT * FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbUser>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createUserWithPassword(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<DbUser> {
  const pool = getPool();
  const email = input.email.trim().toLowerCase();
  const { rows } = await pool.query<DbUser>(
    `INSERT INTO users (email, name, password_hash, email_verified)
     VALUES ($1, $2, $3, TRUE)
     RETURNING *`,
    [email, input.name?.trim() || null, hashPassword(input.password)]
  );
  return rows[0];
}

export async function updateUserPassword(
  email: string,
  password: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE email = $2`,
    [hashPassword(password), email.trim().toLowerCase()]
  );
}

export async function upsertGoogleUser(
  profile: GoogleProfile
): Promise<DbUser> {
  const pool = getPool();
  const email = profile.email.trim().toLowerCase();

  const existing = await pool.query<DbUser>(
    `SELECT * FROM users WHERE google_id = $1 OR email = $2`,
    [profile.id, email]
  );

  if (existing.rows[0]) {
    const { rows } = await pool.query<DbUser>(
      `UPDATE users SET
         google_id = COALESCE(google_id, $1),
         name = COALESCE(name, $2),
         avatar_url = COALESCE(avatar_url, $3),
         email_verified = TRUE,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [profile.id, profile.name, profile.picture, existing.rows[0].id]
    );
    return rows[0];
  }

  const { rows } = await pool.query<DbUser>(
    `INSERT INTO users (email, name, google_id, avatar_url, email_verified)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING *`,
    [email, profile.name, profile.id, profile.picture]
  );
  return rows[0];
}
