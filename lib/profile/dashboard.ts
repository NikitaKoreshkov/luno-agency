import { nicheLabel } from "@/lib/profile/constants";
import type { CompanyProfile } from "@/lib/profile/types";
import type { ProfileDashboard } from "@/lib/profile/types";
import type { UserOrder } from "@/lib/profile/types";

const NICHE_BASELINES: Record<
  string,
  {
    applications: number;
    reach: number;
    followers: number;
    engagement: number;
    cpl: number;
    conversion: number;
  }
> = {
  restaurants: {
    applications: 12,
    reach: 1400,
    followers: 420,
    engagement: 1.4,
    cpl: 6800,
    conversion: 0.8,
  },
  clinics: {
    applications: 8,
    reach: 900,
    followers: 310,
    engagement: 1.1,
    cpl: 9200,
    conversion: 0.6,
  },
  fitness: {
    applications: 15,
    reach: 2100,
    followers: 580,
    engagement: 2.0,
    cpl: 4500,
    conversion: 1.2,
  },
  ecommerce: {
    applications: 22,
    reach: 3200,
    followers: 890,
    engagement: 1.8,
    cpl: 3100,
    conversion: 1.5,
  },
  beauty: {
    applications: 10,
    reach: 1100,
    followers: 360,
    engagement: 1.6,
    cpl: 5400,
    conversion: 0.9,
  },
};

function scaleMultiplier(company: CompanyProfile, orders: UserOrder[]): number {
  let m = 1;
  if (company.onboardingCompleted) m += 0.4;
  if (orders.some((o) => o.status === "active")) m += 0.8;
  if (company.desiredServices.length >= 2) m += 0.3;
  if (company.budgetRange === "700k_plus") m += 0.5;
  else if (company.budgetRange === "300_700k") m += 0.3;
  return m;
}

export function buildProfileDashboard(
  company: CompanyProfile,
  orders: UserOrder[]
): ProfileDashboard {
  const baseline =
    NICHE_BASELINES[company.niche] ?? NICHE_BASELINES.restaurants;
  const mult = scaleMultiplier(company, orders);
  const hasActive = orders.some((o) => o.status === "active");

  const before = baseline;
  const after = {
    applications: Math.round(before.applications * (2.2 + mult * 0.8)),
    reach: Math.round(before.reach * (3.5 + mult)),
    followers: Math.round(before.followers * (2.8 + mult * 0.6)),
    engagement: Math.round((before.engagement * (2.5 + mult * 0.4)) * 10) / 10,
    cpl: Math.round(before.cpl / (1.8 + mult * 0.5)),
    conversion: Math.round((before.conversion * (2.2 + mult * 0.3)) * 10) / 10,
  };

  const activeServices =
    orders.filter((o) => o.status === "active").map((o) => o.serviceName);
  if (activeServices.length === 0 && company.desiredServices.length > 0) {
    activeServices.push(
      ...company.desiredServices.map((s) =>
        s === "smm" ? "SMM" : s === "target" ? "Таргет" : "Видео"
      )
    );
  }

  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
  const monthlyData = months.map((month, i) => {
    const isAfter = hasActive && i >= 3;
    const progress = isAfter ? (i - 2) / 3 : 0;
    return {
      month,
      before: i < 3 ? before.applications + i * 2 : null,
      after: isAfter
        ? Math.round(before.applications + (after.applications - before.applications) * progress)
        : null,
      reach: isAfter
        ? Math.round(before.reach + (after.reach - before.reach) * progress)
        : before.reach,
    };
  });

  const progressPercent = company.onboardingCompleted
    ? hasActive
      ? 45 + Math.min(orders.length * 8, 40)
      : 18
    : Math.max(5, company.onboardingStep * 4);

  return {
    companyName: company.companyName || "Ваш проект",
    niche: company.niche,
    nicheLabel: nicheLabel(company.niche),
    city: company.city || "Не указан",
    periodBefore: "До LUNO",
    periodAfter: hasActive ? "Текущий период" : "Планируемый период",
    activeServices: [...new Set(activeServices)],
    projectStatus: !company.onboardingCompleted
      ? "setup"
      : hasActive
        ? "active"
        : "paused",
    progressPercent,
    metrics: [
      {
        label: "Заявок / продаж",
        before: before.applications,
        after: after.applications,
      },
      { label: "Охват", before: before.reach, after: after.reach },
      { label: "Подписчики", before: before.followers, after: after.followers },
      {
        label: "Вовлечённость",
        before: before.engagement,
        after: after.engagement,
        suffix: "%",
      },
      {
        label: "CPL",
        before: before.cpl,
        after: after.cpl,
        isMoney: true,
        invert: true,
      },
      {
        label: "Конверсия",
        before: before.conversion,
        after: after.conversion,
        suffix: "%",
      },
    ],
    monthlyData,
    trafficSources: hasActive
      ? [
          { name: "Instagram Ads", value: 48 },
          { name: "Органика", value: 30 },
          { name: "Сарафан", value: 14 },
          { name: "Другое", value: 8 },
        ]
      : [
          { name: "Органика", value: 55 },
          { name: "Прямые", value: 25 },
          { name: "Рефералы", value: 12 },
          { name: "Другое", value: 8 },
        ],
    funnelData: [
      { stage: "Охват", before: before.reach, after: after.reach },
      {
        stage: "Переходы",
        before: Math.round(before.reach * 0.12),
        after: Math.round(after.reach * 0.14),
      },
      {
        stage: "Заявки",
        before: before.applications,
        after: after.applications,
      },
      {
        stage: "Продажи",
        before: Math.round(before.applications * 0.6),
        after: Math.round(after.applications * 0.72),
      },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 1.8, after: after.engagement * 0.7 },
      { day: "Вт", before: 1.5, after: after.engagement * 0.65 },
      { day: "Ср", before: 2.0, after: after.engagement * 0.75 },
      { day: "Чт", before: 1.4, after: after.engagement * 0.6 },
      { day: "Пт", before: 2.8, after: after.engagement * 0.9 },
      { day: "Сб", before: 3.5, after: after.engagement },
      { day: "Вс", before: 3.1, after: after.engagement * 0.95 },
    ],
    tasks: buildTasks(company, orders, hasActive),
    notifications: buildNotifications(company, orders, hasActive),
  };
}

