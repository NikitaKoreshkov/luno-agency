import { SignJWT, jwtVerify } from "jose";
import { getAppUrl, getAuthSecret, getGoogleClientId, getGoogleClientSecret } from "@/lib/env";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const STATE_COOKIE = "google_oauth_state";

export type GoogleProfile = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  verified_email: boolean;
};

function secretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function createOAuthState(): Promise<string> {
  return new SignJWT({ t: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
}

export async function verifyOAuthState(state: string): Promise<boolean> {
  try {
    await jwtVerify(state, secretKey());
    return true;
  } catch {
    return false;
  }
}

export function getGoogleAuthUrl(state: string): string {
  const redirectUri = `${getAppUrl()}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function googleStateCookieOptions(state: string) {
  return {
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
}

export function clearGoogleStateCookie() {
  return {
    name: STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export async function getGoogleStateFromCookie(
  cookieValue: string | undefined
): Promise<string | null> {
  if (!cookieValue) return null;
  const valid = await verifyOAuthState(cookieValue);
  return valid ? cookieValue : null;
}

type GoogleTokenErrorBody = {
  error?: string;
  error_description?: string;
};

export class GoogleAuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function mapGoogleTokenError(body: GoogleTokenErrorBody): GoogleAuthError {
  const err = body.error ?? "unknown";

  if (err === "invalid_client") {
    return new GoogleAuthError(
      "google_invalid_secret",
      "Неверный Client Secret. Скопируйте новый секрет из Google Console в GOOGLE_CLIENT_SECRET (.env.local)"
    );
  }

  if (err === "redirect_uri_mismatch") {
    return new GoogleAuthError(
      "google_redirect",
      "Redirect URI не совпадает. В Google Console добавьте: http://localhost:3000/api/auth/google/callback"
    );
  }

  if (err === "invalid_grant") {
    return new GoogleAuthError(
      "google_grant",
      "Код авторизации истёк. Нажмите «Войти через Google» ещё раз"
    );
  }

  console.error("[google-token]", body);
  return new GoogleAuthError(
    "google_failed",
    body.error_description ?? "Не удалось получить токен Google"
  );
}

export async function exchangeCodeForProfile(
  code: string
): Promise<GoogleProfile> {
  const redirectUri = `${getAppUrl()}/api/auth/google/callback`;

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const body = (await tokenRes.json().catch(() => ({}))) as GoogleTokenErrorBody;
    throw mapGoogleTokenError(body);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Не удалось получить профиль Google");
  }

  return userRes.json() as Promise<GoogleProfile>;
}
