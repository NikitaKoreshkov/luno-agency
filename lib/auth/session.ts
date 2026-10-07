import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db/pool";
import {
  isLegacySessionToken,
  signUserAccessToken,
  verifyUserAccessToken,
} from "@/lib/auth/jwt";
import type { DbUser, PublicUser } from "@/lib/auth/types";
import { isDatabaseEnabled } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/routes";

const SESSION_DAYS = 30;
const MAX_SESSIONS_PER_USER = 10;

export function toPublicUser(row: DbUser): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    emailVerified: row.email_verified,
    hasPassword: Boolean(row.password_hash),
    createdAt: row.created_at.toISOString(),
  };
}

async function resolveSessionId(token: string): Promise<string | null> {
  if (isLegacySessionToken(token)) {
    return token;
  }
  const payload = await verifyUserAccessToken(token);
  return payload?.sessionId ?? null;
}

/** Создаёт сессию в БД и возвращает подписанный JWT */
export async function createSession(
  userId: string,
  email: string
): Promise<string> {
  const pool = getPool();
  const sessionId = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt]
  );

  await pool.query(
    `DELETE FROM sessions
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [userId, MAX_SESSIONS_PER_USER]
  );

  return signUserAccessToken(
    { userId, email: email.trim().toLowerCase(), sessionId },
    expiresAt
  );
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export function sessionCookieOptions(jwt: string) {
  return {
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function getUserByAuthToken(
  token: string | undefined
): Promise<DbUser | null> {
  if (!isDatabaseEnabled() || !token) return null;

  const sessionId = await resolveSessionId(token);
  if (!sessionId) return null;

  const pool = getPool();
  const { rows } = await pool.query<DbUser>(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );

  return rows[0] ?? null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = await getUserByAuthToken(token);
  return user ? toPublicUser(user) : null;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  const sessionId = await resolveSessionId(token);
  if (!sessionId) return;

  const pool = getPool();
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

export async function purgeExpiredSessions() {
  const pool = getPool();
  await pool.query(`DELETE FROM sessions WHERE expires_at <= NOW()`);
}
