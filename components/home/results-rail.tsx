"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPerfBudget } from "@/lib/perf/deviceTier";
import { registerScrollTriggerScene } from "@/lib/scroll/scrollTriggerSync";
import styles from "./results-rail.module.css";

/**
 * Порт creativoma/lenis-gsap-lab → components/PracticeAreas.jsx:66-80:
 * пин секции + трек, уезжающий по x на -(scrollWidth - clientWidth);
 * ease 'none', anticipatePin 1, invalidateOnRefresh и function-based end — 1:1.
 * Отличия от референса: заголовок вынесен над рельсой и собирается как в
 * остальных секциях (.head + .label + .heading с маской строки), карточки
 * смотрят на зрителя (плоские), появление — по флагу data-in + CSS, въезд и
 * выезд гасят градиентные шторки .rail, а не пофреймовые твины на карточку.
 */

export type RailCase = {
  client: string;
  niche: string;
  what: string;
  duration: string;
  beforeDisplay: string;
  beforeLabel: string;
  afterNum: number;
  afterSuffix: string;
  afterLabel: string;
  image: string;
};

const HEADING_LINES = ["До и после", "в цифрах"] as const;
const COUNT_MS = 1100;

/** 1650 → «1 650», 74 → «74». Дробные дописаны в afterSuffix. */
function formatCount(n: number): string {
  return n >= 1000 ? n.toLocaleString("ru-RU") : String(n);
}

