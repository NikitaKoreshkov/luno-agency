import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { verifyCode } from "@/lib/auth/codes";
import { validatePassword } from "@/lib/auth/password";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import {
  createSession,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth/session";
import { createUserWithPassword, findUserByEmail } from "@/lib/auth/users";
import { jsonError, jsonOk } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    return await withAuthMaintenance(async () => {
    const body = (await request.json()) as {
      email?: string;
      code?: string;
      password?: string;
      confirmPassword?: string;
      name?: string;
    };

    const email = body.email?.trim();
    const code = body.code?.trim();
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!email || !code) {
      return jsonError("Укажите email и код из письма");
    }

    if (password !== confirmPassword) {
      return jsonError("Пароли не совпадают");
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return jsonError(passwordError);
    }

    if (await findUserByEmail(email)) {
      return jsonError("Пользователь уже зарегистрирован");
    }

    await assertRateLimit(`register:${email}`, 6, 15);

    const valid = await verifyCode(email, "register", code);
    if (!valid) {
      return jsonError("Неверный или просроченный код");
    }

    const user = await createUserWithPassword({
      email,
      password,
      name: body.name,
    });

    const jwt = await createSession(user.id, user.email);
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(jwt));

    return jsonOk({ user: toPublicUser(user) });
    });
  } catch (err) {
    return handleAuthRouteError(err, "Не удалось завершить регистрацию");
  }
}
