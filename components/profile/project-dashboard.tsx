"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
} from "recharts";
import { NicheIcon } from "@/components/home/niche-icons";
import type { ProfileDashboard } from "@/lib/profile/types";
import styles from "./profile-cabinet.module.css";

const BRAND = "#ffffff";
const CHART = "#7eb89a";
const BEFORE = "#c97878";
const TRAFFIC_COLORS = ["#7eb89a", "#ffffff", "#888888", "#444444"];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function MetricCard({
  label,
  before,
  after,
  suffix = "",
  isMoney,
  invert,
  active,
}: {
  label: string;
  before: number;
  after: number;
  suffix?: string;
  isMoney?: boolean;
  invert?: boolean;
  active: boolean;
}) {
  const fmtVal = (v: number) =>
    isMoney ? `${fmt(v)} ₸` : `${fmt(v)}${suffix}`;
  const delta = invert ? before - after : after - before;
  const pct = before > 0 ? Math.round((delta / before) * 100) : 0;

  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValues}>
        <span className={styles.metricBefore}>{fmtVal(before)}</span>
        <span className={styles.metricAfter}>
          {active ? fmtVal(after) : "—"}
        </span>
      </div>
      {active && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: invert
              ? pct > 0
                ? CHART
                : BEFORE
              : pct > 0
                ? CHART
                : BEFORE,
          }}
        >
          {pct > 0 ? "+" : ""}
          {pct}%
        </div>
      )}
    </div>
  );
}

export function ProjectDashboard({ data }: { data: ProfileDashboard }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<
    "overview" | "dynamics" | "funnel" | "engagement"
  >("overview");

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

  const chartData = [...data.monthlyData];

  return (
    <div>
      <div className={styles.panelHeader} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NicheIcon id={data.niche} size={36} />
          <div>
            <h2 className={styles.panelTitle} style={{ fontSize: 22 }}>
              {data.companyName}
            </h2>
            <p className={styles.panelSubtitle}>
              {data.nicheLabel} · {data.city}
            </p>
          </div>
        </div>
        <div className={styles.tagRow}>
          {data.activeServices.map((s) => (
            <span key={s} className={styles.tag}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.periodBanner}>
        <div className={styles.periodBefore}>
          <div className={styles.periodLabel}>До LUNO</div>
          <div className={styles.periodValue}>{data.periodBefore}</div>
        </div>
        <div className={styles.periodArrow}>→</div>
        <div className={styles.periodAfter}>
          <div className={styles.periodLabel}>После LUNO</div>
          <div className={styles.periodValue}>{data.periodAfter}</div>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab}${tab === t.id ? ` ${styles.tabActive}` : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className={styles.sectionTitle}>Ключевые показатели</p>
            <div className={styles.metricGrid}>
              {data.metrics.map((m) => (
                <MetricCard key={m.label} {...m} active={mounted} />
              ))}
            </div>

            <div className={styles.grid2} style={{ marginTop: 24 }}>
              <div className={styles.chartCard}>
                <p className={styles.sectionTitle}>Источники трафика</p>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={data.trafficSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {data.trafficSources.map((_, i) => (
                          <Cell
                            key={i}
                            fill={TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {data.trafficSources.map((s, i) => (
                      <div
                        key={s.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background:
                              TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
                          }}
                        />
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          {s.name}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>
                          {s.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={styles.chartCard}
                style={{
                  borderColor: `${BRAND}30`,
                  background: `${BRAND}0d`,
                }}
              >
                <p className={styles.sectionTitle}>Статус проекта</p>
                <div className={styles.statValue}>{data.progressPercent}%</div>
                <div className={styles.statLabel}>готовность запуска</div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${data.progressPercent}%` }}
                  />
                </div>
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.6,
                  }}
                >
                  {data.projectStatus === "setup"
                    ? "Завершите настройку компании и выберите тариф."
                    : data.projectStatus === "active"
                      ? "Проект активен. Менеджер ведёт кампании."
                      : "Выберите услугу, чтобы запустить продвижение."}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "dynamics" && (
          <motion.div
            key="dynamics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.chartCard}>
              <p className={styles.sectionTitle}>Динамика заявок</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad-before" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BEFORE} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BEFORE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-after" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="before"
                    name="До"
                    stroke={BEFORE}
                    fill="url(#grad-before)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="after"
                    name="После"
                    stroke={CHART}
                    fill="url(#grad-after)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <p className={styles.sectionTitle}>Охват по месяцам</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmt}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="reach" name="Охват" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.after != null ? CHART : BEFORE}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {tab === "funnel" && (
          <motion.div
            key="funnel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.chartCard}>
              <p className={styles.sectionTitle}>Воронка продаж</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={data.funnelData}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis type="number" tick={{ fill: "#666", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fill: "#888", fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="before"
                    name="До"
                    fill={BEFORE}
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="after"
                    name="После"
                    fill={CHART}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {tab === "engagement" && (
          <motion.div
            key="engagement"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.chartCard}>
              <p className={styles.sectionTitle}>
                Вовлечённость по дням недели (%)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.weeklyEngagement}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#666", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="before" name="До" fill={BEFORE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" name="После" fill={CHART} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