export function ResultsRail({ items }: { items: readonly RailCase[] }) {
  // "swipe" — нативная горизонтальная прокрутка (слабый тир, reduced motion);
  // "rail" — пин + translateX по вертикальному скроллу.
  const [mode, setMode] = useState<"pending" | "rail" | "swipe">("pending");
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const budget = getPerfBudget();
    // Пин + горизонталь по вертикальному скроллу — на всех ширинах и на таче:
    // свайп-фолбэк ощущался как «обычный блок пролистывается».
    setMode(
      budget.reducedMotion || !budget.decorativeMotion || budget.tier === "low"
        ? "swipe"
        : "rail",
    );
  }, []);

  // Появление заголовка и карточек: флаг + CSS (IO ловит и горизонтальный въезд).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-in]"));
    if (mode === "rail") {
      // В рельсе карточки изначально за правым краем вьюпорта.
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).dataset.in = "1";
              observer.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px 0px -8%" },
      );
      for (const el of targets) observer.observe(el);
      return () => observer.disconnect();
    }
    for (const el of targets) el.dataset.in = "1";
  }, [mode]);

  // Count-up числа «после»: один rAF на карточку, без GSAP-таймлайнов.
  useEffect(() => {
    if (mode === "pending") return;
    const budget = getPerfBudget();
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    if (budget.reducedMotion || !budget.decorativeMotion) return;

    const frames = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (!entry.isIntersecting || frames.has(el)) continue;
          observer.unobserve(el);
          const target = Number(el.dataset.count);
          const suffix = el.dataset.suffix ?? "";
          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / COUNT_MS);
            // easeOutQuart: длинный хвост, цифра не впрыгивает в конец.
            const eased = 1 - Math.pow(1 - t, 4);
            el.textContent = `${formatCount(Math.round(target * eased))}${suffix}`;
            if (t < 1) frames.set(el, requestAnimationFrame(step));
            else frames.delete(el);
          };
          frames.set(el, requestAnimationFrame(step));
        }
      },
      { rootMargin: "0px 0px 0px -8%" },
    );
    for (const node of nodes) observer.observe(node);
    const captured = frames;
    return () => {
      observer.disconnect();
      for (const id of captured.values()) cancelAnimationFrame(id);
      captured.clear();
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "rail") return;
    const root = rootRef.current;
    const rail = railRef.current;
    const track = trackRef.current;
    if (!root || !rail || !track) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import("gsap")
      .then(({ default: gsap }) =>
        import("gsap/ScrollTrigger").then(({ default: ScrollTrigger }) => ({
          gsap,
          ScrollTrigger,
        })),
      )
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        // Дублирующий пин на том же элементе — единственный способ получить
        // «лента улетела и висит над соседними секциями»: старый pin-spacer
        // оставляет в документе дыру на весь ход рельса, и новый пин
        // приподнимает ленту на две секции раньше срока. Возникает при
        // повторном монтировании сцены (Fast Refresh в dev, remount родителя),
        // поэтому снимаем все триггеры на этом элементе до создания своих.
        for (const stale of ScrollTrigger.getAll()) {
          if (stale.trigger === root || stale.pin === root) stale.kill(true);
        }

        // PracticeAreas.jsx:66 — расстояние считаем каждый раз заново.
        // Ход рельса = расстояние между левыми краями первой и последней
        // карточки. Отступ трека сдвигает обе одинаково, поэтому в ход не
        // входит: его можно читать чистым getBoundingClientRect, без записи.
        // Это принципиально — запись layout внутри function-based значений
        // попадала ровно в середину refresh-прохода GSAP (revert → замер всех
        // триггеров), и окно пина считалось от сдвинутого состояния.
        const distance = () => {
          const first = track.firstElementChild as HTMLElement | null;
          const last = track.lastElementChild as HTMLElement | null;
          if (!first || !last) return 0;
          return Math.max(
            0,
            Math.round(
              last.getBoundingClientRect().left -
                first.getBoundingClientRect().left,
            ),
          );
        };

        // Правило bookend: первая и последняя карточка стоят в одной и той же
        // точке рельса. На широком экране это левый край заголовка (карточка
        // «под заголовком»), на телефоне, где карточка занимает больше половины
        // полосы, — точный центр. Первую туда ставит padding трека, вторую —
        // длина хода: левый край последней карточки в конце = тот же inset.
        const applyInset = () => {
          const last = track.lastElementChild as HTMLElement | null;
          if (!last) return;
          const railW = rail.clientWidth;
          const cardW = last.getBoundingClientRect().width;
          let inset: number;
          if (cardW > railW * 0.55) {
            inset = (railW - cardW) / 2;
          } else {
            inset = 0;
            const heading = headingRef.current;
            if (heading) {
              const railLeft = rail.getBoundingClientRect().left;
              let lineLeft = Infinity;
              for (const line of Array.from(heading.children) as HTMLElement[]) {
                lineLeft = Math.min(lineLeft, line.getBoundingClientRect().left);
              }
              if (Number.isFinite(lineLeft)) {
                inset = Math.max(0, lineLeft - railLeft);
              }
            }
            inset = Math.min(inset, railW * 0.45);
          }
          track.style.paddingInlineStart = `${Math.round(inset)}px`;
        };

        let dist = 0;
        // Единственный проход, где пишем layout: до того, как GSAP начал
        // измерять. ScrollTrigger.dispatchEvent("refreshInit") стоит в начале
        // _refreshAll, то есть до revert'а и до замера триггеров.
        const remeasure = () => {
          applyInset();
          dist = distance();
        };
        remeasure();
        if (dist <= 8) return; // трек уже вьюпорта — пин не нужен

        const ctx = gsap.context(() => {
          gsap.to(track, {
            x: () => -dist, // PracticeAreas.jsx:69
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: () => `+=${dist}`,
              // scrub > 1 = инерция: трек доезжает до позиции скролла плавно,
              // а не дергается за каждым событием колеса/кадром Lenis.
              scrub: 1.1,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              // После resize GSAP фиксирует ширину ленты уже новым значением,
              // а inset в refreshInit считался от старой — доводим якорь.
              // Padding не входит в ход, поэтому обратной связи нет.
              onRefresh: () => applyInset(),
              // Слой композита (~2400x470 css px на retina) нужен только пока
              // идёт пин. Класс ставим императивно: setState отсюда дал бы
              // ре-рендер React посреди scroll/refresh прохода GSAP.
              onToggle: (self) =>
                track.classList.toggle(styles.trackLive, self.isActive),
            },
          });

          if (barRef.current) {
            gsap.fromTo(
              barRef.current,
              { scaleX: 0 },
              {
                scaleX: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: root,
                  start: "top top",
                  end: () => `+=${dist}`,
                  scrub: 1.1,
                  invalidateOnRefresh: true,
                },
              },
            );
          }
        }, root);

        // Гидрация и догрузка картинок поднимают документ с 2703 до 12242 px,
        // и абсолютный якорь ленты уезжает на тысячи px (замер: top 873 → 6479).
        // ScrollTrigger пересчитывает окно пина только внутри refresh(), а
        // refresh после resize он откладывает до scrollEnd — при быстром
        // скролле тот не наступает, и лента остаётся запиненной по устаревшим
        // координатам, пока соседние секции едут под ней. Поэтому сверяем
        // якорь сами и обновляемся, не дожидаясь остановки прокрутки.
        // Якорь берём от pin-spacer'а: у запиненного элемента rect.top всегда
        // 0, и проверка дёргала бы refresh на каждый кадр.
        const anchorEl = () => {
          const spacer = root.parentElement;
          return spacer && spacer.classList.contains("pin-spacer") ? spacer : root;
        };
        let anchor = Math.round(
          anchorEl().getBoundingClientRect().top + window.scrollY,
        );
        let timer: number | null = null;
        // Статический флаг GSAP, в типах его нет.
        const st = ScrollTrigger as unknown as { isRefreshing: boolean };
        const checkAnchor = () => {
          if (st.isRefreshing) return;
          const next = Math.round(
            anchorEl().getBoundingClientRect().top + window.scrollY,
          );
          if (Math.abs(next - anchor) <= 4) return;
          anchor = next;
          if (timer !== null) return; // пересборка уже назначена
          timer = window.setTimeout(() => {
            timer = null;
            ScrollTrigger.refresh();
          }, 120);
        };
        if (!window.__lunoScrollHooks) window.__lunoScrollHooks = new Set();
        window.__lunoScrollHooks.add(checkAnchor);

        const releaseSync = registerScrollTriggerScene(ScrollTrigger);
        ScrollTrigger.addEventListener("refreshInit", remeasure);
        ScrollTrigger.refresh();

        cleanup = () => {
          window.__lunoScrollHooks?.delete(checkAnchor);
          if (timer !== null) window.clearTimeout(timer);
          ScrollTrigger.removeEventListener("refreshInit", remeasure);
          releaseSync();
          track.classList.remove(styles.trackLive);
          ctx.revert(); // снимает и пин, и spacer
          ScrollTrigger.refresh();
        };
      })
      .catch(() => {
        if (!cancelled) setMode("swipe");
      });

    return () => {
      cancelled = true;
      cleanup?.();
      cleanup = null;
    };
  }, [mode]);

  const isRail = mode === "rail";

  const head = (
    <div className={styles.head} data-in="0">
      <p className={styles.label}>Результаты</p>
      <h2 className={styles.heading} ref={headingRef}>
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
      <p className={styles.hint}>{isRail ? "Скроль дальше →" : "Тяни вбок →"}</p>
    </div>
  );

  const foot = (
    <div className={styles.foot}>
      <a href="/cases" className={styles.more}>
        Все кейсы
      </a>
    </div>
  );

  return (
    <section
      id="results"
      ref={rootRef}
      className={isRail ? styles.band : styles.bandSwipe}
      aria-label="Результаты до и после"
    >
      {head}
      {isRail ? (
        <>
          <div className={styles.rail} ref={railRef}>
            <div className={styles.track} ref={trackRef}>
              {items.map((c, i) => (
                <RailCard key={c.client} c={c} index={i} />
              ))}
            </div>
          </div>
          {foot}
          <span className={styles.progress} aria-hidden>
            <span className={styles.progressFill} ref={barRef} />
          </span>
        </>
      ) : (
        <>
          <div className={styles.swipe}>
            {items.map((c, i) => (
              <RailCard key={c.client} c={c} index={i} />
            ))}
          </div>
          {foot}
        </>
      )}
    </section>
  );
}

