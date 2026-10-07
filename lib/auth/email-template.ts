import { CODE_TTL_MINUTES } from "@/lib/auth/constants";
import type { VerificationPurpose } from "@/lib/auth/types";

const PURPOSE_COPY: Record<
  VerificationPurpose,
  { title: string; lead: string; subjectLabel: string }
> = {
  register: {
    title: "Подтверждение регистрации",
    lead: "Введите код на странице профиля, чтобы завершить создание аккаунта.",
    subjectLabel: "регистрации",
  },
  reset_password: {
    title: "Сброс пароля",
    lead: "Введите код на странице профиля, чтобы задать новый пароль.",
    subjectLabel: "сброса пароля",
  },
};

export function getVerificationEmailSubject(purpose: VerificationPurpose): string {
  return `Код для ${PURPOSE_COPY[purpose].subjectLabel} — LUNO`;
}

export function buildVerificationEmailText(
  code: string,
  purpose: VerificationPurpose
): string {
  const copy = PURPOSE_COPY[purpose];
  return [
    "luno",
    "",
    copy.title,
    copy.lead,
    "",
    `Код: ${code}`,
    "",
    `Код действует ${CODE_TTL_MINUTES} минут.`,
    "Если вы не запрашивали это письмо — просто проигнорируйте его.",
    "",
    "— LUNO, Алматы",
  ].join("\n");
}

export function buildVerificationEmailHtml(
  code: string,
  purpose: VerificationPurpose
): string {
  const copy = PURPOSE_COPY[purpose];
  const digits = code.split("").join(" ");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${copy.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.05em;color:#ffffff;">
                luno
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-radius:20px;border:1px solid rgba(255,255,255,0.12);background:#121212;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height:1px;background:rgba(255,255,255,0.16);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:36px 32px 32px;">
                    <h1 style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;line-height:1.25;color:#ffffff;">
                      ${copy.title}
                    </h1>
                    <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.62);">
                      ${copy.lead}
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding:28px 20px;border-radius:14px;border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.04);">
                          <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.04em;color:rgba(255,255,255,0.55);">
                            Ваш код
                          </p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:${digits.length > 8 ? "0.12em" : "0.28em"};color:#ffffff;">
                            ${code}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.45);text-align:center;">
                      Код действует <strong style="color:rgba(255,255,255,0.7);font-weight:600;">${CODE_TTL_MINUTES} минут</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;">
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.35);text-align:center;">
                Если вы не запрашивали код — никому его не сообщайте и проигнорируйте это письмо.
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.25);text-align:center;">
                © LUNO · Алматы
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
