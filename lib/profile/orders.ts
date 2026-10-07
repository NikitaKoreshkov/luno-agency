import { getPool } from "@/lib/db/pool";
import { findCatalogPlan } from "@/lib/profile/constants";
import type { OrderStatus, ServiceId, UserOrder } from "@/lib/profile/types";

type DbOrderRow = {
  id: string;
  user_id: string;
  service_id: string;
  service_name: string;
  plan_id: string;
  plan_name: string;
  price: number;
  currency: string;
  status: OrderStatus;
  period_months: number;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
};

function rowToOrder(row: DbOrderRow): UserOrder {
  return {
    id: row.id,
    userId: row.user_id,
    serviceId: row.service_id as ServiceId,
    serviceName: row.service_name,
    planName: row.plan_name,
    price: row.price,
    currency: row.currency,
    status: row.status,
    periodMonths: row.period_months,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listOrders(userId: string): Promise<UserOrder[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbOrderRow>(
    `SELECT * FROM user_orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(rowToOrder);
}

export async function createOrder(
  userId: string,
  serviceId: ServiceId,
  planId: string
): Promise<UserOrder | null> {
  const catalog = findCatalogPlan(serviceId, planId);
  if (!catalog) return null;

  const pool = getPool();
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + catalog.plan.periodMonths);

  const { rows } = await pool.query<DbOrderRow>(
    `INSERT INTO user_orders (
      user_id, service_id, service_name, plan_id, plan_name,
      price, currency, status, period_months, starts_at, ends_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'KZT', 'active', $7, $8, $9)
    RETURNING *`,
    [
      userId,
      serviceId,
      catalog.service.name,
      planId,
      catalog.plan.name,
      catalog.plan.price,
      catalog.plan.periodMonths,
      startsAt,
      endsAt,
    ]
  );

  return rowToOrder(rows[0]);
}

export async function getActiveServiceNames(userId: string): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ service_name: string }>(
    `SELECT DISTINCT service_name FROM user_orders
     WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  return rows.map((r) => r.service_name);
}
