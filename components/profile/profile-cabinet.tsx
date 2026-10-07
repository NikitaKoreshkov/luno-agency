"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { PublicUser } from "@/lib/auth/types";
import {
  BUDGET_OPTIONS,
  GOAL_OPTIONS,
  NICHE_OPTIONS,
  SERVICE_CATALOG,
  TICKET_CATEGORIES,
  nicheLabel,
} from "@/lib/profile/constants";
import type {
  CompanyProfile,
  ProfileWorkspace,
  SupportTicket,
  TicketMessage,
  UserOrder,
} from "@/lib/profile/types";
import { NicheIcon } from "@/components/home/niche-icons";
import { CustomSelect } from "./custom-select";
import { CompanyOnboarding } from "./company-onboarding";
import { ProjectDashboard } from "./project-dashboard";
import styles from "./profile-cabinet.module.css";

type Section =
  | "overview"
  | "dashboard"
  | "services"
  | "orders"
  | "tickets"
  | "settings";

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Обзор", icon: "◉" },
  { id: "dashboard", label: "Дашборд проекта", icon: "▣" },
  { id: "services", label: "Услуги", icon: "★" },
  { id: "orders", label: "Покупки", icon: "◈" },
  { id: "tickets", label: "Тикеты", icon: "✉" },
  { id: "settings", label: "Настройки", icon: "⚙" },
];

function statusClass(status: string) {
  if (status === "resolved") return styles.ticketResolved;
  if (status === "in_progress" || status === "waiting")
    return styles.ticketProgress;
  return styles.ticketOpen;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Открыт",
    in_progress: "В работе",
    waiting: "Ожидание",
    resolved: "Решён",
  };
  return map[status] ?? status;
}

function orderStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Ожидает",
    active: "Активен",
    completed: "Завершён",
    cancelled: "Отменён",
  };
  return map[status] ?? status;
}

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ru-RU").format(price)} ₸`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProfileCabinet({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [workspace, setWorkspace] = useState<ProfileWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [newTicket, setNewTicket] = useState({
    subject: "",
    category: TICKET_CATEGORIES[0],
    body: "",
  });
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState<Partial<CompanyProfile>>({});

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/workspace", {
        credentials: "include",
      });
      const data = (await res.json()) as ProfileWorkspace & {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || data.ok === false) {
        setError(data.error ?? "Не удалось загрузить кабинет");
        setOnboardingOpen(true);
        return;
      }

      const company = data.company ?? null;
      setWorkspace({
        company,
        tickets: data.tickets ?? [],
        orders: data.orders ?? [],
        dashboard: data.dashboard ?? null,
      });
      setSettingsForm(company ?? {});
      setOnboardingOpen(!company?.onboardingCompleted);
    } catch {
      setError("Не удалось загрузить кабинет");
      setOnboardingOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleLogout = async () => {
    setLogoutBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setLogoutBusy(false);
    onLogout();
  };

  const handleOnboardingComplete = (company: CompanyProfile) => {
    setWorkspace((w) =>
      w
        ? {
            ...w,
            company,
            dashboard: w.dashboard,
          }
        : { company, tickets: [], orders: [], dashboard: null }
    );
    if (company.onboardingCompleted) {
      setOnboardingOpen(false);
      loadWorkspace();
    } else {
      setOnboardingOpen(true);
    }
  };

  const handlePurchase = async (serviceId: string, planId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ serviceId, planId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order?: UserOrder;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "Ошибка");
      setMessage(`Услуга «${data.order?.serviceName} — ${data.order?.planName}» оформлена`);
      await loadWorkspace();
      setSection("orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newTicket),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Ошибка");
      setShowNewTicket(false);
      setNewTicket({ subject: "", category: TICKET_CATEGORIES[0], body: "" });
      setMessage("Тикет создан. Менеджер ответит в ближайшее время.");
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    const res = await fetch(`/api/profile/tickets/${ticket.id}`, {
      credentials: "include",
    });
    const data = (await res.json()) as {
      ok: boolean;
      messages?: TicketMessage[];
    };
    setTicketMessages(data.messages ?? []);
  };

  const sendTicketReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !ticketReply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/profile/tickets/${selectedTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: ticketReply }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: TicketMessage;
      };
      if (data.message) {
        setTicketMessages((m) => [...m, data.message!]);
        setTicketReply("");
      }
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settingsForm),
      });
      const data = (await res.json()) as {
        ok: boolean;
        company?: CompanyProfile;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "Ошибка");
      setMessage("Настройки сохранены");
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const company = workspace?.company;
  const dashboard = workspace?.dashboard;
  const tickets = workspace?.tickets ?? [];
  const orders = workspace?.orders ?? [];

  const projectStatus = dashboard?.projectStatus ?? "setup";
  const canShowCabinet = !loading && Boolean(company?.onboardingCompleted);
  const onboardingRequired = !loading && !company?.onboardingCompleted;
  const onboardingVisible = onboardingRequired || onboardingOpen;
  const onboardingInitialStep = Math.min(
    Math.max(0, company?.onboardingStep ?? 0),
    4
  );

  return (
    <div className={styles.shell}>
      <CompanyOnboarding
        open={onboardingVisible}
        company={company ?? null}
        initialStep={onboardingInitialStep}
        onComplete={handleOnboardingComplete}
        onClose={
          company?.onboardingCompleted
            ? () => setOnboardingOpen(false)
            : undefined
        }
      />

      {canShowCabinet && (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.userBlock}>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className={styles.userName}>{user.name || "Мой профиль"}</p>
              <p className={styles.userEmail}>{user.email}</p>
              {company?.companyName && (
                <p className={styles.companyBadge}>{company.companyName}</p>
              )}
            </div>
          </div>

          <nav className={styles.nav}>
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.navBtn}${
                  section === item.id ? ` ${styles.navBtnActive}` : ""
                }`}
                onClick={() => {
                  setSection(item.id);
                  setSelectedTicket(null);
                  setError(null);
                  setMessage(null);
                }}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
                {item.id === "tickets" && tickets.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>
                    {tickets.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            {!company?.onboardingCompleted && (
              <button
                type="button"
                className={styles.primaryBtn}
                style={{ width: "100%", marginBottom: 10 }}
                onClick={() => setOnboardingOpen(true)}
              >
                Настроить компанию
              </button>
            )}
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={logoutBusy}
            >
              {logoutBusy ? "Выход…" : "Выйти"}
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          {loading ? (
            <div className={styles.panel}>
              <p className={styles.empty}>Загрузка кабинета…</p>
            </div>
          ) : (
            <div className={styles.panel}>
              {error && <p className={styles.error}>{error}</p>}
              {message && <p className={styles.success}>{message}</p>}

              {section === "overview" && dashboard && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Личный кабинет</h1>
                      <p className={styles.panelSubtitle}>
                        Управление проектом, услугами и поддержкой LUNO
                      </p>
                    </div>
                    <span
                      className={`${styles.statusPill} ${
                        projectStatus === "active"
                          ? styles.statusActive
                          : projectStatus === "setup"
                            ? styles.statusSetup
                            : styles.statusPaused
                      }`}
                    >
                      {projectStatus === "active"
                        ? "● Проект активен"
                        : projectStatus === "setup"
                          ? "● Настройка"
                          : "● Ожидает запуска"}
                    </span>
                  </div>

                  <div className={styles.grid3} style={{ marginBottom: 24 }}>
                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Прогресс</p>
                      <div className={styles.statValue}>
                        {dashboard.progressPercent}%
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${dashboard.progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Активные услуги</p>
                      <div className={styles.statValue}>
                        {orders.filter((o) => o.status === "active").length}
                      </div>
                      <div className={styles.statLabel}>тарифов подключено</div>
                    </div>
                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Тикеты</p>
                      <div className={styles.statValue}>{tickets.length}</div>
                      <div className={styles.statLabel}>обращений в поддержку</div>
                    </div>
                  </div>

                  <div className={styles.grid2}>
                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Задачи проекта</p>
                      <div className={styles.taskList}>
                        {dashboard.tasks.length === 0 ? (
                          <p className={styles.empty}>Все задачи выполнены</p>
                        ) : (
                          dashboard.tasks.map((t) => (
                            <div key={t.id} className={styles.taskItem}>
                              <div
                                className={`${styles.taskCheck}${
                                  t.done ? ` ${styles.taskCheckDone}` : ""
                                }`}
                              >
                                {t.done ? "✓" : ""}
                              </div>
                              <span className={styles.taskTitle}>{t.title}</span>
                              <span className={styles.taskDue}>{t.due}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className={styles.card}>
                      <p className={styles.cardTitle}>Уведомления</p>
                      <div className={styles.notifList}>
                        {dashboard.notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`${styles.notifItem} ${
                              n.type === "success"
                                ? styles.notifSuccess
                                : n.type === "warning"
                                  ? styles.notifWarning
                                  : ""
                            }`}
                          >
                            <p className={styles.notifText}>{n.text}</p>
                            <span className={styles.notifTime}>{n.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {company && (
                    <div className={styles.card} style={{ marginTop: 16 }}>
                      <p className={styles.cardTitle}>О компании</p>
                      <div className={styles.tagRow} style={{ marginBottom: 12 }}>
                        <span className={styles.tag}>
                          {nicheLabel(company.niche)}
                        </span>
                        {company.city && (
                          <span className={styles.tag}>{company.city}</span>
                        )}
                        {company.desiredServices.map((s) => (
                          <span key={s} className={styles.tag}>
                            {s === "smm"
                              ? "SMM"
                              : s === "target"
                                ? "Таргет"
                                : "Видео"}
                          </span>
                        ))}
                      </div>
                      {company.description && (
                        <p
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {company.description}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {section === "dashboard" && dashboard && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Дашборд проекта</h1>
                      <p className={styles.panelSubtitle}>
                        Метрики вашего бизнеса — как в кейсах LUNO
                      </p>
                    </div>
                  </div>
                  <ProjectDashboard data={dashboard} />
                </>
              )}

              {section === "services" && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Услуги и тарифы</h1>
                      <p className={styles.panelSubtitle}>
                        Подключите SMM, таргет или видео — докупите в любой момент
                      </p>
                    </div>
                  </div>
                  {SERVICE_CATALOG.map((service) => (
                    <div key={service.id} style={{ marginBottom: 32 }}>
                      <h3
                        style={{
                          fontSize: 18,
                          color: "#fff",
                          margin: "0 0 4px",
                        }}
                      >
                        {service.name}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.45)",
                          margin: "0 0 16px",
                        }}
                      >
                        {service.subtitle}
                      </p>
                      <div className={styles.serviceGrid}>
                        {service.plans.map((plan) => (
                          <div
                            key={plan.id}
                            className={`${styles.serviceCard}${
                              plan.popular
                                ? ` ${styles.serviceCardPopular}`
                                : ""
                            }`}
                          >
                            <div className={styles.serviceCardHead}>
                              <p className={styles.serviceName}>{plan.name}</p>
                              <span
                                className={`${styles.serviceBadge}${
                                  plan.popular ? "" : ` ${styles.serviceBadgeHidden}`
                                }`}
                              >
                                Популярный
                              </span>
                            </div>
                            <p className={styles.servicePrice}>
                              <span className={styles.servicePriceValue}>
                                {formatPrice(plan.price)}
                              </span>
                              <span className={styles.servicePricePeriod}>
                                / мес
                              </span>
                            </p>
                            <ul className={styles.featureList}>
                              {plan.features.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              className={`${styles.primaryBtn} ${styles.serviceCardBtn}`}
                              disabled={busy}
                              onClick={() =>
                                handlePurchase(service.id, plan.id)
                              }
                            >
                              {busy ? "Оформление…" : "Подключить"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {section === "orders" && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Покупки</h1>
                      <p className={styles.panelSubtitle}>
                        История заказов и активные подписки
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => setSection("services")}
                    >
                      Докупить услугу
                    </button>
                  </div>
                  {orders.length === 0 ? (
                    <div className={styles.empty}>
                      Пока нет заказов.{" "}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-accent)",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                        onClick={() => setSection("services")}
                      >
                        Выбрать тариф
                      </button>
                    </div>
                  ) : (
                    orders.map((o) => (
                      <div key={o.id} className={styles.orderRow}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontWeight: 700, color: "#fff" }}>
                            {o.serviceName} — {o.planName}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.45)",
                              marginTop: 4,
                            }}
                          >
                            {formatDate(o.createdAt)}
                            {o.endsAt && ` · до ${formatDate(o.endsAt)}`}
                          </div>
                        </div>
                        <span className={styles.tag}>
                          {orderStatusLabel(o.status)}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "var(--color-accent)",
                          }}
                        >
                          {formatPrice(o.price)}
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}

              {section === "tickets" && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Тикеты поддержки</h1>
                      <p className={styles.panelSubtitle}>
                        Вопросы по проекту, оплате и отчётам
                      </p>
                    </div>
                    {!selectedTicket && (
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => setShowNewTicket(true)}
                      >
                        Новый тикет
                      </button>
                    )}
                  </div>

                  {selectedTicket ? (
                    <div>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ marginBottom: 16 }}
                        onClick={() => setSelectedTicket(null)}
                      >
                        ← Все тикеты
                      </button>
                      <h2
                        style={{
                          fontSize: 18,
                          color: "#fff",
                          margin: "0 0 8px",
                        }}
                      >
                        {selectedTicket.subject}
                      </h2>
                      <span
                        className={`${styles.ticketStatus} ${statusClass(selectedTicket.status)}`}
                      >
                        {statusLabel(selectedTicket.status)}
                      </span>
                      <div className={styles.messages} style={{ marginTop: 16 }}>
                        {ticketMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`${styles.message} ${
                              m.authorType === "user"
                                ? styles.messageUser
                                : styles.messageSupport
                            }`}
                          >
                            {m.body}
                            <div className={styles.messageTime}>
                              {new Date(m.createdAt).toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ))}
                      </div>
                      <form onSubmit={sendTicketReply}>
                        <textarea
                          className={styles.textarea}
                          value={ticketReply}
                          onChange={(e) => setTicketReply(e.target.value)}
                          placeholder="Ваш ответ…"
                          required
                        />
                        <button
                          type="submit"
                          className={styles.primaryBtn}
                          disabled={busy}
                          style={{ marginTop: 10 }}
                        >
                          Отправить
                        </button>
                      </form>
                    </div>
                  ) : showNewTicket ? (
                    <form onSubmit={handleCreateTicket} className={styles.formGrid}>
                      <label className={styles.field}>
                        <span className={styles.label}>Тема</span>
                        <input
                          className={styles.input}
                          value={newTicket.subject}
                          onChange={(e) =>
                            setNewTicket((t) => ({
                              ...t,
                              subject: e.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <div className={styles.field}>
                        <span className={styles.label}>Категория</span>
                        <CustomSelect
                          value={newTicket.category}
                          onChange={(category) =>
                            setNewTicket((t) => ({ ...t, category }))
                          }
                          options={TICKET_CATEGORIES.map((category) => ({
                            value: category,
                            label: category,
                          }))}
                        />
                      </div>
                      <label className={styles.field}>
                        <span className={styles.label}>Сообщение</span>
                        <textarea
                          className={styles.textarea}
                          value={newTicket.body}
                          onChange={(e) =>
                            setNewTicket((t) => ({ ...t, body: e.target.value }))
                          }
                          required
                        />
                      </label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setShowNewTicket(false)}
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          className={styles.primaryBtn}
                          disabled={busy}
                        >
                          {busy ? "Отправка…" : "Создать тикет"}
                        </button>
                      </div>
                    </form>
                  ) : tickets.length === 0 ? (
                    <div className={styles.empty}>
                      Обращений пока нет. Создайте тикет, если нужна помощь.
                    </div>
                  ) : (
                    <div className={styles.ticketList}>
                      {tickets.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={styles.ticketRow}
                          onClick={() => openTicket(t)}
                        >
                          <div style={{ flex: 1 }}>
                            <div className={styles.ticketSubject}>{t.subject}</div>
                            <div className={styles.ticketMeta}>
                              {t.category} · {formatDate(t.createdAt)}
                            </div>
                          </div>
                          <span
                            className={`${styles.ticketStatus} ${statusClass(t.status)}`}
                          >
                            {statusLabel(t.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {section === "settings" && (
                <>
                  <div className={styles.panelHeader}>
                    <div>
                      <h1 className={styles.panelTitle}>Настройки</h1>
                      <p className={styles.panelSubtitle}>
                        Профиль, компания и безопасность аккаунта
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setOnboardingOpen(true)}
                    >
                      Пройти онбординг заново
                    </button>
                  </div>

                  <form onSubmit={saveSettings} className={styles.formGrid}>
                    <p className={styles.cardTitle}>Аккаунт</p>
                    <div className={styles.grid2}>
                      <label className={styles.field}>
                        <span className={styles.label}>Email</span>
                        <input
                          className={styles.input}
                          value={user.email}
                          disabled
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Имя</span>
                        <input
                          className={styles.input}
                          value={user.name ?? ""}
                          disabled
                        />
                      </label>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                        margin: 0,
                      }}
                    >
                      Email подтверждён: {user.emailVerified ? "да" : "нет"} ·
                      Пароль: {user.hasPassword ? "установлен" : "только Google"}
                    </p>

                    <p
                      className={styles.cardTitle}
                      style={{ marginTop: 24 }}
                    >
                      Компания
                    </p>
                    <div className={styles.grid2}>
                      <label className={styles.field}>
                        <span className={styles.label}>Название</span>
                        <input
                          className={styles.input}
                          value={settingsForm.companyName ?? ""}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              companyName: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Телефон</span>
                        <input
                          className={styles.input}
                          value={settingsForm.phone ?? ""}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              phone: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Город</span>
                        <input
                          className={styles.input}
                          value={settingsForm.city ?? ""}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              city: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Сайт</span>
                        <input
                          className={styles.input}
                          value={settingsForm.website ?? ""}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              website: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className={styles.field}>
                        <span className={styles.label}>Ниша</span>
                        <CustomSelect
                          value={settingsForm.niche ?? "restaurants"}
                          onChange={(niche) =>
                            setSettingsForm((f) => ({
                              ...f,
                              niche: niche as CompanyProfile["niche"],
                            }))
                          }
                          options={NICHE_OPTIONS.map((n) => ({
                            value: n.id,
                            label: n.label,
                            icon: <NicheIcon id={n.id} size={18} />,
                          }))}
                        />
                      </div>
                      <div className={styles.field}>
                        <span className={styles.label}>Бюджет</span>
                        <CustomSelect
                          value={settingsForm.budgetRange ?? ""}
                          onChange={(budgetRange) =>
                            setSettingsForm((f) => ({
                              ...f,
                              budgetRange: (budgetRange ||
                                null) as CompanyProfile["budgetRange"],
                            }))
                          }
                          options={[
                            { value: "", label: "Не указан" },
                            ...BUDGET_OPTIONS.map((b) => ({
                              value: b.id,
                              label: b.label,
                            })),
                          ]}
                        />
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span className={styles.label}>О компании</span>
                      <textarea
                        className={styles.textarea}
                        value={settingsForm.description ?? ""}
                        onChange={(e) =>
                          setSettingsForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className={styles.field}>
                      <span className={styles.label}>Цели</span>
                      <div className={styles.chipGrid}>
                        {GOAL_OPTIONS.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className={`${styles.chip}${
                              (settingsForm.goals ?? []).includes(g.id)
                                ? ` ${styles.chipActive}`
                                : ""
                            }`}
                            onClick={() =>
                              setSettingsForm((f) => {
                                const goals = f.goals ?? [];
                                return {
                                  ...f,
                                  goals: goals.includes(g.id)
                                    ? goals.filter((x) => x !== g.id)
                                    : [...goals, g.id],
                                };
                              })
                            }
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit"
                      className={styles.primaryBtn}
                      disabled={busy}
                    >
                      {busy ? "Сохранение…" : "Сохранить настройки"}
                    </button>
                  </form>
                </>
              )}

              {!dashboard && section !== "settings" && (
                <div className={styles.empty}>
                  Завершите настройку компании, чтобы увидеть данные.
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    style={{ marginTop: 16 }}
                    onClick={() => setOnboardingOpen(true)}
                  >
                    Настроить компанию
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
