"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LunoLogo } from "@/components/brand/luno-logo";
import { useContactModal } from "@/components/contact/contact-modal-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { ProfileIcon } from "@/components/icons/profile-icon";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { scrollPageToId } from "@/lib/page-scroll";
import { LabTopBarLiquidGlass } from "./lab-glass/LabTopBarLiquidGlass";
import styles from "./Header.module.css";

const LINKS = [
  { href: "#services", label: "Услуги" },
  { href: "#niches", label: "Ниши" },
  { href: "#results", label: "Результаты" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#contact", label: "Заявка" },
];

const CTA_LABEL = "Обсудить проект";
const PROFILE_ARIA = "Мой профиль";

function lockPageScroll() {
  const y = window.scrollY;
  document.documentElement.dataset.navOpen = "true";
  return y;
}

function unlockPageScroll(y: number) {
  delete document.documentElement.dataset.navOpen;
  window.scrollTo(0, y);
}

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { open: openContactModal } = useContactModal();
  const { user } = useAuth();
  const profileHref = user ? AUTH_ROUTES.profile : AUTH_ROUTES.login;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDrawerShown(true);
      setDrawerClosing(false);
      return;
    }
    if (!drawerShown) return;
    setDrawerClosing(true);
    const timer = window.setTimeout(() => {
      setDrawerShown(false);
      setDrawerClosing(false);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [open, drawerShown]);

  useEffect(() => {
    if (!drawerShown) return;
    const y = lockPageScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockPageScroll(y);
    };
  }, [drawerShown]);

  const handleOpenContact = () => {
    setOpen(false);
    openContactModal();
  };

  const shell = (
    <div
      className={`${styles.shell}${drawerShown ? ` ${styles.shellOpen}` : ""}`}
      data-site-header-shell
    >
      <header
        ref={headerRef}
        id="site-header"
        className={styles.header}
        style={{ ["--glass-progress" as string]: "1" }}
      >
        <div className={styles.glassHost} aria-hidden>
          <LabTopBarLiquidGlass hostRef={headerRef} fillHost />
        </div>
        <div className={styles.barInner}>
          <Link href="/" className={styles.logo} aria-label="luno" onClick={() => setOpen(false)}>
            <LunoLogo className={styles.logoTitle} />
          </Link>

          <nav className={styles.nav} aria-label="Навигация">
            {LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={styles.navLink}
                onClick={(event) => {
                  event.preventDefault();
                  scrollPageToId(href);
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className={styles.right}>
            <button type="button" className={styles.cta} onClick={handleOpenContact}>
              {CTA_LABEL}
            </button>
            <Link
              href={profileHref}
              prefetch={false}
              className={styles.profileBtn}
              aria-label={PROFILE_ARIA}
              onClick={() => setOpen(false)}
            >
              <ProfileIcon size={20} />
            </Link>
            <button
              type="button"
              className={`${styles.menuBtn}${open ? ` ${styles.menuBtnOpen}` : ""}`}
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
    </div>
  );

  const drawer =
    mounted && drawerShown ? (
      <div
        className={`${styles.drawer}${drawerClosing ? ` ${styles.drawerClosing}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
      >
        <nav className={styles.drawerNav} aria-label="Навигация">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={styles.drawerLink}
              onClick={(event) => {
                event.preventDefault();
                setOpen(false);
                window.setTimeout(() => scrollPageToId(href), 80);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className={styles.drawerFooter}>
          <button type="button" className={styles.cta} onClick={handleOpenContact}>
            {CTA_LABEL}
          </button>
          <Link
            href={profileHref}
            prefetch={false}
            className={styles.profileBtn}
            aria-label={PROFILE_ARIA}
            onClick={() => setOpen(false)}
          >
            <ProfileIcon size={20} />
          </Link>
        </div>
      </div>
    ) : null;

  if (!mounted) return shell;

  return createPortal(
    <>
      {drawer}
      {shell}
    </>,
    document.body,
  );
}
