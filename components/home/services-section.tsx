"use client";

import { useRef, useEffect, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ServicesPanelGlass } from "./services-panel-glass";
import styles from "./services-section.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

type StatConfig =
  | { prefix: "×"; end: number; rangeSuffix?: string }
  | { prefix: "−"; end: number; suffix: "%" };

const HEADING_LINES = ["SMM | Таргет | Съёмка | Web", "Одна команда"] as const;

const SERVICES = [
  {
    num: "01",
    title: "SMM",
    subtitle: "Социальные сети",
    stat: { prefix: "×", end: 3, rangeSuffix: "–5" } satisfies StatConfig,
    statLabel: "рост охвата",
    benefit: "Подписчики → покупатели",
    channels: ["Instagram", "Reels", "Stories"],
  },
  {
    num: "02",
    title: "Таргет",
    subtitle: "Платный трафик",
    stat: { prefix: "−", end: 60, suffix: "%" } satisfies StatConfig,
    statLabel: "стоимость заявки",
    benefit: "Платите за результат, не за показы",
    channels: ["Meta Ads", "TikTok", "Яндекс"],
    featured: true,
  },
  {
    num: "03",
    title: "Видео",
    subtitle: "Видеопроизводство",
    stat: { prefix: "×", end: 4 } satisfies StatConfig,
    statLabel: "CTR рекламы",
    benefit: "Контент, который останавливает скролл",
    channels: ["Reels", "Ролики", "Монтаж"],
  },
  {
    num: "04",
    title: "Web & Tech",
    subtitle: "Сайты и приложения",
    stat: { prefix: "×", end: 2, rangeSuffix: "–3" } satisfies StatConfig,
    statLabel: "рост конверсии",
    benefit: "Продукт, который продаёт сам",
    channels: ["Сайты", "Приложения", "Telegram"],
    featured: true,
  },
] as const;

const viewport = { once: true, margin: "-10%" as const };

/**
 * Один общий rAF на все счётчики и печатающиеся строки блока.
 * Раньше каждый из 12 компонентов дёргал setState на каждый кадр (или каждые
 * 28-45 мс), и каждый такой рендер помечал грязным тайл большой панели со
 * стеклом — то есть перерисовывал текст внутри композитного слоя, который
 * держится в памяти весь скролл. Здесь React рендерит только стартовое значение
 * (метрики те же, сдвига нет), а дальше кадр пишет textContent напрямую:
 * ни одного рендера на символ.
 */
type Ticker = (now: number) => boolean;

const tickers = new Set<Ticker>();
let tickerRaf = 0;

function pump() {
  tickerRaf = 0;
  const now = performance.now();
  for (const tick of Array.from(tickers)) {
    if (!tick(now)) tickers.delete(tick);
  }
  if (tickers.size > 0) tickerRaf = requestAnimationFrame(pump);
}

function subscribe(tick: Ticker) {
  tickers.add(tick);
  if (!tickerRaf) tickerRaf = requestAnimationFrame(pump);
  return () => {
    tickers.delete(tick);
  };
}

