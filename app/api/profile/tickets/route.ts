import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { requireDbUser, unauthorizedResponse } from "@/lib/profile/auth";
import { createTicket, listTickets } from "@/lib/profile/tickets";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET() {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const tickets = await listTickets(user.id);
      return jsonOk({ tickets });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось загрузить тикеты");
    }
  });
}

export async function POST(request: Request) {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const body = (await request.json()) as {
        subject?: string;
        category?: string;
        body?: string;
        priority?: "low" | "normal" | "high";
      };

      if (!body.subject?.trim() || !body.body?.trim()) {
        return jsonError("Укажите тему и текст обращения");
      }

      const result = await createTicket(
        user.id,
        body.subject,
        body.category ?? "Общий вопрос",
        body.body,
        body.priority ?? "normal"
      );

      return jsonOk(result);
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось создать тикет");
    }
  });
}
