"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PasswordField } from "@/components/auth/password-field";
import { VerificationCodeInput } from "@/components/auth/verification-code-input";
import { CODE_TTL_MINUTES } from "@/lib/auth/constants";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import type { PublicUser, VerificationPurpose } from "@/lib/auth/types";
import styles from "./auth-forms.module.css";

export type AuthFormMode = "login" | "register" | "forgot";

type RegisterStep = "email" | "code" | "details";
type ForgotStep = "email" | "code" | "details";

const OAUTH_ERRORS: Record<string, string> = {
  google_denied: "Вход через Google отменён",
  google_state: "Ошибка безопасности OAuth. Попробуйте снова.",
  google_email: "Google не передал email",
  google_failed: "Не удалось войти через Google",
  google_config: "Google OAuth не настроен (проверьте .env)",
  google_invalid_secret:
    "Неверный Client Secret. В Google Console откройте OAuth-клиент → скопируйте Client secret → вставьте в GOOGLE_CLIENT_SECRET в .env.local и перезапустите npm run dev",
  google_redirect:
    "Redirect URI не совпадает. Добавьте в Google Console: http://localhost:3000/api/auth/google/callback",
  google_grant: "Сессия Google истекла. Нажмите «Войти через Google» ещё раз",
};

const TITLES: Record<AuthFormMode, string> = {
  login: "Вход",
  register: "Регистрация",
  forgot: "Сброс пароля",
};

