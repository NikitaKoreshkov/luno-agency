"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NicheIcon } from "@/components/home/niche-icons";
import {
  BUDGET_OPTIONS,
  GOAL_OPTIONS,
  NICHE_OPTIONS,
  budgetLabel,
  nicheLabel,
} from "@/lib/profile/constants";
import type {
  BudgetRange,
  CompanyProfile,
  GoalId,
  NicheId,
  ServiceId,
} from "@/lib/profile/types";
import authStyles from "@/components/auth/auth-forms.module.css";
import obStyles from "./onboarding.module.css";

const STEPS = [
  "Компания",
  "Контакты",
  "Цели",
  "Услуги",
  "Старт",
];

const SERVICE_OPTIONS: { id: ServiceId; label: string; hint: string }[] = [
  { id: "smm", label: "SMM", hint: "Соцсети" },
  { id: "target", label: "Таргет", hint: "Реклама" },
  { id: "video", label: "Видео", hint: "Контент" },
];

const TEAM_SIZE_OPTIONS = [
  { id: "", label: "Не указан" },
  { id: "1-5", label: "1–5" },
  { id: "6-15", label: "6–15" },
  { id: "16-50", label: "16–50" },
  { id: "50+", label: "50+" },
];

type FormState = {
  companyName: string;
  niche: NicheId;
  phone: string;
  city: string;
  website: string;
  address: string;
  goals: GoalId[];
  budgetRange: BudgetRange | null;
  desiredServices: ServiceId[];
  teamSize: string;
  description: string;
};

function clampStep(value: number) {
  return Math.min(Math.max(0, value), STEPS.length - 1);
}

function FieldLabel({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <span className={obStyles.label}>
      {children}
      {optional && (
        <span className={obStyles.optional}> — необязательно</span>
      )}
    </span>
  );
}

function defaultForm(company: CompanyProfile | null): FormState {
  return {
    companyName: company?.companyName ?? "",
    niche: company?.niche ?? "restaurants",
    phone: company?.phone ?? "",
    city: company?.city ?? "",
    website: company?.website ?? "",
    address: company?.address ?? "",
    goals: company?.goals ?? [],
    budgetRange: company?.budgetRange ?? null,
    desiredServices: company?.desiredServices ?? [],
    teamSize: company?.teamSize ?? "",
    description: company?.description ?? "",
  };
}

