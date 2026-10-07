import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { requireDbUser, unauthorizedResponse } from "@/lib/profile/auth";
import { getProfileWorkspace } from "@/lib/profile/workspace";
import { jsonOk } from "@/lib/http";

export async function GET() {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const workspace = await getProfileWorkspace(user.id);
      return jsonOk(workspace);
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось загрузить кабинет");
    }
  });
}
