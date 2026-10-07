import { getCompanyByUserId } from "@/lib/profile/company";
import { buildProfileDashboard } from "@/lib/profile/dashboard";
import { listOrders } from "@/lib/profile/orders";
import { listTickets } from "@/lib/profile/tickets";
import type { ProfileWorkspace } from "@/lib/profile/types";

export async function getProfileWorkspace(
  userId: string
): Promise<ProfileWorkspace> {
  const [company, tickets, orders] = await Promise.all([
    getCompanyByUserId(userId),
    listTickets(userId),
    listOrders(userId),
  ]);

  const dashboard = company ? buildProfileDashboard(company, orders) : null;

  return { company, tickets, orders, dashboard };
}