function RailCard({ c, index }: { c: RailCase; index: number }) {
  return (
    <article
      className={styles.card}
      data-in="0"
      style={{ transitionDelay: `${Math.min(index, 5) * 70}ms` }}
    >
      <div className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image} alt={c.client} loading="lazy" decoding="async" />
      </div>
      <div className={styles.cardTop}>
        <span className={styles.num}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.niche}>{c.niche}</span>
      </div>
      <h3 className={styles.client}>{c.client}</h3>
      <p className={styles.what}>{c.what}</p>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>до</span>
          <span className={styles.metricBefore}>{c.beforeDisplay}</span>
          <span className={styles.metricSub}>{c.beforeLabel}</span>
        </div>
        <span className={styles.arrow} aria-hidden>
          →
        </span>
        <div className={styles.metric}>
          <span className={`${styles.metricLabel} ${styles.metricLabelOn}`}>
            после
          </span>
          <span
            className={styles.metricAfter}
            data-count={c.afterNum}
            data-suffix={c.afterSuffix}
          >
            {formatCount(c.afterNum)}
            {c.afterSuffix}
          </span>
          <span className={styles.metricSub}>{c.afterLabel}</span>
        </div>
      </div>
      <span className={styles.duration}>{c.duration}</span>
    </article>
  );
}