export function CompanyOnboarding({
  open,
  company,
  initialStep = 0,
  onComplete,
  onClose,
}: {
  open: boolean;
  company: CompanyProfile | null;
  initialStep?: number;
  onComplete: (company: CompanyProfile) => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState(() => clampStep(initialStep));
  const [form, setForm] = useState<FormState>(() => defaultForm(company));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setStep(clampStep(initialStep));
      setForm(defaultForm(company));
      setError(null);
    }
  }, [open, company, initialStep]);

  useEffect(() => {
    if (!open) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.dataset.contactModalOpen = "true";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      delete document.documentElement.dataset.contactModalOpen;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  const saveProgress = async (patch: Record<string, unknown>, nextStep: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...patch, onboardingStep: nextStep }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        company?: CompanyProfile;
        error?: string;
      };
      if (!data.ok || !data.company) {
        throw new Error(data.error ?? "Ошибка сохранения");
      }
      return data.company;
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 0) {
      if (!form.companyName.trim()) {
        setError("Укажите название компании");
        return;
      }
      const saved = await saveProgress(
        { companyName: form.companyName.trim(), niche: form.niche },
        1
      );
      setStep(1);
      if (saved) onComplete(saved);
      return;
    }

    if (step === 1) {
      const saved = await saveProgress(
        {
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
        },
        2
      );
      setStep(2);
      if (saved) onComplete(saved);
      return;
    }

    if (step === 2) {
      if (form.goals.length === 0) {
        setError("Выберите хотя бы одну цель");
        return;
      }
      const saved = await saveProgress(
        { goals: form.goals, budgetRange: form.budgetRange },
        3
      );
      setStep(3);
      if (saved) onComplete(saved);
      return;
    }

    if (step === 3) {
      if (form.desiredServices.length === 0) {
        setError("Выберите хотя бы одну услугу");
        return;
      }
      const saved = await saveProgress(
        { desiredServices: form.desiredServices },
        4
      );
      setStep(4);
      if (saved) onComplete(saved);
      return;
    }

    if (step === 4) {
      setBusy(true);
      try {
        const res = await fetch("/api/profile/company", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            teamSize: form.teamSize.trim() || null,
            description: form.description.trim() || null,
            onboardingStep: 5,
            onboardingCompleted: true,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          company?: CompanyProfile;
          error?: string;
        };
        if (!data.ok || !data.company) {
          throw new Error(data.error ?? "Ошибка");
        }
        onComplete(data.company);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    }
  };

  const toggleGoal = (id: GoalId) => {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(id)
        ? f.goals.filter((g) => g !== id)
        : [...f.goals, id],
    }));
  };

  const toggleService = (id: ServiceId) => {
    setForm((f) => ({
      ...f,
      desiredServices: f.desiredServices.includes(id)
        ? f.desiredServices.filter((s) => s !== id)
        : [...f.desiredServices, id],
    }));
  };

  if (!mounted || !open) return null;

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          className={obStyles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className={obStyles.dialogWrap}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={obStyles.dialogMotion}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="onboarding-modal" className={obStyles.modalShell}>
              <div className={obStyles.dialogSurface}>
              <div className={obStyles.dialogHead}>
                <div className={obStyles.stepDots}>
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`${obStyles.stepDot}${
                        i < step
                          ? ` ${obStyles.stepDotDone}`
                          : i === step
                            ? ` ${obStyles.stepDotActive}`
                            : ""
                      }`}
                    />
                  ))}
                </div>

                <p className={obStyles.stepLabel}>
                  Шаг {step + 1} из {STEPS.length} · {STEPS[step]}
                </p>

                {step === 0 && (
                  <>
                    <h2 className={obStyles.title}>Расскажите о компании</h2>
                    <p className={`${obStyles.subtitle} ${obStyles.subtitleCompact}`}>
                      Это поможет настроить дашборд и подобрать услуги под ваш бизнес.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h2 className={obStyles.title}>Контакты</h2>
                    <p className={`${obStyles.subtitle} ${obStyles.subtitleCompact}`}>
                      Все поля необязательны — заполните, что удобно.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h2 className={obStyles.title}>Цели и бюджет</h2>
                    <p className={`${obStyles.subtitle} ${obStyles.subtitleCompact}`}>
                      Что для вас важнее всего в ближайшие 3 месяца?
                    </p>
                  </>
                )}
                {step === 3 && (
                  <>
                    <h2 className={obStyles.title}>Какие услуги нужны?</h2>
                    <p className={`${obStyles.subtitle} ${obStyles.subtitleCompact}`}>
                      Можно выбрать несколько — соберём пакет под задачи.
                    </p>
                  </>
                )}
                {step === 4 && (
                  <>
                    <h2 className={obStyles.title}>Почти готово!</h2>
                    <p className={`${obStyles.subtitle} ${obStyles.subtitleCompact}`}>
                      Проверьте данные и запустите личный кабинет.
                    </p>
                  </>
                )}

                {error && <p className={obStyles.error}>{error}</p>}
              </div>

              <form onSubmit={handleNext}>
                <div className={obStyles.dialogBody}>
                {step === 0 && (
                  <div className={obStyles.formGrid}>
                    <label className={obStyles.field}>
                      <FieldLabel>Название компании</FieldLabel>
                      <input
                        className={obStyles.input}
                        value={form.companyName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            companyName: e.target.value,
                          }))
                        }
                        placeholder="Например, Кафе «Алатау»"
                        required
                      />
                    </label>
                    <div className={obStyles.field}>
                      <FieldLabel>Ниша</FieldLabel>
                      <div className={obStyles.nicheGrid}>
                        {NICHE_OPTIONS.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            className={`${obStyles.nicheBtn}${
                              form.niche === n.id
                                ? ` ${obStyles.nicheBtnActive}`
                                : ""
                            }`}
                            onClick={() =>
                              setForm((f) => ({ ...f, niche: n.id }))
                            }
                          >
                            <NicheIcon id={n.id} size={20} />
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className={obStyles.formGrid}>
                    {(
                      [
                        ["phone", "Телефон", "tel", "+7 777 000 00 00"],
                        ["city", "Город", "text", "Алматы"],
                        ["website", "Сайт", "url", "https://"],
                        ["address", "Адрес", "text", "Улица, дом"],
                      ] as const
                    ).map(([key, label, type, placeholder]) => (
                      <label key={key} className={obStyles.field}>
                        <FieldLabel optional>{label}</FieldLabel>
                        <input
                          className={obStyles.input}
                          type={type}
                          value={form[key]}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                          placeholder={placeholder}
                        />
                      </label>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className={obStyles.formGrid}>
                    <div className={obStyles.field}>
                      <FieldLabel>Цели</FieldLabel>
                      <div className={obStyles.chipGrid}>
                        {GOAL_OPTIONS.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className={`${obStyles.chip}${
                              form.goals.includes(g.id)
                                ? ` ${obStyles.chipActive}`
                                : ""
                            }`}
                            onClick={() => toggleGoal(g.id)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={obStyles.field}>
                      <FieldLabel optional>Бюджет на продвижение</FieldLabel>
                      <div className={obStyles.chipGrid}>
                        {BUDGET_OPTIONS.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={`${obStyles.chip}${
                              form.budgetRange === b.id
                                ? ` ${obStyles.chipActive}`
                                : ""
                            }`}
                            onClick={() =>
                              setForm((f) => ({ ...f, budgetRange: b.id }))
                            }
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className={obStyles.serviceGrid}>
                    {SERVICE_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`${obStyles.serviceBtn}${
                          form.desiredServices.includes(s.id)
                            ? ` ${obStyles.serviceBtnActive}`
                            : ""
                        }`}
                        onClick={() => toggleService(s.id)}
                      >
                        <span>{s.label}</span>
                        <span className={obStyles.serviceHint}>{s.hint}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 4 && (
                  <div className={obStyles.formGrid}>
                    <div className={obStyles.summaryPanel}>
                      <div className={obStyles.summaryGrid}>
                        {[
                          ["Компания", form.companyName],
                          ["Ниша", nicheLabel(form.niche)],
                          ["Город", form.city || "—"],
                          ["Телефон", form.phone || "—"],
                          ["Бюджет", budgetLabel(form.budgetRange)],
                        ].map(([k, v]) => (
                          <div key={k} className={obStyles.summaryItem}>
                            <span className={obStyles.summaryKey}>{k}</span>
                            <span className={obStyles.summaryVal}>{v}</span>
                          </div>
                        ))}
                        <div
                          className={`${obStyles.summaryItem} ${obStyles.summaryItemWide}`}
                        >
                          <span className={obStyles.summaryKey}>Услуги</span>
                          <span className={obStyles.summaryVal}>
                            {form.desiredServices
                              .map(
                                (s) =>
                                  SERVICE_OPTIONS.find((o) => o.id === s)?.label
                              )
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={obStyles.field}>
                      <FieldLabel optional>Размер команды</FieldLabel>
                      <div className={obStyles.teamGrid}>
                        {TEAM_SIZE_OPTIONS.map((t) => (
                          <button
                            key={t.id || "none"}
                            type="button"
                            className={`${obStyles.teamBtn}${
                              form.teamSize === t.id
                                ? ` ${obStyles.teamBtnActive}`
                                : ""
                            }`}
                            onClick={() =>
                              setForm((f) => ({ ...f, teamSize: t.id }))
                            }
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className={obStyles.field}>
                      <FieldLabel optional>О компании</FieldLabel>
                      <textarea
                        className={obStyles.textarea}
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Кратко опишите бизнес и текущую ситуацию"
                      />
                    </label>
                  </div>
                )}

                </div>

                <div className={obStyles.dialogFooter}>
                  <div className={obStyles.actions}>
                    {step > 0 && (
                    <button
                      type="button"
                      className={`${authStyles.secondaryBtn} ${obStyles.primary}`}
                      onClick={() => setStep((s) => s - 1)}
                      disabled={busy}
                    >
                      Назад
                    </button>
                  )}
                  <button
                    type="submit"
                    className={`${authStyles.submit} ${obStyles.primary}`}
                    disabled={busy}
                  >
                    {busy
                      ? "Сохранение…"
                      : step === 4
                        ? "Запустить кабинет"
                        : "Далее"}
                  </button>
                  </div>
                </div>
              </form>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </>
    </AnimatePresence>,
    document.body
  );
}
