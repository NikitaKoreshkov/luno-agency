"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { GlassArea, GlassField } from "@/components/glass-ui";
import styles from "./contact-form.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  idPrefix?: string;
  submitLabel?: string;
  onSuccess?: () => void;
};

export function ContactForm({
  idPrefix = "cf",
  submitLabel = "Отправить заявку",
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !contact || !agreed) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 900));
    setSending(false);
    setSent(true);
    onSuccess?.();
  };

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div
          key="success"
          className={styles.success}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <p className={styles.successTitle}>Заявка отправлена</p>
          <p className={styles.successText}>
            Свяжемся в течение часа. Пока можете посмотреть кейсы.
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          className={styles.form}
          onSubmit={handleSubmit}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Имя</span>
            <GlassField
              id={`${idPrefix}-name`}
              type="text"
              placeholder="Как к вам обращаться"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              liquidIntensity={0.45}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Контакт</span>
            <GlassField
              id={`${idPrefix}-contact`}
              type="text"
              placeholder="Телефон или email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              autoComplete="tel"
              liquidIntensity={0.45}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Задача</span>
            <GlassArea
              id={`${idPrefix}-message`}
              placeholder="Что нужно сделать"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              resize="none"
              liquidIntensity={0.35}
            />
          </label>

          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span>
              Согласен с{" "}
              <Link href="/privacy">политикой конфиденциальности</Link>
            </span>
          </label>

          <button
            type="submit"
            className={styles.submit}
            disabled={sending || !name || !contact || !agreed}
          >
            {sending ? "Отправляем…" : submitLabel}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
