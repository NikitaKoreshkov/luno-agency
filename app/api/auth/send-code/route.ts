import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { createVerificationCode } from "@/lib/auth/codes";
import { sendVerificationEmail } from "@/lib/auth/email";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request";
import type { VerificationPurpose } from "@/lib/auth/types";
import { findUserByEmail } from "@/lib/auth/users";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    return await withAuthMaintenance(async () => {
    const body = (await request.json()) as {
      email?: string;
      purpose?: VerificationPurpose;
    };

    const email = body.email?.trim();
    const purpose = body.purpose;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Укажите корректный email");
    }

    if (purpose !== "register" && purpose !== "reset_password") {
      return jsonError("Некорректный тип запроса");
    }

    const existing = await findUserByEmail(email);

    if (purpose === "register" && existing) {
      return jsonError("Пользователь с таким email уже зарегистрирован");
    }

    if (purpose === "reset_password" && !existing) {
      return jsonError("Пользователь с таким email не найден");
    }

    const ip = getClientIp(request);
    await assertRateLimit(`otp:send:${purpose}:${email}`, 5, 15);
    await assertRateLimit(`otp:send:ip:${ip}`, 20, 15);

    const result = await createVerificationCode(email, purpose);
    if (!result.ok) {
      return jsonError(result.error);
    }

    await sendVerificationEmail(email, result.code, purpose);

    return jsonOk({
      message:
        purpose === "register"
          ? "Код отправлен на почту для регистрации"
          : "Код отправлен на почту для сброса пароля",
      expiresInMinutes: 15,
    });
    });
  } catch (err) {
    return handleAuthRouteError(
      err,
      "Не удалось отправить код. Проверьте настройки SMTP."
    );
  }
}
