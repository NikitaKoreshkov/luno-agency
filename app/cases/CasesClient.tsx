"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipContentProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { CSSProperties } from "react";
import { NicheIcon, type NicheIconId } from "@/components/home/niche-icons";

const BRAND = "#ffffff";
const CHART = "#7eb89a";
const BEFORE = "#c97878";
const TRAFFIC_COLORS = ["#7eb89a", "#ffffff", "#888888", "#444444"];

const PANEL: CSSProperties = {
  background: "var(--glass-fill-raised)",
  border: "none",
  borderRadius: "var(--glass-radius-panel)",
  boxShadow: "var(--glass-panel-chrome)",
  backdropFilter: "blur(var(--glass-blur-raised)) saturate(124%)",
  WebkitBackdropFilter: "blur(var(--glass-blur-raised)) saturate(124%)",
};

// ─── Data ────────────────────────────────────────────────────────────────────

const CASES = [
  {
    id: "cafe-alatau",
    client: "Кафе «Алатау»",
    niche: "Ресторан",
    city: "Алматы",
    icon: "restaurants" as NicheIconId,
    duration: "3 месяца",
    dateRange: { before: "Авг — Окт 2024", after: "Ноя 2024 — Янв 2025" },
    what: "SMM + таргет в Instagram, UGC-контент, продуктовые фото и видео под локальную аудиторию",
    services: ["SMM", "Таргет Instagram", "UGC-контент", "Фото/видео"],
    quote: "До LUNO я вообще не верила в Instagram. Теперь у нас бронь расписана на неделю вперёд.",
    author: "Айдана Б., владелица",
    metrics: {
      before: {
        applications: 11,
        avgCheck: 4200,
        reach: 1200,
        followers: 380,
        engagement: 1.2,
        adSpend: 80000,
        cpl: 7273,
        conversion: 0.9,
        roas: 0,
        bookingRate: 22,
      },
      after: {
        applications: 68,
        avgCheck: 5100,
        reach: 18400,
        followers: 2840,
        engagement: 6.8,
        adSpend: 80000,
        cpl: 1176,
        conversion: 3.7,
        roas: 4.3,
        bookingRate: 91,
      },
    },
    monthlyData: [
      { month: "Авг", before: 11, after: null, spend: 0, reach: 1200 },
      { month: "Сен", before: 13, after: null, spend: 0, reach: 1400 },
      { month: "Окт", before: 10, after: null, spend: 0, reach: 1100 },
      { month: "Ноя", before: null, after: 28, spend: 80000, reach: 7200 },
      { month: "Дек", before: null, after: 52, spend: 80000, reach: 14800 },
      { month: "Янв", before: null, after: 68, spend: 80000, reach: 18400 },
    ],
    trafficSources: [
      { name: "Instagram Ads", value: 54 },
      { name: "Органика", value: 28 },
      { name: "Сарафан", value: 12 },
      { name: "Другое", value: 6 },
    ],
    funnelData: [
      { stage: "Охват", before: 1200, after: 18400 },
      { stage: "Переходы", before: 180, after: 4200 },
      { stage: "Сообщения", before: 40, after: 310 },
      { stage: "Записи", before: 11, after: 68 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 2.1, after: 8.4 },
      { day: "Вт", before: 1.8, after: 7.2 },
      { day: "Ср", before: 2.3, after: 9.1 },
      { day: "Чт", before: 1.5, after: 6.8 },
      { day: "Пт", before: 3.2, after: 11.2 },
      { day: "Сб", before: 4.1, after: 14.8 },
      { day: "Вс", before: 3.8, after: 12.9 },
    ],
  },
  {
    id: "dentpro",
    client: "Dent‑Pro Клиника",
    niche: "Стоматология",
    city: "Алматы",
    icon: "clinics" as NicheIconId,
    duration: "2 месяца",
    dateRange: { before: "Сен — Окт 2024", after: "Ноя — Дек 2024" },
    what: "Facebook + Instagram Ads, ретаргетинг, видео-отзывы реальных пациентов и A/B тест аудиторий",
    services: ["Facebook Ads", "Instagram Ads", "Ретаргетинг", "A/B тест"],
    quote: "Рекламный бюджет тот же, но пациентов в 4 раза больше. Команда объяснила всё по цифрам.",
    author: "Алексей М., директор",
    metrics: {
      before: {
        applications: 14,
        avgCheck: 18000,
        reach: 3400,
        followers: 620,
        engagement: 0.8,
        adSpend: 150000,
        cpl: 5200,
        conversion: 0.4,
        roas: 1.7,
        bookingRate: 35,
      },
      after: {
        applications: 58,
        avgCheck: 18000,
        reach: 24600,
        followers: 1180,
        engagement: 3.9,
        adSpend: 150000,
        cpl: 780,
        conversion: 2.4,
        roas: 6.9,
        bookingRate: 78,
      },
    },
    monthlyData: [
      { month: "Сен", before: 14, after: null, spend: 150000, reach: 3400 },
      { month: "Окт", before: 12, after: null, spend: 150000, reach: 3100 },
      { month: "Ноя", before: null, after: 38, spend: 150000, reach: 14200 },
      { month: "Дек", before: null, after: 58, spend: 150000, reach: 24600 },
    ],
    trafficSources: [
      { name: "Facebook Ads", value: 48 },
      { name: "Instagram Ads", value: 31 },
      { name: "Ретаргетинг", value: 14 },
      { name: "Органика", value: 7 },
    ],
    funnelData: [
      { stage: "Охват", before: 3400, after: 24600 },
      { stage: "Переходы", before: 280, after: 3100 },
      { stage: "Сообщения", before: 36, after: 210 },
      { stage: "Записи", before: 14, after: 58 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 1.2, after: 5.1 },
      { day: "Вт", before: 0.9, after: 4.8 },
      { day: "Ср", before: 1.1, after: 5.9 },
      { day: "Чт", before: 0.8, after: 4.2 },
      { day: "Пт", before: 1.4, after: 6.1 },
      { day: "Сб", before: 0.6, after: 2.8 },
      { day: "Вс", before: 0.4, after: 1.9 },
    ],
  },
  {
    id: "primefit",
    client: "PrimeFit",
    niche: "Фитнес-клуб",
    city: "Алматы",
    icon: "fitness" as NicheIconId,
    duration: "1.5 месяца",
    dateRange: { before: "Окт 2024", after: "Ноя — Дек 2024" },
    what: "TikTok + Instagram стратегия с нуля: before/after контент, акции на первую тренировку, таргет по геолокации",
    services: ["TikTok Ads", "Instagram Reels", "Геотаргетинг", "Контент"],
    quote: "За полтора месяца заполнили группы на 3 месяца вперёд. Клубную карту теперь берут сразу.",
    author: "Жанна К., управляющая",
    metrics: {
      before: {
        applications: 0,
        avgCheck: 22000,
        reach: 400,
        followers: 120,
        engagement: 0.3,
        adSpend: 0,
        cpl: 0,
        conversion: 0,
        roas: 0,
        bookingRate: 0,
      },
      after: {
        applications: 112,
        avgCheck: 22000,
        reach: 38000,
        followers: 4200,
        engagement: 8.4,
        adSpend: 120000,
        cpl: 1071,
        conversion: 2.9,
        roas: 20.5,
        bookingRate: 94,
      },
    },
    monthlyData: [
      { month: "Окт", before: 0, after: null, spend: 0, reach: 400 },
      { month: "Ноя", before: null, after: 48, spend: 60000, reach: 18200 },
      { month: "Дек", before: null, after: 112, spend: 120000, reach: 38000 },
    ],
    trafficSources: [
      { name: "TikTok Ads", value: 52 },
      { name: "Instagram Reels", value: 31 },
      { name: "Геотаргетинг", value: 12 },
      { name: "Другое", value: 5 },
    ],
    funnelData: [
      { stage: "Охват", before: 400, after: 38000 },
      { stage: "Переходы", before: 20, after: 5200 },
      { stage: "Сообщения", before: 0, after: 380 },
      { stage: "Записи", before: 0, after: 112 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 0.3, after: 9.2 },
      { day: "Вт", before: 0.2, after: 8.8 },
      { day: "Ср", before: 0.4, after: 10.1 },
      { day: "Чт", before: 0.3, after: 9.4 },
      { day: "Пт", before: 0.5, after: 12.8 },
      { day: "Сб", before: 0.8, after: 16.2 },
      { day: "Вс", before: 0.6, after: 14.1 },
    ],
  },
  {
    id: "kazmall",
    client: "KazMall",
    niche: "E-commerce",
    city: "Алматы",
    icon: "ecommerce" as NicheIconId,
    duration: "4 месяца",
    dateRange: { before: "Май — Авг 2024", after: "Сен — Дек 2024" },
    what: "Performance-таргет, динамический ретаргетинг, креативы под всю воронку от первого касания до покупки",
    services: ["Performance", "Ретаргетинг", "Динам. реклама", "A/B креативы"],
    quote: "ROAS вырос с 1.2 до 4.6. Ребята думают про всю воронку — от первого касания до повторной покупки.",
    author: "Марат Д., владелец",
    metrics: {
      before: {
        applications: 340,
        avgCheck: 8500,
        reach: 28000,
        followers: 5200,
        engagement: 1.8,
        adSpend: 500000,
        cpl: 1470,
        conversion: 1.2,
        roas: 1.2,
        bookingRate: 0,
      },
      after: {
        applications: 920,
        avgCheck: 9800,
        reach: 124000,
        followers: 11400,
        engagement: 4.2,
        adSpend: 500000,
        cpl: 543,
        conversion: 3.8,
        roas: 4.6,
        bookingRate: 0,
      },
    },
    monthlyData: [
      { month: "Май", before: 280, after: null, spend: 500000, reach: 22000 },
      { month: "Июн", before: 310, after: null, spend: 500000, reach: 25000 },
      { month: "Июл", before: 340, after: null, spend: 500000, reach: 28000 },
      { month: "Авг", before: 320, after: null, spend: 500000, reach: 26000 },
      { month: "Сен", before: null, after: 480, spend: 500000, reach: 64000 },
      { month: "Окт", before: null, after: 680, spend: 500000, reach: 88000 },
      { month: "Ноя", before: null, after: 860, spend: 500000, reach: 112000 },
      { month: "Дек", before: null, after: 920, spend: 500000, reach: 124000 },
    ],
    trafficSources: [
      { name: "Дин. ретаргетинг", value: 41 },
      { name: "Performance", value: 35 },
      { name: "Lookalike", value: 16 },
      { name: "Органика", value: 8 },
    ],
    funnelData: [
      { stage: "Охват", before: 28000, after: 124000 },
      { stage: "Переходы", before: 3200, after: 18400 },
      { stage: "В корзину", before: 820, after: 4800 },
      { stage: "Покупка", before: 340, after: 920 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 2.1, after: 5.4 },
      { day: "Вт", before: 1.9, after: 4.8 },
      { day: "Ср", before: 2.4, after: 5.9 },
      { day: "Чт", before: 1.8, after: 4.6 },
      { day: "Пт", before: 2.8, after: 6.8 },
      { day: "Сб", before: 3.4, after: 8.2 },
      { day: "Вс", before: 2.9, after: 7.1 },
    ],
  },
  {
    id: "browlab",
    client: "Brow Lab",
    niche: "Красота",
    city: "Алматы",
    icon: "beauty" as NicheIconId,
    duration: "2 месяца",
    dateRange: { before: "Авг — Сен 2024", after: "Окт — Ноя 2024" },
    what: "Профиль под премиум-сегмент, Reels, Stories с записью и таргет на женскую аудиторию 25–40",
    services: ["Instagram Reels", "Stories Ads", "Таргет", "Профиль"],
    quote: "Профиль, который реально отличается от сотен других бьюти-аккаунтов. Запись заполнена на 3 недели.",
    author: "Сабина Р., владелица",
    metrics: {
      before: {
        applications: 3,
        avgCheck: 12000,
        reach: 800,
        followers: 210,
        engagement: 1.1,
        adSpend: 50000,
        cpl: 4200,
        conversion: 0.4,
        roas: 0.9,
        bookingRate: 18,
      },
      after: {
        applications: 18,
        avgCheck: 15500,
        reach: 12400,
        followers: 1890,
        engagement: 7.2,
        adSpend: 50000,
        cpl: 890,
        conversion: 2.9,
        roas: 5.6,
        bookingRate: 96,
      },
    },
    monthlyData: [
      { month: "Авг", before: 3, after: null, spend: 50000, reach: 800 },
      { month: "Сен", before: 4, after: null, spend: 50000, reach: 900 },
      { month: "Окт", before: null, after: 11, spend: 50000, reach: 7200 },
      { month: "Ноя", before: null, after: 18, spend: 50000, reach: 12400 },
    ],
    trafficSources: [
      { name: "Instagram Reels", value: 58 },
      { name: "Stories Ads", value: 24 },
      { name: "Органика", value: 12 },
      { name: "Другое", value: 6 },
    ],
    funnelData: [
      { stage: "Охват", before: 800, after: 12400 },
      { stage: "Переходы", before: 90, after: 1840 },
      { stage: "Сообщения", before: 8, after: 92 },
      { stage: "Записи", before: 3, after: 18 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 1.4, after: 7.8 },
      { day: "Вт", before: 1.2, after: 6.9 },
      { day: "Ср", before: 1.8, after: 8.4 },
      { day: "Чт", before: 1.1, after: 7.2 },
      { day: "Пт", before: 2.1, after: 10.4 },
      { day: "Сб", before: 2.8, after: 13.2 },
      { day: "Вс", before: 2.2, after: 11.8 },
    ],
  },
  {
    id: "lumiere",
    client: "Lumière Home",
    niche: "E-commerce",
    city: "Алматы",
    icon: "home" as NicheIconId,
    duration: "3 месяца",
    dateRange: { before: "Июл — Сен 2024", after: "Окт — Дек 2024" },
    what: "Reels + таргет на покупателей декора, продуктовые видео и тесты офферов под сезонные пики",
    services: ["Instagram Reels", "Таргет", "Видео", "A/B офферы"],
    quote: "Запустили Reels и таргет — продажи выросли в 2.4 раза за первый квартал. Команда на связи каждый день.",
    author: "Динара С., основатель",
    metrics: {
      before: {
        applications: 85,
        avgCheck: 24000,
        reach: 6200,
        followers: 980,
        engagement: 1.4,
        adSpend: 200000,
        cpl: 2353,
        conversion: 1.4,
        roas: 1.0,
        bookingRate: 0,
      },
      after: {
        applications: 204,
        avgCheck: 26800,
        reach: 48000,
        followers: 4120,
        engagement: 5.8,
        adSpend: 200000,
        cpl: 980,
        conversion: 4.2,
        roas: 2.4,
        bookingRate: 0,
      },
    },
    monthlyData: [
      { month: "Июл", before: 72, after: null, spend: 200000, reach: 5200 },
      { month: "Авг", before: 80, after: null, spend: 200000, reach: 5800 },
      { month: "Сен", before: 85, after: null, spend: 200000, reach: 6200 },
      { month: "Окт", before: null, after: 124, spend: 200000, reach: 28000 },
      { month: "Ноя", before: null, after: 168, spend: 200000, reach: 38000 },
      { month: "Дек", before: null, after: 204, spend: 200000, reach: 48000 },
    ],
    trafficSources: [
      { name: "Instagram Reels", value: 46 },
      { name: "Таргет", value: 36 },
      { name: "Органика", value: 12 },
      { name: "Другое", value: 6 },
    ],
    funnelData: [
      { stage: "Охват", before: 6200, after: 48000 },
      { stage: "Переходы", before: 740, after: 7200 },
      { stage: "В корзину", before: 210, after: 1480 },
      { stage: "Покупка", before: 85, after: 204 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 1.6, after: 6.4 },
      { day: "Вт", before: 1.4, after: 5.8 },
      { day: "Ср", before: 1.8, after: 7.2 },
      { day: "Чт", before: 1.3, after: 6.1 },
      { day: "Пт", before: 2.2, after: 8.8 },
      { day: "Сб", before: 3.1, after: 11.4 },
      { day: "Вс", before: 2.8, after: 9.8 },
    ],
  },
  {
    id: "silkroom",
    client: "Silk Room",
    niche: "Красота",
    city: "Алматы",
    icon: "premium" as NicheIconId,
    duration: "2.5 месяца",
    dateRange: { before: "Авг — Окт 2024", after: "Ноя 2024 — Янв 2025" },
    what: "Премиальная упаковка Instagram, контент про сервис и экспертность, таргет на платёжеспособную аудиторию",
    services: ["Instagram", "Премиум контент", "Таргет", "Брендинг"],
    quote: "Контент стал выглядеть дорого — и клиенты это чувствуют. Средний чек вырос, потому что доверие появилось ещё до визита.",
    author: "Аружан П., основатель",
    metrics: {
      before: {
        applications: 22,
        avgCheck: 18000,
        reach: 2800,
        followers: 440,
        engagement: 1.6,
        adSpend: 60000,
        cpl: 2727,
        conversion: 0.8,
        roas: 6.6,
        bookingRate: 42,
      },
      after: {
        applications: 38,
        avgCheck: 27000,
        reach: 21400,
        followers: 2180,
        engagement: 6.4,
        adSpend: 60000,
        cpl: 1158,
        conversion: 2.8,
        roas: 17.1,
        bookingRate: 88,
      },
    },
    monthlyData: [
      { month: "Авг", before: 18, after: null, spend: 60000, reach: 2400 },
      { month: "Сен", before: 20, after: null, spend: 60000, reach: 2600 },
      { month: "Окт", before: 22, after: null, spend: 60000, reach: 2800 },
      { month: "Ноя", before: null, after: 28, spend: 60000, reach: 12000 },
      { month: "Дек", before: null, after: 34, spend: 60000, reach: 18200 },
      { month: "Янв", before: null, after: 38, spend: 60000, reach: 21400 },
    ],
    trafficSources: [
      { name: "Instagram Таргет", value: 52 },
      { name: "Reels органика", value: 28 },
      { name: "Сарафан", value: 14 },
      { name: "Другое", value: 6 },
    ],
    funnelData: [
      { stage: "Охват", before: 2800, after: 21400 },
      { stage: "Переходы", before: 320, after: 3200 },
      { stage: "Сообщения", before: 48, after: 182 },
      { stage: "Записи", before: 22, after: 38 },
    ],
    weeklyEngagement: [
      { day: "Пн", before: 1.8, after: 7.2 },
      { day: "Вт", before: 1.6, after: 6.8 },
      { day: "Ср", before: 2.1, after: 8.4 },
      { day: "Чт", before: 1.4, after: 6.2 },
      { day: "Пт", before: 2.4, after: 9.8 },
      { day: "Сб", before: 3.2, after: 12.8 },
      { day: "Вс", before: 2.8, after: 11.2 },
    ],
  },
] as const;

