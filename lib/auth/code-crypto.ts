import { createHash, randomInt, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/env";

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode(code: string): string {
  return createHash("sha256")
    .update(`${getAuthSecret()}:otp:${code.trim()}`)
    .digest("hex");
}

export function verifyOtpHash(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtpCode(code));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
