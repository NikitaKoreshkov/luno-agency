import { cookies } from "next/headers";
import { getUserByAuthToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/routes";
import type { DbUser } from "@/lib/auth/types";
import { jsonError } from "@/lib/http";

export async function requireDbUser(): Promise<DbUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getUserByAuthToken(token);
}

export function unauthorizedResponse() {
  return jsonError("Требуется авторизация", 401);
}
