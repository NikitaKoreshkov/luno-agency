import Link from "next/link";
import { LunoLogo } from "@/components/brand/luno-logo";
import styles from "./Footer.module.css";

const NAV = [
  { href: "/#services", label: "Услуги" },
  { href: "/#niches", label: "Ниши" },
  { href: "/#results", label: "Результаты" },
  { href: "/#reviews", label: "Отзывы" },
  { href: "/#contact", label: "Заявка" },
] as const;

const SOCIALS = [
  {
    href: "https://wa.me/77001234567",
    label: "WhatsApp",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.44 0 .16 5.28.16 11.88c0 2.1.55 4.14 1.59 5.94L0 24l6.33-1.66a11.9 11.9 0 0 0 5.7 1.45h.01c6.6 0 11.88-5.28 11.88-11.88 0-3.17-1.24-6.16-3.4-8.43ZM12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.64-.23-.37a9.86 9.86 0 0 1-1.51-5.28c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 6.98c0 5.46-4.45 9.9-9.91 9.9Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.06-.12-.26-.2-.56-.34Z" />
      </svg>
    ),
  },
  {
    href: "https://www.instagram.com/luno.bereau/",
    label: "Instagram",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "https://t.me/lunobereau",
    label: "Telegram",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <p className={styles.colTitle}>Компания</p>
            <Link href="/" className={styles.logo} aria-label="luno">
              <LunoLogo />
            </Link>
            <p className={styles.tagline}>
              SMM, таргет, съёмка, дизайн, сайты и приложения
            </p>
          </div>

          <nav className={styles.navCol} aria-label="Навигация в подвале">
            <p className={styles.colTitle}>Навигация</p>
            <ul className={styles.navList}>
              {NAV.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className={styles.navLink}>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.contactCol}>
            <p className={styles.colTitle}>Контакты</p>
            <ul className={styles.contactList}>
              <li>
                <a href="tel:+77001234567" className={styles.contactPrimary}>
                  +7 700 123 45 67
                </a>
              </li>
              <li>
                <a href="mailto:hello@luno.kz" className={styles.contactLink}>
                  hello@luno.kz
                </a>
              </li>
              <li>
                <span className={styles.contactText}>Пн—Пт, 9:00–18:00</span>
              </li>
              <li>
                <span className={styles.contactText}>Алматы, Казахстан</span>
              </li>
            </ul>
          </div>

          <div className={styles.socialCol}>
            <p className={styles.colTitle}>Соцсети</p>
            <div className={styles.socials}>
              {SOCIALS.map(({ href, label, icon }) => (
                <a
                  key={label}
                  href={href}
                  className={styles.socialLink}
                  aria-label={label}
                  title={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copy}>© {year} LUNO</p>
          <div className={styles.legal}>
            <Link href="/privacy" className={styles.legalLink}>
              Политика конфиденциальности
            </Link>
            <span className={styles.legalDot} aria-hidden>·</span>
            <Link href="/offer" className={styles.legalLink}>
              Публичная оферта
            </Link>
            <span className={styles.legalDot} aria-hidden>·</span>
            <span className={styles.location}>Алматы · Казахстан</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
