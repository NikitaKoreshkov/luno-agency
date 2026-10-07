import { runAuthMaintenance } from "@/lib/auth/cleanup";
import { RateLimitError } from "@/lib/auth/rate-limit";
import { isDatabaseEnabled } from "@/lib/env";
import { jsonError } from "@/lib/http";

export async function withAuthMaintenance<T>(
  handler: () => Promise<T>
): Promise<T> {
  if (isDatabaseEnabled()) {
    await runAuthMaintenance();
  }
  return handler();
}

export function handleAuthRouteError(err: unknown, fallback: string) {
  if (err instanceof RateLimitError) {
    return jsonError(err.message, 429);
  }
  console.error(fallback, err);
  return jsonError(fallback, 500);
}