function GoogleIcon() {
  return (
    <svg
      className={styles.googleIcon}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        className={styles.googleIconA}
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        className={styles.googleIconB}
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        className={styles.googleIconC}
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        className={styles.googleIconD}
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function subtitleFor(mode: AuthFormMode, registerStep: RegisterStep, forgotStep: ForgotStep) {
  if (mode === "login") return "Войдите в аккаунт или продолжите через Google";
  if (mode === "register" && registerStep === "email") {
    return "Регистрация с подтверждением email";
  }
  if (mode === "register" && registerStep === "code") return "Введите код из письма";
  if (mode === "register" && registerStep === "details") return "Завершите регистрацию";
  if (mode === "forgot" && forgotStep === "email") return "Сброс пароля по коду из письма";
  if (mode === "forgot" && forgotStep === "code") return "Введите код из письма";
  return "Придумайте новый пароль";
}

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const { setUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [registerStep, setRegisterStep] = useState<RegisterStep>("email");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearCodeFlow = () => {
    setCodeExpiresAt(null);
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  useEffect(() => {
    if (mode !== "login") return;

    const oauthError = searchParams.get("error");
    const resetSuccess = searchParams.get("reset");

    if (resetSuccess === "1") {
      setInfo("Пароль обновлён. Войдите с новым паролем.");
    }

    if (!oauthError) {
      if (resetSuccess === "1") {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("reset");
        const nextUrl = params.size > 0 ? `${pathname}?${params}` : pathname;
        router.replace(nextUrl, { scroll: false });
      }
      return;
    }

    setError(OAUTH_ERRORS[oauthError] ?? "Ошибка авторизации");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("reset");
    const nextUrl = params.size > 0 ? `${pathname}?${params}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [mode, searchParams, pathname, router]);

  useEffect(() => {
    if (mode === "register") {
      setRegisterStep("email");
      clearCodeFlow();
    } else if (mode === "forgot") {
      setForgotStep("email");
      clearCodeFlow();
    }
    resetMessages();
  }, [mode]);

  useEffect(() => {
    if (!codeExpiresAt) return;

    const onExpire = () => {
      clearCodeFlow();
      if (mode === "register" && registerStep !== "email") {
        setRegisterStep("email");
        setError(`Время кода истекло (${CODE_TTL_MINUTES} мин). Запросите новый.`);
        setInfo(null);
      }
      if (mode === "forgot" && forgotStep !== "email") {
        setForgotStep("email");
        setError(`Время кода истекло (${CODE_TTL_MINUTES} мин). Запросите новый.`);
        setInfo(null);
      }
    };

    if (Date.now() >= codeExpiresAt) {
      onExpire();
      return;
    }

    const id = setInterval(() => {
      if (Date.now() >= codeExpiresAt) {
        onExpire();
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [codeExpiresAt, mode, registerStep, forgotStep]);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      user?: PublicUser;
      message?: string;
    };
    if (!data.ok) {
      throw new Error(data.error ?? "Ошибка запроса");
    }
    return data;
  };

  const handleSendCode = async (
    e: FormEvent,
    purpose: "register" | "reset_password"
  ) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const data = await postJson("/api/auth/send-code", { email, purpose });
      setInfo(data.message ?? "Код отправлен на почту");
      clearCodeFlow();
      setCodeExpiresAt(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
      if (purpose === "register") setRegisterStep("code");
      else setForgotStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const data = await postJson("/api/auth/login", { email, password });
      if (data.user) {
        setUser(data.user);
        router.push(AUTH_ROUTES.profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (
    e: FormEvent,
    purpose: VerificationPurpose,
    onSuccess: () => void
  ) => {
    e.preventDefault();
    resetMessages();
    const normalized = code.replace(/\D/g, "");
    if (normalized.length !== 6) {
      setError("Введите все 6 цифр кода");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/auth/verify-code", {
        email,
        code: normalized,
        purpose,
      });
      setCode(normalized);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!privacyAgreed) {
      setError("Нужно согласие с политикой конфиденциальности");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson("/api/auth/register", {
        email,
        code: code.replace(/\D/g, ""),
        password,
        confirmPassword,
        name: name || undefined,
      });
      if (data.user) {
        setUser(data.user);
        router.push(AUTH_ROUTES.profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      await postJson("/api/auth/reset-password", {
        email,
        code: code.replace(/\D/g, ""),
        password,
        confirmPassword,
      });
      router.push(`${AUTH_ROUTES.login}?reset=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.authShell}>
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>{TITLES[mode]}</h1>
          <p className={styles.subtitle}>
            {subtitleFor(mode, registerStep, forgotStep)}
          </p>

          {mode !== "forgot" && (
            <>
              <a href="/api/auth/google" className={styles.googleBtn}>
                <GoogleIcon />
                Войти через Google
              </a>
              {mode === "register" ? (
                <p className={styles.legalNote}>
                  Продолжая через Google, вы принимаете{" "}
                  <Link href="/privacy">политику конфиденциальности</Link>
                </p>
              ) : null}
              <div className={styles.divider}>или</div>
            </>
          )}

          {mode !== "forgot" && (
            <div className={styles.tabs}>
              <Link
                href={AUTH_ROUTES.login}
                className={`${styles.tab}${mode === "login" ? ` ${styles.tabActive}` : ""}`}
              >
                Вход
              </Link>
              <Link
                href={AUTH_ROUTES.register}
                className={`${styles.tab}${mode === "register" ? ` ${styles.tabActive}` : ""}`}
              >
                Регистрация
              </Link>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {info && <p className={styles.success}>{info}</p>}

          {mode === "login" && (
            <form className={styles.form} onSubmit={handleLogin}>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <PasswordField
                id="login-password"
                label="Пароль"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                required
              />
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Вход…" : "Войти"}
              </button>
              <div className={styles.linkRow}>
                <Link href={AUTH_ROUTES.forgotPassword} className={styles.linkBtn}>
                  Забыли пароль?
                </Link>
              </div>
            </form>
          )}

          {mode === "register" && registerStep === "email" && (
            <form
              className={styles.form}
              onSubmit={(e) => handleSendCode(e, "register")}
            >
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <p className={styles.hint}>
                Отправим 6-значный код для подтверждения регистрации
              </p>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Отправка…" : "Получить код"}
              </button>
              <div className={styles.linkRow}>
                <Link href={AUTH_ROUTES.login} className={styles.linkBtn}>
                  Уже есть аккаунт? Войти
                </Link>
              </div>
            </form>
          )}

          {mode === "register" && registerStep === "code" && (
            <form
              className={styles.form}
              onSubmit={(e) =>
                handleVerifyCode(e, "register", () => setRegisterStep("details"))
              }
            >
              <div className={styles.codeField}>
                <span className={styles.label}>Код из письма</span>
                <VerificationCodeInput
                  idPrefix="reg-code"
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                />
                <p className={styles.codeHint}>
                  Код действует {CODE_TTL_MINUTES} минут. Имя и пароль не сохраняются,
                  пока регистрация не завершена.
                </p>
              </div>
              <button
                type="submit"
                className={styles.submit}
                disabled={busy || code.replace(/\D/g, "").length !== 6}
              >
                {busy ? "Проверка…" : "Продолжить"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setRegisterStep("email");
                  clearCodeFlow();
                  resetMessages();
                }}
              >
                Изменить email
              </button>
            </form>
          )}

          {mode === "register" && registerStep === "details" && (
            <form className={styles.form} onSubmit={handleRegister}>
              <label className={styles.field}>
                <span className={styles.label}>Имя (необязательно)</span>
                <input
                  className={styles.input}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <PasswordField
                id="register-password"
                label="Пароль"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                required
              />
              <PasswordField
                id="register-password-confirm"
                label="Подтвердите пароль"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
              />
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  required
                />
                <span>
                  Согласен с{" "}
                  <Link href="/privacy">политикой конфиденциальности</Link>
                </span>
              </label>
              <button
                type="submit"
                className={styles.submit}
                disabled={busy || !privacyAgreed}
              >
                {busy ? "Регистрация…" : "Зарегистрироваться"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setRegisterStep("code");
                  resetMessages();
                }}
              >
                Назад к коду
              </button>
            </form>
          )}

          {mode === "forgot" && forgotStep === "email" && (
            <form
              className={styles.form}
              onSubmit={(e) => handleSendCode(e, "reset_password")}
            >
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Отправка…" : "Отправить код"}
              </button>
              <div className={styles.linkRow}>
                <Link href={AUTH_ROUTES.login} className={styles.linkBtn}>
                  Вернуться ко входу
                </Link>
              </div>
            </form>
          )}

          {mode === "forgot" && forgotStep === "code" && (
            <form
              className={styles.form}
              onSubmit={(e) =>
                handleVerifyCode(e, "reset_password", () => setForgotStep("details"))
              }
            >
              <div className={styles.codeField}>
                <span className={styles.label}>Код из письма</span>
                <VerificationCodeInput
                  idPrefix="forgot-code"
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                />
                <p className={styles.codeHint}>
                  Код действует {CODE_TTL_MINUTES} минут.
                </p>
              </div>
              <button
                type="submit"
                className={styles.submit}
                disabled={busy || code.replace(/\D/g, "").length !== 6}
              >
                {busy ? "Проверка…" : "Продолжить"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setForgotStep("email");
                  clearCodeFlow();
                  resetMessages();
                }}
              >
                Изменить email
              </button>
            </form>
          )}

          {mode === "forgot" && forgotStep === "details" && (
            <form className={styles.form} onSubmit={handleResetPassword}>
              <PasswordField
                id="forgot-password"
                label="Новый пароль"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                required
              />
              <PasswordField
                id="forgot-password-confirm"
                label="Подтвердите пароль"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
              />
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Сохранение…" : "Сохранить пароль"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setForgotStep("code");
                  resetMessages();
                }}
              >
                Назад к коду
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
