"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import styles from "./contact-modal.module.css";

const ContactForm = dynamic(
  () => import("./contact-form").then((mod) => mod.ContactForm),
  { ssr: false },
);

const ease = [0.22, 1, 0.36, 1] as const;
const ENTER_S = 0.28;
const EXIT_S = 0.12;
const modalTransition = {
  duration: ENTER_S,
  ease,
  exit: { duration: EXIT_S },
} as const;

type ContactModalContextValue = {
  open: () => void;
  close: () => void;
};

const ContactModalContext = createContext<ContactModalContextValue | null>(null);

export function useContactModal() {
  const ctx = useContext(ContactModalContext);
  if (!ctx) {
    throw new Error("useContactModal must be used within ContactModalProvider");
  }
  return ctx;
}

function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence mode="sync">
      {open ? (
        <>
          <motion.div
            key="contact-modal-backdrop"
            className={styles.backdrop}
            role="presentation"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
          />
          <motion.div
            key="contact-modal-dialog"
            className={styles.dialogWrap}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={modalTransition}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-modal-title"
              className={styles.dialog}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Закрыть"
                onClick={onClose}
              >
                <span className={styles.closeIcon} aria-hidden />
              </button>

              <div className={styles.dialogBody}>
                <div className={styles.header}>
                  <p className={styles.label}>Заявка</p>
                  <h2 id="contact-modal-title" className={styles.title}>
                    Коротко опишите задачу — ответим в течение часа.
                  </h2>
                </div>

                {open ? <ContactForm idPrefix="modal-cf" /> : null}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function ContactModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const scroller = document.getElementById("page-content");
    if (open) {
      document.documentElement.dataset.contactModalOpen = "true";
      if (scroller) scroller.style.overflow = "hidden";
      return;
    }

    delete document.documentElement.dataset.contactModalOpen;
    if (scroller) scroller.style.overflow = "";
  }, [open]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.contactModalOpen;
      const scroller = document.getElementById("page-content");
      if (scroller) scroller.style.overflow = "";
    };
  }, []);

  return (
    <ContactModalContext.Provider value={{ open: openModal, close: closeModal }}>
      {children}
      <ContactModal open={open} onClose={closeModal} />
    </ContactModalContext.Provider>
  );
}
