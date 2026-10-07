import type { BudgetRange, GoalId, NicheId, ServiceId } from "@/lib/profile/types";

export const NICHE_OPTIONS: { id: NicheId; label: string }[] = [
  { id: "restaurants", label: "Рестораны и кафе" },
  { id: "clinics", label: "Клиники и медицина" },
  { id: "fitness", label: "Фитнес и спорт" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "beauty", label: "Салоны красоты" },
];

export const GOAL_OPTIONS: { id: GoalId; label: string; hint: string }[] = [
  { id: "leads", label: "Больше заявок", hint: "Запись, звонки, сообщения" },
  { id: "sales", label: "Рост продаж", hint: "Онлайн и офлайн выручка" },
  { id: "brand", label: "Узнаваемость", hint: "Охват, подписчики, доверие" },
  { id: "retention", label: "Удержание", hint: "Повторные визиты и LTV" },
];

export const BUDGET_OPTIONS: { id: BudgetRange; label: string }[] = [
  { id: "under_100k", label: "До 100 000 ₸ / мес" },
  { id: "100_300k", label: "100 000 — 300 000 ₸" },
  { id: "300_700k", label: "300 000 — 700 000 ₸" },
  { id: "700k_plus", label: "От 700 000 ₸" },
];

export const SERVICE_CATALOG: {
  id: ServiceId;
  name: string;
  subtitle: string;
  plans: {
    id: string;
    name: string;
    price: number;
    periodMonths: number;
    features: string[];
    popular?: boolean;
  }[];
}[] = [
  {
    id: "smm",
    name: "SMM",
    subtitle: "Социальные сети",
    plans: [
      {
        id: "smm-start",
        name: "Старт",
        price: 180000,
        periodMonths: 1,
        features: ["2 соцсети", "12 постов", "Stories 3×/нед", "Ежемесячный отчёт"],
      },
      {
        id: "smm-growth",
        name: "Рост",
        price: 320000,
        periodMonths: 1,
        popular: true,
        features: [
          "3 соцсети",
          "20 постов + Reels",
          "Модерация комментариев",
          "Контент-план",
          "Еженедельная аналитика",
        ],
      },
      {
        id: "smm-pro",
        name: "Pro",
        price: 520000,
        periodMonths: 1,
        features: [
          "Полный SMM-пакет",
          "UGC + съёмки",
          "Личный менеджер",
          "A/B тесты контента",
        ],
      },
    ],
  },
  {
    id: "target",
    name: "Таргет",
    subtitle: "Платный трафик",
    plans: [
      {
        id: "target-start",
        name: "Старт",
        price: 150000,
        periodMonths: 1,
        features: ["1 площадка", "Настройка кампаний", "Еженедельная оптимизация"],
      },
      {
        id: "target-growth",
        name: "Рост",
        price: 280000,
        periodMonths: 1,
        popular: true,
        features: [
          "Meta + TikTok",
          "Ретаргетинг",
          "Креативы",
          "Отчёт по CPL/ROAS",
        ],
      },
      {
        id: "target-pro",
        name: "Pro",
        price: 450000,
        periodMonths: 1,
        features: ["Мультиканал", "Look-alike", "Сквозная аналитика", "Ежедневный контроль"],
      },
    ],
  },
  {
    id: "video",
    name: "Видео",
    subtitle: "Видеопроизводство",
    plans: [
      {
        id: "video-start",
        name: "Старт",
        price: 220000,
        periodMonths: 1,
        features: ["4 Reels", "Монтаж", "Субтитры"],
      },
      {
        id: "video-growth",
        name: "Рост",
        price: 380000,
        periodMonths: 1,
        popular: true,
        features: ["8 Reels", "Съёмка 1 день", "Motion-графика", "Адаптация под таргет"],
      },
      {
        id: "video-pro",
        name: "Pro",
        price: 650000,
        periodMonths: 1,
        features: ["Полный продакшн", "2 съёмочных дня", "Сценарии", "Бренд-видео"],
      },
    ],
  },
];

export const TICKET_CATEGORIES = [
  "Общий вопрос",
  "Оплата и счета",
  "Техническая поддержка",
  "Изменение проекта",
  "Отчёты и аналитика",
];

export function nicheLabel(id: NicheId): string {
  return NICHE_OPTIONS.find((n) => n.id === id)?.label ?? id;
}

export function budgetLabel(id: BudgetRange | null): string {
  if (!id) return "Не указан";
  return BUDGET_OPTIONS.find((b) => b.id === id)?.label ?? id;
}

export function findCatalogPlan(serviceId: ServiceId, planId: string) {
  const service = SERVICE_CATALOG.find((s) => s.id === serviceId);
  const plan = service?.plans.find((p) => p.id === planId);
  if (!service || !plan) return null;
  return { service, plan };
}
