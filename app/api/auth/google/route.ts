import {
  createOAuthState,
  getGoogleAuthUrl,
  googleStateCookieOptions,
} from "@/lib/auth/google";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getAppUrl } from "@/lib/env";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const state = await createOAuthState();
    const response = NextResponse.redirect(getGoogleAuthUrl(state));
    response.cookies.set(googleStateCookieOptions(state));
    return response;
  } catch (err) {
    console.error("[google-auth]", err);
    return NextResponse.redirect(
      `${getAppUrl()}${AUTH_ROUTES.login}?error=google_config`
    );
  }
}
