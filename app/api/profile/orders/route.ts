import { withAuthMaintenance, handleAuthRouteError } from "@/lib/auth/api-guard";
import { requireDbUser, unauthorizedResponse } from "@/lib/profile/auth";
import { createOrder, listOrders } from "@/lib/profile/orders";
import type { ServiceId } from "@/lib/profile/types";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET() {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const orders = await listOrders(user.id);
      return jsonOk({ orders });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось загрузить заказы");
    }
  });
}

export async function POST(request: Request) {
  return withAuthMaintenance(async () => {
    try {
      const user = await requireDbUser();
      if (!user) return unauthorizedResponse();

      const body = (await request.json()) as {
        serviceId?: ServiceId;
        planId?: string;
      };

      if (!body.serviceId || !body.planId) {
        return jsonError("Выберите услугу и тариф");
      }

      const order = await createOrder(user.id, body.serviceId, body.planId);
      if (!order) return jsonError("Тариф не найден");

      return jsonOk({ order });
    } catch (err) {
      return handleAuthRouteError(err, "Не удалось оформить заказ");
    }
  });
}