type CaseData = (typeof CASES)[number];

function CaseIconBadge({
  icon,
  size = 22,
  tone = "brand",
}: {
  icon: NicheIconId;
  size?: number;
  tone?: "brand" | "neutral";
}) {
  const box = size + 22;
  const isNeutral = tone === "neutral";
  const fg = isNeutral ? "#ffffff" : BRAND;
  const bg = isNeutral ? "rgba(255,255,255,0.06)" : `${BRAND}18`;
  const border = isNeutral ? "rgba(255,255,255,0.14)" : `${BRAND}30`;

  return (
    <div
      style={{
        width: box,
        height: box,
        borderRadius: 12,
        background: bg,
        border: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: fg,
        flexShrink: 0,
      }}
    >
      <NicheIcon id={icon} size={size} />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return String(n);
}

function fmtMoney(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M ₸";
  if (n >= 1000) return Math.round(n / 1000) + "K ₸";
  return n + " ₸";
}

function pct(before: number, after: number) {
  if (!before) return "+∞";
  const delta = ((after - before) / before) * 100;
  return (delta > 0 ? "+" : "") + delta.toFixed(0) + "%";
}

function formatGrowthValue(
  value: number,
  opts?: { suffix?: string; isMoney?: boolean; decimals?: number },
) {
  if (opts?.isMoney) return fmtMoney(value);
  if (opts?.suffix === "×") return `${value.toFixed(1)}×`;
  if (opts?.suffix === "%") {
    const decimals = opts?.decimals ?? (Math.abs(value) < 10 ? 1 : 0);
    return `${value.toFixed(decimals)}%`;
  }
  if (opts?.suffix) return `${value}${opts.suffix}`;
  if (value >= 1000) return fmt(value);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(opts?.decimals ?? 1);
}

function buildAudienceMetrics(c: CaseData) {
  const { before, after } = c.metrics;
  const items: Array<{
    label: string;
    before: number;
    after: number;
    suffix?: string;
    isMoney?: boolean;
    invertDelta?: boolean;
  }> = [
    { label: "Подписчики", before: before.followers, after: after.followers },
    { label: "Охват", before: before.reach, after: after.reach },
    { label: "Engagement Rate", before: before.engagement, after: after.engagement, suffix: "%" },
    { label: "Заявки / Продажи", before: before.applications, after: after.applications },
    { label: "Конверсия сайта", before: before.conversion, after: after.conversion, suffix: "%" },
    { label: "CPL (стоимость лида)", before: before.cpl, after: after.cpl, isMoney: true, invertDelta: true },
    { label: "Средний чек", before: before.avgCheck, after: after.avgCheck, isMoney: true },
    { label: "Рекламный бюджет", before: before.adSpend, after: after.adSpend, isMoney: true },
  ];

  if (after.roas > 0) {
    items.push({ label: "ROAS", before: before.roas, after: after.roas, suffix: "×" });
  }
  if (after.bookingRate > 0) {
    items.push({
      label: "Заполненность записи",
      before: before.bookingRate,
      after: after.bookingRate,
      suffix: "%",
    });
  }

  const funnelReach = c.funnelData[0];
  if (funnelReach) {
    items.push({
      label: "Охват воронки",
      before: funnelReach.before,
      after: funnelReach.after,
    });
  }

  const funnelClicks = c.funnelData[1];
  if (funnelClicks) {
    items.push({
      label: "Переходы по воронке",
      before: funnelClicks.before,
      after: funnelClicks.after,
    });
  }

  const funnelMid = c.funnelData[2];
  if (funnelMid) {
    items.push({
      label: funnelMid.stage,
      before: funnelMid.before,
      after: funnelMid.after,
    });
  }

  const funnelEnd = c.funnelData[3];
  if (funnelEnd) {
    items.push({
      label: funnelEnd.stage,
      before: funnelEnd.before,
      after: funnelEnd.after,
    });
  }

  if (funnelReach && funnelClicks && funnelReach.before > 0 && funnelReach.after > 0) {
    items.push({
      label: "CTR (переходы / охват)",
      before: (funnelClicks.before / funnelReach.before) * 100,
      after: (funnelClicks.after / funnelReach.after) * 100,
      suffix: "%",
    });
  }

  items.push({
    label: "Выручка (заявки × чек)",
    before: before.applications * before.avgCheck,
    after: after.applications * after.avgCheck,
    isMoney: true,
  });

  return items;
}

function buildExtendedFunnelSteps(c: CaseData) {
  const funnel = [...c.funnelData];
  const stageMax = Math.max(...funnel.map(f => f.after));

  const items: Array<{
    stage: string;
    before: number;
    after: number;
    suffix?: string;
    isMoney?: boolean;
    invertDelta?: boolean;
    maxVal?: number;
  }> = funnel.map(f => ({ ...f, maxVal: stageMax }));

  for (let i = 0; i < funnel.length - 1; i++) {
    const from = funnel[i];
    const to = funnel[i + 1];
    items.push({
      stage: `CR: ${from.stage} → ${to.stage}`,
      before: from.before > 0 ? (to.before / from.before) * 100 : 0,
      after: from.after > 0 ? (to.after / from.after) * 100 : 0,
      suffix: "%",
      maxVal: 100,
    });
  }

  items.push({
    stage: "Конверсия воронки",
    before: funnel[0].before > 0 ? (funnel[funnel.length - 1].before / funnel[0].before) * 100 : 0,
    after: funnel[0].after > 0 ? (funnel[funnel.length - 1].after / funnel[0].after) * 100 : 0,
    suffix: "%",
    maxVal: 100,
  });

  return items.map(item => ({
    ...item,
    maxVal: item.maxVal ?? Math.max(item.before, item.after, 1),
  }));
}

function countUpDuration(target: number, coarse = false) {
  if (!coarse) return 1400;
  if (target >= 10000) return 520;
  if (target >= 1000) return 580;
  if (target >= 100) return 640;
  return 900;
}

function countUpStep(target: number) {
  if (target >= 10000) return 800;
  if (target >= 1000) return 120;
  if (target >= 100) return 30;
  if (target >= 10) return 5;
  return 1;
}

function useCountUp(target: number, active: boolean, opts?: { duration?: number; coarse?: boolean }) {
  const coarse = opts?.coarse ?? false;
  const duration = opts?.duration ?? countUpDuration(target, coarse);
  const step = countUpStep(target);
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const raw = target * e;
      const snapped = coarse && step > 1
        ? Math.min(target, Math.round(raw / step) * step)
        : raw;
      setVal(p >= 1 ? target : snapped);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration, coarse, step]);

  return val;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,10,10,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      color: "#fff",
    }}>
      <div style={{ marginBottom: 6, fontWeight: 600, color: "#aaa" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#888" }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Animated Metric Card ────────────────────────────────────────────────────

function MetricCard({
  label,
  before,
  after,
  suffix = "",
  isMoney = false,
  color,
  active,
  invert = false,
}: {
  label: string;
  before: number;
  after: number;
  suffix?: string;
  isMoney?: boolean;
  color: string;
  active: boolean;
  invert?: boolean;
}) {
  const afterVal = useCountUp(after, active, { coarse: isMoney || after >= 100 });
  const isPositive = invert ? after < before : after > before;
  const change = pct(before, after);
  const formatted = isMoney ? fmtMoney(afterVal) : (afterVal >= 1 ? afterVal.toFixed(afterVal >= 100 ? 0 : 1) : afterVal.toFixed(2));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        ...PANEL,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 132,
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ minHeight: 52, flexShrink: 0 }}>
        <div style={{
          fontSize: 11,
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          lineHeight: 1.35,
          minHeight: 30,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          до: <span style={{ color: "#888" }}>{isMoney ? fmtMoney(before) : before}{suffix}</span>
        </div>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "nowrap",
        marginTop: "auto",
        paddingTop: 12,
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, flexShrink: 0 }}>
          {suffix === "₸" || isMoney ? formatted : `${parseFloat(formatted).toFixed(afterVal >= 100 ? 0 : (afterVal >= 10 ? 1 : 2))}${suffix}`}
        </div>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 20,
          background: isPositive ? "rgba(105,240,174,0.12)" : "rgba(255,82,82,0.12)",
          color: isPositive ? CHART : BEFORE,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {isPositive ? "▲" : "▼"} {change}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#666",
      marginBottom: 16,
    }}>
      {children}
    </h3>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ c, onBack }: { c: CaseData; onBack: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "dynamics" | "funnel" | "engagement">("overview");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const tabs = [
    { id: "overview" as const, label: "Обзор" },
    { id: "dynamics" as const, label: "Динамика" },
    { id: "funnel" as const, label: "Воронка" },
    { id: "engagement" as const, label: "Вовлечённость" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: "100vh" }}
    >
      {/* Top bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "24px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        gap: 16,
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            height: 48,
            background: "rgba(255,255,255,0.06)", border: "none",
            color: "rgba(255,255,255,0.92)", borderRadius: 999,
            padding: "0 28px",
            boxShadow: "inset 0 0.6px 0.6px rgba(255,255,255,0.38), inset 0 -0.5px 0.8px rgba(0,0,0,0.22), inset 0 1px 0.5px rgb(255 255 255 / 0.28)",
            cursor: "pointer", fontSize: 16, fontWeight: 500, letterSpacing: "0.04em",
            transition: "background 0.34s cubic-bezier(0.16, 1, 0.3, 1)",
            justifySelf: "start",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >
          ← Все кейсы
        </button>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          justifySelf: "center",
          textAlign: "center",
        }}>
          <CaseIconBadge icon={c.icon} tone="neutral" />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{c.client}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{c.niche} · {c.city} · {c.duration}</div>
          </div>
        </div>

        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifySelf: "end",
          justifyContent: "flex-end",
        }}>
          {c.services.map(s => (
            <span key={s} style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.88)",
              fontSize: 11,
              fontWeight: 600,
            }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Period banner */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 40px 1fr",
        gap: 0,
        margin: "24px 40px",
        ...PANEL,
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", background: "rgba(255,82,82,0.06)" }}>
          <div style={{ fontSize: 10, color: BEFORE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>До LUNO</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{c.dateRange.before}</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.03)",
          color: "#666", fontSize: 16,
        }}>→</div>
        <div style={{ padding: "14px 20px", background: `${CHART}10` }}>
          <div style={{ fontSize: 10, color: CHART, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>После LUNO</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{c.dateRange.after}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: "0 40px",
        marginBottom: 24,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${BRAND}` : "2px solid transparent",
              color: activeTab === tab.id ? "#fff" : "#666",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 40px 60px" }}>
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <OverviewTab c={c} active={mounted} />
            </motion.div>
          )}
          {activeTab === "dynamics" && (
            <motion.div key="dynamics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <DynamicsTab c={c} />
            </motion.div>
          )}
          {activeTab === "funnel" && (
            <motion.div key="funnel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <FunnelTab c={c} active={mounted} />
            </motion.div>
          )}
          {activeTab === "engagement" && (
            <motion.div key="engagement" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <EngagementTab c={c} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ c, active }: { c: CaseData; active: boolean }) {
  const { before, after } = c.metrics;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* KPI grid */}
      <div>
        <SectionTitle>Ключевые показатели</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, alignItems: "stretch" }}>
          <MetricCard label="Заявок / Продаж" before={before.applications} after={after.applications} color={CHART} active={active} />
          <MetricCard label="Охват" before={before.reach} after={after.reach} color={CHART} active={active} />
          <MetricCard label="Подписчики" before={before.followers} after={after.followers} color={CHART} active={active} />
          <MetricCard label="Вовлечённость" before={before.engagement} after={after.engagement} suffix="%" color={CHART} active={active} />
          <MetricCard label="CPL (стоимость лида)" before={before.cpl} after={after.cpl} isMoney color={CHART} active={active} invert />
          <MetricCard label="Конверсия сайта" before={before.conversion} after={after.conversion} suffix="%" color={CHART} active={active} />
          {after.roas > 0 && <MetricCard label="ROAS" before={before.roas} after={after.roas} suffix="x" color={CHART} active={active} />}
          {after.bookingRate > 0 && <MetricCard label="Заполненность записи" before={before.bookingRate} after={after.bookingRate} suffix="%" color={CHART} active={active} />}
        </div>
      </div>

      {/* Traffic + Quote */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Traffic pie */}
        <div style={{
          ...PANEL,
          padding: "20px 24px",
        }}>
          <SectionTitle>Источники трафика (После)</SectionTitle>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={[...c.trafficSources]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1200}
                >
                  {c.trafficSources.map((entry, i) => (
                    <Cell key={i} fill={TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    return (
                      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                        <span style={{ color: "#fff" }}>{p.name}: </span>
                        <span style={{ fontWeight: 700, color: CHART }}>{p.value}%</span>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {c.trafficSources.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#888", flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quote */}
        <div style={{
          ...PANEL,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 11, color: BRAND, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Отзыв клиента</div>
          <blockquote style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: "#ddd",
            fontStyle: "italic",
            margin: 0,
            flex: 1,
          }}>
            «{c.quote}»
          </blockquote>
          <div style={{ marginTop: 20, fontSize: 12, color: BRAND, fontWeight: 600 }}>
            — {c.author}
          </div>
        </div>
      </div>

      {/* What we did */}
      <div style={{
        ...PANEL,
        padding: "20px 24px",
      }}>
        <SectionTitle>Что мы сделали</SectionTitle>
        <p style={{ fontSize: 14, color: "#bbb", lineHeight: 1.7, margin: 0 }}>{c.what}</p>
      </div>
    </div>
  );
}

// ─── Dynamics Tab ─────────────────────────────────────────────────────────────

function DynamicsTab({ c }: { c: CaseData }) {
  const data = [...c.monthlyData];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Динамика заявок / продаж</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-before-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BEFORE} stopOpacity={0.25} />
                <stop offset="95%" stopColor={BEFORE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-after-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={CustomTooltip} cursor={false} />
            <Legend
              wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
              formatter={(val) => <span style={{ color: "#888" }}>{val}</span>}
            />
            <Area
              type="monotone"
              dataKey="before"
              name="До LUNO"
              stroke={BEFORE}
              strokeWidth={2}
              fill={`url(#grad-before-${c.id})`}
              connectNulls={false}
              dot={{ fill: BEFORE, r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={1400}
            />
            <Area
              type="monotone"
              dataKey="after"
              name="После LUNO"
              stroke={CHART}
              strokeWidth={2.5}
              fill={`url(#grad-after-${c.id})`}
              connectNulls={false}
              dot={{ fill: CHART, r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={1600}
              animationBegin={200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Охват аудитории по месяцам</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip content={CustomTooltip} cursor={false} />
            <Bar
              dataKey="reach"
              name="Охват"
              radius={[6, 6, 0, 0]}
              animationDuration={1200}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.after !== null && entry.after !== undefined ? CHART : BEFORE}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
      }}>
        <div style={{
          ...PANEL,
          padding: "24px",
        }}>
          <SectionTitle>Сравнение периодов</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Заявок", before: c.metrics.before.applications, after: c.metrics.after.applications },
              { label: "Охват", before: c.metrics.before.reach, after: c.metrics.after.reach },
              { label: "Подписчики", before: c.metrics.before.followers, after: c.metrics.after.followers },
            ].map(row => {
              const ratio = row.before > 0 ? row.after / row.before : row.after > 0 ? 10 : 1;
              const beforeW = row.before > 0 ? Math.min(100, (row.before / row.after) * 100) : 0;
              const afterW = 100;
              return (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 6 }}>
                    <span>{row.label}</span>
                    <span style={{ color: CHART, fontWeight: 600 }}>×{ratio.toFixed(1)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, color: BEFORE, width: 24 }}>ДО</div>
                      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${beforeW}%` }}
                          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", background: BEFORE, borderRadius: 3 }}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: "#888", width: 40, textAlign: "right" }}>{fmt(row.before)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, color: CHART, width: 24 }}>ПО</div>
                      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${afterW}%` }}
                          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", background: CHART, borderRadius: 3 }}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: "#fff", width: 40, textAlign: "right", fontWeight: 600 }}>{fmt(row.after)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          ...PANEL,
          padding: "24px",
        }}>
          <SectionTitle>Финансовые показатели</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { label: "Рекламный бюджет", before: c.metrics.before.adSpend, after: c.metrics.after.adSpend, mono: true },
              { label: "Стоимость лида (CPL)", before: c.metrics.before.cpl, after: c.metrics.after.cpl, invert: true },
              ...(c.metrics.after.roas > 0 ? [{ label: "ROAS", before: c.metrics.before.roas, after: c.metrics.after.roas, mono: false, suffix: "×" }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: BEFORE }}>
                    {row.suffix ? `${row.before}${row.suffix}` : fmtMoney(row.before)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>после</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: CHART }}>
                    {row.suffix ? `${row.after}${row.suffix}` : fmtMoney(row.after)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Funnel Tab ───────────────────────────────────────────────────────────────

function FunnelStep({
  stage,
  before,
  after,
  maxVal,
  color,
  index,
  suffix,
  isMoney,
  invertDelta,
}: {
  stage: string;
  before: number;
  after: number;
  maxVal: number;
  color: string;
  index: number;
  suffix?: string;
  isMoney?: boolean;
  invertDelta?: boolean;
}) {
  const beforePct = maxVal > 0 ? (before / maxVal) * 100 : 0;
  const afterPct = maxVal > 0 ? (after / maxVal) * 100 : 0;
  const change = pct(before, after);
  const improved = invertDelta ? after < before : after > before;
  const flat = after === before;
  const formatVal = (v: number) => formatGrowthValue(v, { suffix, isMoney });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      style={{
        ...PANEL,
        padding: "18px 20px",
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#ddd", lineHeight: 1.35, flex: 1 }}>{stage}</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: flat ? "#888" : improved ? color : BEFORE,
          background: flat ? "rgba(255,255,255,0.08)" : improved ? `${color}18` : `${BEFORE}18`,
          padding: "2px 10px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {flat ? "—" : change}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 6 }}>
            <span style={{ color: BEFORE }}>ДО</span>
            <span style={{ color: "#888" }}>{formatVal(before)}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(beforePct, 100)}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 + 0.3 }}
              style={{ height: "100%", background: BEFORE, borderRadius: 4, opacity: 0.7 }}
            />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 6 }}>
            <span style={{ color }}>ПОСЛЕ</span>
            <span style={{ color, fontWeight: 700 }}>{formatVal(after)}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(afterPct, 100)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 + 0.5 }}
              style={{ height: "100%", background: color, borderRadius: 4 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FunnelTab({ c, active }: { c: CaseData; active: boolean }) {
  const funnel = [...c.funnelData];
  const extendedFunnel = buildExtendedFunnelSteps(c);

  const convBefore = funnel.length > 1 ? ((funnel[funnel.length - 1].before / funnel[0].before) * 100).toFixed(2) : "0";
  const convAfter = funnel.length > 1 ? ((funnel[funnel.length - 1].after / funnel[0].after) * 100).toFixed(2) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Воронка и конверсии</SectionTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 12,
        }}>
          {extendedFunnel.map((f, i) => (
            <FunnelStep
              key={`${f.stage}-${i}`}
              stage={f.stage}
              before={f.before}
              after={f.after}
              maxVal={f.maxVal ?? 1}
              color={CHART}
              index={i}
              suffix={f.suffix}
              isMoney={f.isMoney}
              invertDelta={f.invertDelta}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{
          ...PANEL,
          background: "rgba(8, 8, 10, 0.52)",
          boxShadow: "var(--desk-glass), inset 0 0 0 1px rgba(201, 120, 120, 0.28), var(--glass-shadow-raised)",
          padding: "20px 24px",
        }}>
          <div style={{ fontSize: 11, color: BEFORE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Конверсия воронки — ДО</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#fff" }}>{convBefore}%</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>от охвата до результата</div>
        </div>
        <div style={{
          ...PANEL,
          boxShadow: "var(--desk-glass), inset 0 0 0 1px rgba(126, 184, 154, 0.28), var(--glass-shadow-raised)",
          padding: "20px 24px",
        }}>
          <div style={{ fontSize: 11, color: CHART, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Конверсия воронки — ПОСЛЕ</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#fff" }}>{convAfter}%</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>от охвата до результата</div>
        </div>
      </div>

      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Сравнение воронок — Bar Chart</SectionTitle>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="stage" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={CustomTooltip} cursor={false} />
            <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} formatter={(val) => <span style={{ color: "#888" }}>{val}</span>} />
            <Bar dataKey="before" name="До" fill={BEFORE} fillOpacity={0.6} radius={[0, 4, 4, 0]} animationDuration={1000} />
            <Bar dataKey="after" name="После" fill={CHART} radius={[0, 4, 4, 0]} animationDuration={1200} animationBegin={200} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Engagement Tab ───────────────────────────────────────────────────────────

function EngagementTab({ c }: { c: CaseData }) {
  const data = [...c.weeklyEngagement];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Вовлечённость по дням недели (%)</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={CustomTooltip} cursor={false} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} formatter={(val) => <span style={{ color: "#888" }}>{val}</span>} />
            <Line
              type="monotone"
              dataKey="before"
              name="До"
              stroke={BEFORE}
              strokeWidth={2}
              dot={{ fill: BEFORE, r: 4 }}
              activeDot={{ r: 6, fill: BEFORE }}
              animationDuration={1200}
            />
            <Line
              type="monotone"
              dataKey="after"
              name="После"
              stroke={CHART}
              strokeWidth={2.5}
              dot={{ fill: CHART, r: 4 }}
              activeDot={{ r: 6, fill: CHART }}
              animationDuration={1400}
              animationBegin={200}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Лучший день", valueBefore: data.reduce((a, b) => a.after > b.after ? a : b).day, valueAfter: data.reduce((a, b) => a.after > b.after ? a : b).day, isText: true },
          { label: "Avg вовлечённость ДО", value: (data.reduce((s, d) => s + d.before, 0) / data.length).toFixed(1) + "%", color: BEFORE },
          { label: "Avg вовлечённость ПОСЛЕ", value: (data.reduce((s, d) => s + d.after, 0) / data.length).toFixed(1) + "%", color: CHART },
        ].map((item, i) => (
          <div key={i} style={{
            ...PANEL,
            padding: "20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.color || "#fff" }}>
              {"value" in item ? item.value : item.valueBefore}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        ...PANEL,
        padding: "24px",
      }}>
        <SectionTitle>Рост показателей аудитории</SectionTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 12,
        }}>
          {buildAudienceMetrics(c).map(m => {
            const delta = pct(m.before, m.after);
            const improved = m.invertDelta ? m.after < m.before : m.after > m.before;
            const flat = m.after === m.before;

            return (
            <div key={m.label} style={{
              padding: "16px",
              ...PANEL,
              minHeight: 118,
              display: "flex",
              flexDirection: "column",
            }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.35, minHeight: 30 }}>
                {m.label}
              </div>
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                marginBottom: 10,
                marginTop: "auto",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: BEFORE, marginBottom: 2 }}>ДО</div>
                  <div style={{ fontSize: 16, color: "#888" }}>
                    {formatGrowthValue(m.before, { suffix: m.suffix, isMoney: m.isMoney })}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#444", marginBottom: 2 }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: CHART, marginBottom: 2 }}>ПОСЛЕ</div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: CHART,
                    lineHeight: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {formatGrowthValue(m.after, { suffix: m.suffix, isMoney: m.isMoney })}
                  </div>
                </div>
              </div>
              <div style={{
                padding: "3px 10px",
                borderRadius: 20,
                background: flat
                  ? "rgba(255,255,255,0.08)"
                  : improved
                    ? `${CHART}18`
                    : `${BEFORE}18`,
                color: flat ? "#888" : improved ? CHART : BEFORE,
                fontSize: 11,
                fontWeight: 600,
                display: "inline-block",
                alignSelf: "flex-start",
              }}>
                {flat ? "без изменений" : delta}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Project Selector Modal ───────────────────────────────────────────────────

function ProjectModal({ onSelect }: { onSelect: (c: CaseData) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const filtered = CASES.filter(c =>
    c.client.toLowerCase().includes(search.toLowerCase()) ||
    c.niche.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 24,
        overflow: "hidden",
        overscrollBehavior: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          ...PANEL,
          padding: "36px",
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
            Кейсы · LUNO
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}>
            Выберите проект
          </h2>
          <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
            Полная аналитика, графики и результаты работы с клиентом
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Поиск по имени или нише..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fff",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => (
            <motion.button
              key={c.id}
              onClick={() => onSelect(c)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                ...PANEL,
                background: hovered === c.id ? "var(--glass-on-fill-hover)" : "var(--glass-fill-raised)",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
            >
              <CaseIconBadge icon={c.icon} tone="neutral" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{c.client}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{c.niche} · {c.city} · {c.duration}</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>до → после</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: BEFORE }}>{c.metrics.before.applications}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 4px" }}>→</span>
                    <span style={{ color: CHART }}>{c.metrics.after.applications}</span>
                    <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>заявок</span>
                  </div>
                </div>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 14,
                }}>
                  →
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CasesClient() {
  const [selected, setSelected] = useState<CaseData | null>(null);
  const [showModal, setShowModal] = useState(true);

  const handleSelect = (c: CaseData) => {
    setSelected(c);
    setShowModal(false);
  };

  const handleBack = () => {
    setSelected(null);
    setShowModal(true);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatePresence>
        {showModal && <ProjectModal key="modal" onSelect={handleSelect} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selected ? (
          <Dashboard key={selected.id} c={selected} onBack={handleBack} />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "60vh",
              color: "#444",
              gap: 12,
            }}
          >
            <CaseIconBadge icon="chart" size={28} />
            <div style={{ fontSize: 14 }}>Выберите проект для просмотра статистики</div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                marginTop: 8,
                height: 48,
                minWidth: 124,
                padding: "0 28px",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                border: "none",
                borderRadius: 999,
                boxShadow: "inset 0 0.6px 0.6px rgba(255,255,255,0.38), inset 0 -0.5px 0.8px rgba(0,0,0,0.22), inset 0 1px 0.5px rgb(255 255 255 / 0.28)",
                fontWeight: 500,
                fontSize: 16,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              Открыть список проектов
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