function AnimatedNum({
  value,
  active,
  reduce,
  className,
}: {
  value: string;
  active: boolean;
  reduce: boolean | null;
  className?: string;
}) {
  const outRef = useRef<HTMLSpanElement>(null);
  const target = parseInt(value, 10);

  useEffect(() => {
    const out = outRef.current;
    if (!out || !active) return;
    if (reduce) {
      out.textContent = value;
      return;
    }
    let from = 0;
    return subscribe((now) => {
      if (!from) from = now;
      const p = Math.min((now - from) / 1000, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      out.textContent = String(Math.round(target * eased)).padStart(value.length, "0");
      return p < 1;
    });
  }, [active, reduce, target, value]);

  return <span ref={outRef} className={className}>{String(0).padStart(value.length, "0")}</span>;
}

function statText(config: StatConfig, n: number, withRange: boolean) {
  if (config.prefix === "−") return `${config.prefix}${n}${config.suffix}`;
  return `${config.prefix}${n}${withRange ? (config.rangeSuffix ?? "") : ""}`;
}

function AnimatedStat({
  config,
  active,
  reduce,
  className,
}: {
  config: StatConfig;
  active: boolean;
  reduce: boolean | null;
  className?: string;
}) {
  const outRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const out = outRef.current;
    if (!out || !active) return;
    if (reduce) {
      out.textContent = statText(config, config.end, true);
      return;
    }
    const range = config.prefix === "×" ? config.rangeSuffix : undefined;
    let from = 0;
    return subscribe((now) => {
      if (!from) from = now;
      const elapsed = now - from;
      const p = Math.min(elapsed / 1300, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = Math.round(config.end * eased);
      // «–5» дописываем через 120 мс после того, как счётчик дошёл до края
      const withRange = !!range && p >= 1 && elapsed >= 1420;
      out.textContent = statText(config, n, withRange);
      return !(p >= 1 && (!range || withRange));
    });
  }, [active, reduce, config]);

  return <span ref={outRef} className={className}>{statText(config, 0, false)}</span>;
}

function TypewriterText({
  text,
  active,
  reduce,
  className,
  delay = 0,
  speed = 32,
}: {
  text: string;
  active: boolean;
  reduce: boolean | null;
  className?: string;
  delay?: number;
  speed?: number;
}) {
  const outRef = useRef<HTMLSpanElement>(null);
  // idle (ещё не в вьюпорте) → typing (моргает курсор) → done
  const [phase, setPhase] = useState<"idle" | "typing" | "done">("idle");

  useEffect(() => {
    const out = outRef.current;
    if (!out || !active) return;

    if (reduce) {
      out.textContent = text;
      setPhase("done");
      return;
    }

    setPhase("typing");
    let from = 0;
    return subscribe((now) => {
      if (!from) from = now + delay;
      const elapsed = now - from;
      if (elapsed < 0) return true;
      const i = Math.min(Math.floor(elapsed / speed) + 1, text.length);
      out.textContent = text.slice(0, i);
      if (i >= text.length) {
        setPhase("done");
        return false;
      }
      return true;
    });
  }, [active, text, reduce, delay, speed]);

  return (
    <span className={className} aria-label={text}>
      <span ref={outRef} />
      {phase === "typing" && (
        <span className={styles.typeCursor} aria-hidden>
          |
        </span>
      )}
    </span>
  );
}

const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease },
  },
};

const panelReveal: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 1.45,
      ease: [0.16, 1, 0.3, 1],
      opacity: { duration: 1.15, ease: [0.22, 1, 0.36, 1] },
      y: { duration: 1.45, ease: [0.16, 1, 0.3, 1] },
      scale: { duration: 1.5, ease: [0.16, 1, 0.3, 1] },
    },
  },
};

const cardReveal = (index: number): Variants => ({
  hidden: {
    opacity: 0,
    y: 56,
    x: index === 0 ? -24 : index === 3 ? 24 : 0,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    transition: { duration: 0.95, ease, delay: index * 0.14 },
  },
});

const cardContent: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease },
  },
};

const statPop: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.88 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.75, ease },
  },
};