function buildTasks(
  company: CompanyProfile,
  orders: UserOrder[],
  hasActive: boolean
) {
  const tasks = [];
  if (!company.onboardingCompleted) {
    tasks.push({
      id: "onboarding",
      title: "Завершить настройку компании",
      done: false,
      due: "Сегодня",
    });
  }
  if (company.onboardingCompleted && !hasActive) {
    tasks.push({
      id: "choose-plan",
      title: "Выбрать тариф и активировать услугу",
      done: false,
      due: "На этой неделе",
    });
  }
  if (hasActive) {
    tasks.push({
      id: "brief",
      title: "Заполнить бриф для контент-плана",
      done: orders.length > 0,
      due: "2 дня",
    });
    tasks.push({
      id: "access",
      title: "Предоставить доступ к соцсетям",
      done: false,
      due: "3 дня",
    });
    tasks.push({
      id: "call",
      title: "Созвон с менеджером проекта",
      done: false,
      due: "5 дней",
    });
  }
  return tasks;
}

function buildNotifications(
  company: CompanyProfile,
  orders: UserOrder[],
  hasActive: boolean
) {
  const items = [];
  if (company.onboardingCompleted) {
    items.push({
      id: "welcome",
      text: `Проект «${company.companyName || "без названия"}» создан. Менеджер свяжется с вами.`,
      time: "Только что",
      type: "success" as const,
    });
  }
  if (hasActive) {
    const last = orders[0];
    items.push({
      id: "order",
      text: `Услуга «${last?.serviceName} — ${last?.planName}» активирована.`,
      time: "Сегодня",
      type: "info" as const,
    });
  }
  items.push({
    id: "report",
    text: "Еженедельный отчёт будет доступен в разделе «Дашборд».",
    time: "Вчера",
    type: "info" as const,
  });
  return items;
}
