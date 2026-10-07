import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { verifyPassword } from "@/lib/auth/password";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request";
import {
  createSession,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { jsonError, jsonOk } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    return await withAuthMaintenance(async () => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return jsonError("Укажите email и пароль");
    }

    const ip = getClientIp(request);
    await assertRateLimit(`login:${email}`, 8, 15);
    await assertRateLimit(`login:ip:${ip}`, 30, 15);

    const user = await findUserByEmail(email);
    if (!user?.password_hash) {
      return jsonError("Неверный email или пароль");
    }

    if (!verifyPassword(password, user.password_hash)) {
      return jsonError("Неверный email или пароль");
    }

    const jwt = await createSession(user.id, user.email);
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(jwt));

    return jsonOk({ user: toPublicUser(user) });
    });
  } catch (err) {
    return handleAuthRouteError(err, "Не удалось войти");
  }
}
