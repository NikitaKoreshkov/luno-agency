import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { requireDbUser, unauthorizedResponse } from "@/lib/profile/auth";
import {
  addTicketMessage,
  getTicketForUser,
  listTicketMessages,
} from "@/lib/profile/tickets";
import { jsonOk, jsonError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const { id } = await params;
      const ticket = await getTicketForUser(user.id, id);
      if (!ticket) return jsonError("Тикет не найден", 404);

      const messages = await listTicketMessages(user.id, id);
      return jsonOk({ ticket, messages });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось загрузить тикет");
    }
  });
}

export async function POST(request: Request, { params }: Params) {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const { id } = await params;
      const body = (await request.json()) as { body?: string };

      if (!body.body?.trim()) {
        return jsonError("Введите сообщение");
      }

      const message = await addTicketMessage(user.id, id, body.body);
      if (!message) return jsonError("Тикет не найден", 404);

      return jsonOk({ message });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось отправить сообщение");
    }
  });
}
