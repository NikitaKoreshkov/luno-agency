import { withAuthMaintenance } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonOk } from "@/lib/http";

export async function GET() {
  return withAuthMaintenance(async () => {
    const user = await getCurrentUser();
    return jsonOk({ user });
  });
}
