import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { verifyCode } from "@/lib/auth/codes";
import { validatePassword } from "@/lib/auth/password";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { deleteAllUserSessions } from "@/lib/auth/session";
import { findUserByEmail, updateUserPassword } from "@/lib/auth/users";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    return await withAuthMaintenance(async () => {
      const body = (await request.json()) as {
        email?: string;
        code?: string;
        password?: string;
        confirmPassword?: string;
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

      const user = await findUserByEmail(email);
      if (!user) {
        return jsonError("Пользователь не найден");
      }

      await assertRateLimit(`reset:${email}`, 6, 15);

      const valid = await verifyCode(email, "reset_password", code);
      if (!valid) {
        return jsonError("Неверный или просроченный код");
      }

      await updateUserPassword(email, password);
      await deleteAllUserSessions(user.id);

      return jsonOk({
        message: "Пароль обновлён. Войдите с новым паролем.",
      });
    });
  } catch (err) {
    return handleAuthRouteError(err, "Не удалось сбросить пароль");
  }
}
