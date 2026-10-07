import { withAuthMaintenance } from "@/lib/auth/api-guard";
import { handleAuthRouteError } from "@/lib/auth/api-guard";
import { requireDbUser, unauthorizedResponse } from "@/lib/profile/auth";
import { getCompanyByUserId, upsertCompanyProfile } from "@/lib/profile/company";
import type { CompanyProfileInput } from "@/lib/profile/types";
import { jsonOk } from "@/lib/http";

export async function GET() {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const company = await getCompanyByUserId(user.id);
      return jsonOk({ company });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось загрузить профиль компании");
    }
  });
}

export async function PUT(request: Request) {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const body = (await request.json()) as CompanyProfileInput;
      const company = await upsertCompanyProfile(user.id, body);
      return jsonOk({ company });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось сохранить профиль компании");
    }
  });
}

export async function POST(request: Request) {
  return PUT(request);
}
