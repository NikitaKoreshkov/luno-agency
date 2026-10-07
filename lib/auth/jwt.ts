import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/env";

export type UserAccessTokenPayload = {
  userId: string;
  email: string;
  sessionId: string;
};

function secretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function signUserAccessToken(
  payload: UserAccessTokenPayload,
  expiresAt: Date
): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());
}

export async function verifyUserAccessToken(
  token: string
): Promise<UserAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      return null;
    }
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      sessionId: payload.jti,
    };
  } catch {
    return null;
  }
}

/** Старые сессии: в cookie лежал UUID без точек */
export function isLegacySessionToken(token: string): boolean {
  return !token.includes(".");
}
