import {
  clearGoogleStateCookie,
  exchangeCodeForProfile,
  getGoogleStateFromCookie,
  GoogleAuthError,
} from "@/lib/auth/google";
import { runAuthMaintenance } from "@/lib/auth/cleanup";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { upsertGoogleUser } from "@/lib/auth/users";
import { getAppUrl } from "@/lib/env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${appUrl}${AUTH_ROUTES.login}?error=google_denied`);
  }

  try {
    const cookieStore = await cookies();
    const storedState = await getGoogleStateFromCookie(
      cookieStore.get("google_oauth_state")?.value
    );

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${appUrl}${AUTH_ROUTES.login}?error=google_state`);
    }

    const profile = await exchangeCodeForProfile(code);

    if (!profile.email) {
      return NextResponse.redirect(`${appUrl}${AUTH_ROUTES.login}?error=google_email`);
    }

    await runAuthMaintenance();
    const user = await upsertGoogleUser(profile);
    const jwt = await createSession(user.id, user.email);

    const response = NextResponse.redirect(`${appUrl}${AUTH_ROUTES.profile}`);
    response.cookies.set(sessionCookieOptions(jwt));
    response.cookies.set(clearGoogleStateCookie());
    return response;
  } catch (err) {
    const code = err instanceof GoogleAuthError ? err.code : "google_failed";
    console.error("[google-callback]", err);
    return NextResponse.redirect(`${appUrl}${AUTH_ROUTES.login}?error=${code}`);
  }
}