function ServiceCard({
  service,
  index,
  reduce,
}: {
  service: (typeof SERVICES)[number];
  index: number;
  reduce: boolean | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, viewport);

  return (
    <motion.div
      ref={ref}
      className={
        "featured" in service && service.featured
          ? `${styles.card} ${styles.cardActive}`
          : styles.card
      }
      initial={reduce ? false : "hidden"}
      animate={reduce || inView ? "visible" : "hidden"}
      variants={reduce ? undefined : cardReveal(index)}
    >
      <motion.span
        className={styles.watermark}
        aria-hidden
        variants={reduce ? undefined : cardItem}
      >
        <AnimatedNum value={service.num} active={inView} reduce={reduce} />
      </motion.span>

      <motion.div
        className={styles.cardInner}
        variants={reduce ? undefined : cardContent}
        initial={reduce ? false : "hidden"}
        animate={reduce || inView ? "visible" : "hidden"}
      >
        <motion.div className={styles.cardHead} variants={reduce ? undefined : cardItem}>
          <TypewriterText
            text={service.subtitle}
            active={inView}
            reduce={reduce}
            className={styles.subtitle}
            delay={200}
            speed={36}
          />
          <AnimatedNum
            value={service.num}
            active={inView}
            reduce={reduce}
            className={styles.num}
          />
        </motion.div>

        <motion.h3 className={styles.title} variants={reduce ? undefined : cardItem}>
          {service.title}
        </motion.h3>

        <motion.div className={styles.statBlock} variants={reduce ? undefined : statPop}>
          <AnimatedStat
            config={service.stat}
            active={inView}
            reduce={reduce}
            className={styles.stat}
          />
          <TypewriterText
            text={service.statLabel}
            active={inView}
            reduce={reduce}
            className={styles.statLabel}
            delay={700}
            speed={40}
          />
        </motion.div>

        <motion.p className={styles.benefit} variants={reduce ? undefined : cardItem}>
          <TypewriterText
            text={service.benefit}
            active={inView}
            reduce={reduce}
            delay={950}
            speed={28}
          />
        </motion.p>

        <motion.p className={styles.channels} variants={reduce ? undefined : cardItem}>
          {service.channels.map((ch, idx) => (
            <span key={ch}>
              {idx > 0 && <span className={styles.channelSep} aria-hidden>·</span>}
              {ch}
            </span>
          ))}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

export function ServicesSection() {
  const headerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, viewport);
  const panelInView = useInView(panelRef, { once: true, margin: "-12%" });
  const reduce = useReducedMotion();
  // Композитный слой живёт ровно пока идёт появление панели (см. CSS).
  const [livePanel, setLivePanel] = useState(false);
  const [liveVeil, setLiveVeil] = useState(false);

  useEffect(() => {
    if (reduce) {
      setLivePanel(false);
      setLiveVeil(false);
      return;
    }
    // Слой поднимаем только перед твином: до появления секции в кадре
    // will-change висел на 22 панелях и держал их композитные слои на всём
    // скролле страницы.
    if (panelInView) {
      setLivePanel(true);
      setLiveVeil(true);
    }
  }, [panelInView, reduce]);

  return (
    <section id="services" className={styles.section} ref={sectionRef}>
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          ref={headerRef}
          initial={reduce ? false : "hidden"}
          animate={reduce || headerInView ? "visible" : "hidden"}
          variants={reduce ? undefined : revealUp}
        >
          <p className={styles.label}>
            <TypewriterText
              text="Что мы делаем"
              active={headerInView}
              reduce={reduce}
              delay={300}
              speed={45}
            />
          </p>

          <h2 className={styles.heading} data-in={headerInView ? "1" : "0"}>
            {HEADING_LINES.map((line, i) => (
              <span key={line} className={styles.lineMask}>
                <span
                  className={styles.lineInner}
                  style={{ transitionDelay: `${140 + i * 120}ms` }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h2>
        </motion.div>

        <div ref={panelRef} className={styles.panelWrap}>
          <motion.div
            className={`${styles.panelMotion}${livePanel ? ` ${styles.panelMotionLive}` : ""}`}
            initial={reduce ? false : "hidden"}
            animate={reduce || panelInView ? "visible" : "hidden"}
            variants={reduce ? undefined : panelReveal}
            onAnimationComplete={() => {
              if (panelInView) setLivePanel(false);
            }}
          >
            <ServicesPanelGlass>
              <div className={styles.grid}>
                {SERVICES.map((s, i) => (
                  <ServiceCard key={s.num} service={s} index={i} reduce={reduce} />
                ))}
              </div>
            </ServicesPanelGlass>
          </motion.div>

          {!reduce && (
            <motion.div
              className={`${styles.panelBlurVeil}${liveVeil ? ` ${styles.panelVeilLive}` : ""}`}
              aria-hidden
              initial={{ opacity: 1 }}
              animate={panelInView ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              onAnimationComplete={() => {
                if (panelInView) setLiveVeil(false);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
