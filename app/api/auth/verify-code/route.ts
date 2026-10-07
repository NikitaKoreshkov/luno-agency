import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { checkVerificationCode } from "@/lib/auth/codes";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import type { VerificationPurpose } from "@/lib/auth/types";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    return await withAuthMaintenance(async () => {
    const body = (await request.json()) as {
      email?: string;
      code?: string;
      purpose?: VerificationPurpose;
    };

    const email = body.email?.trim();
    const code = body.code?.replace(/\D/g, "");
    const purpose = body.purpose;

    if (!email || !code || code.length !== 6) {
      return jsonError("Введите 6 цифр кода из письма");
    }

    if (purpose !== "register" && purpose !== "reset_password") {
      return jsonError("Некорректный тип запроса");
    }

    await assertRateLimit(`otp:verify:${purpose}:${email}`, 12, 15);

    const valid = await checkVerificationCode(email, purpose, code);
    if (!valid) {
      return jsonError("Неверный или просроченный код");
    }

    return jsonOk({ message: "Код подтверждён" });
    });
  } catch (err) {
    return handleAuthRouteError(err, "Не удалось проверить код");
  }
}
