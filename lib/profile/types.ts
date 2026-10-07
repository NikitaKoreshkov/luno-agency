import type { NicheIconId } from "@/components/home/niche-icons";

export type NicheId = NicheIconId;

export type BudgetRange =
  | "under_100k"
  | "100_300k"
  | "300_700k"
  | "700k_plus";

export type GoalId = "leads" | "sales" | "brand" | "retention";

export type ServiceId = "smm" | "target" | "video";

export type CompanyProfile = {
  id: string;
  userId: string;
  companyName: string;
  niche: NicheId;
  phone: string | null;
  city: string | null;
  website: string | null;
  address: string | null;
  goals: GoalId[];
  budgetRange: BudgetRange | null;
  desiredServices: ServiceId[];
  teamSize: string | null;
  description: string | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyProfileInput = {
  companyName?: string;
  niche?: NicheId;
  phone?: string | null;
  city?: string | null;
  website?: string | null;
  address?: string | null;
  goals?: GoalId[];
  budgetRange?: BudgetRange | null;
  desiredServices?: ServiceId[];
  teamSize?: string | null;
  description?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
};

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved";

export type SupportTicket = {
  id: string;
  userId: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  unreadByUser: number;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  authorType: "user" | "support";
  body: string;
  createdAt: string;
};

export type OrderStatus = "pending" | "active" | "completed" | "cancelled";

export type UserOrder = {
  id: string;
  userId: string;
  serviceId: ServiceId;
  serviceName: string;
  planName: string;
  price: number;
  currency: string;
  status: OrderStatus;
  periodMonths: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type DashboardMetric = {
  label: string;
  before: number;
  after: number;
  suffix?: string;
  isMoney?: boolean;
  invert?: boolean;
};

export type ProfileDashboard = {
  companyName: string;
  niche: NicheId;
  nicheLabel: string;
  city: string;
  periodBefore: string;
  periodAfter: string;
  activeServices: string[];
  projectStatus: "setup" | "active" | "paused";
  progressPercent: number;
  metrics: DashboardMetric[];
  monthlyData: {
    month: string;
    before: number | null;
    after: number | null;
    reach: number;
  }[];
  trafficSources: { name: string; value: number }[];
  funnelData: { stage: string; before: number; after: number }[];
  weeklyEngagement: { day: string; before: number; after: number }[];
  tasks: { id: string; title: string; done: boolean; due: string }[];
  notifications: { id: string; text: string; time: string; type: "info" | "success" | "warning" }[];
};

export type ProfileWorkspace = {
  company: CompanyProfile | null;
  tickets: SupportTicket[];
  orders: UserOrder[];
  dashboard: ProfileDashboard | null;
};
