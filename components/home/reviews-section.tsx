"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useCarouselDrag } from "@/lib/use-carousel-drag";
import styles from "./reviews-section.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
const AUTOPLAY_MS = 5200;

const REVIEWS = [
  {
    name: "Айдана Б.",
    role: "Владелица кафе «Алатау»",
    tag: "Ресторан",
    initial: "А",
    stars: 5,
    text: "До Enter я вообще не верила в соцсети как в канал продаж. За 3 месяца Instagram реально приносит бронирования каждый день.",
  },
  {
    name: "Алексей М.",
    role: "Директор Dent-Pro",
    tag: "Медицина",
    initial: "А",
    stars: 5,
    text: "Снизили стоимость заявки с 5 200₸ до 780₸ за два месяца. Прозрачная аналитика, понятные отчёты, никакой воды.",
  },
  {
    name: "Жанна К.",
    role: "Управляющая PrimeFit",
    tag: "Фитнес",
    initial: "Ж",
    stars: 5,
    text: "Пришли с нулём в онлайне. За 45 дней 112 заявок. Группы заполнены на 3 месяца вперёд.",
  },
  {
    name: "Марат Д.",
    role: "Владелец KazMall",
    tag: "E-commerce",
    initial: "М",
    stars: 5,
    text: "ROAS вырос с 1.2 до 4.6. Ребята думают про всю воронку — от первого касания до повторной покупки.",
  },
  {
    name: "Сабина Р.",
    role: "Владелица студии Brow Lab",
    tag: "Красота",
    initial: "С",
    stars: 5,
    text: "Профиль, который реально отличается от сотен других бьюти-аккаунтов. Запись заполнена на 3 недели.",
  },
  {
    name: "Ернур А.",
    role: "Ресторатор, сеть Nomad Diner",
    tag: "Ресторан",
    initial: "Е",
    stars: 5,
    text: "Охваты, узнаваемость, трафик в зал — плюс нормальная система аналитики. Знаю, сколько стоит гость из Instagram.",
  },
  {
    name: "Динара С.",
    role: "Основатель Lumière Home",
    tag: "E-commerce",
    initial: "Д",
    stars: 5,
    text: "Запустили Reels и таргет — продажи выросли в 2.4 раза за первый квартал. Команда на связи каждый день.",
  },
  {
    name: "Тимур Н.",
    role: "CEO AutoLux KZ",
    tag: "Авто",
    initial: "Т",
    stars: 5,
    text: "Лиды из Instagram стали предсказуемыми. Видим воронку целиком и понимаем, куда уходит каждый тенге.",
  },
  {
    name: "Аружан П.",
    role: "Основатель Silk Room",
    tag: "Красота",
    initial: "А",
    stars: 5,
    text: "Контент стал выглядеть дорого — и клиенты это чувствуют. Средний чек вырос, потому что доверие появилось ещё до визита.",
  },
  {
    name: "Бекзат О.",
    role: "Директор StroyLine",
    tag: "Строительство",
    initial: "Б",
    stars: 5,
    text: "Нужны были заявки, а не лайки. Получили стабильный поток обращений из таргета уже в первый месяц работы.",
  },
  {
    name: "Карина Л.",
    role: "Школа английского SpeakUp",
    tag: "Образование",
    initial: "К",
    stars: 5,
    text: "Заполнили группы на летний сезон за 6 недель. Креативы тестируют быстро, сливов бюджета почти нет.",
  },
  {
    name: "Нурлан К.",
    role: "Основатель TechFlow",
    tag: "IT",
    initial: "Н",
    stars: 5,
    text: "Помогли упаковать продукт для B2B: сайт, презентации, LinkedIn. Первые enterprise-лиды пришли через 3 недели.",
  },
  {
    name: "Мадина Т.",
    role: "Бутик AURA",
    tag: "Fashion",
    initial: "М",
    stars: 5,
    text: "Stories и Reels наконец начали продавать, а не просто красиво выглядеть. Онлайн-заказы выросли в 3 раза.",
  },
  {
    name: "Арман Ж.",
    role: "Клиника VitaDent",
    tag: "Медицина",
    initial: "А",
    stars: 5,
    text: "Аккуратно работают с медицинской тематикой — без банов и стрёмных обещаний. Запись на консультации стабильная.",
  },
  {
    name: "Дана Е.",
    role: "Основатель NutriBox",
    tag: "E-commerce",
    initial: "Д",
    stars: 5,
    text: "Подняли CTR рекламы и снизили CPA. Наконец понятно, какие связки масштабировать, а какие отключать.",
  },
] as const;

type Review = (typeof REVIEWS)[number];

const ROW_DIRECTIONS = ["down", "up", "down", "up", "down"] as const;
const ROW_INTERACTIVE = [false, true, true, true, false] as const;
const ITEMS_PER_ROW = 8;

function getRowReviews(rowIndex: number): Review[] {
  const items: Review[] = [];

  for (let i = 0; i < ITEMS_PER_ROW; i++) {
    items.push(REVIEWS[(rowIndex * 3 + i) % REVIEWS.length]);
  }

  return items;
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className={styles.card}>
      <div className={styles.stars} aria-label={`${review.stars} звёзд`}>
        {Array.from({ length: review.stars }).map((_, j) => (
          <span key={j} className={styles.star} aria-hidden>
            ★
          </span>
        ))}
      </div>

      <p className={styles.quote}>{review.text}</p>

      <div className={styles.author}>
        <div className={styles.avatar} aria-hidden>
          {review.initial}
        </div>
        <div className={styles.authorInfo}>
          <span className={styles.authorName}>{review.name}</span>
          <span className={styles.authorRole}>{review.role}</span>
        </div>
      </div>

      <span className={styles.tag}>{review.tag}</span>
    </article>
  );
}

function ReviewTrack({
  direction,
  rowIndex,
}: {
  direction: "down" | "up";
  rowIndex: number;
}) {
  const items = getRowReviews(rowIndex);
  const loop = [...items, ...items];

  return (
    <div
      className={`${styles.track} ${
        direction === "down" ? styles.trackDown : styles.trackUp
      }`}
      style={{ animationDuration: `${36 + rowIndex * 5}s` }}
    >
      {loop.map((review, i) => (
        <ReviewCard key={`${rowIndex}-${review.name}-${i}`} review={review} />
      ))}
    </div>
  );
}

function useMobileCarousel() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return enabled;
}

function ReviewsCarousel() {
  const count = REVIEWS.length;
  const reduceMotion = useReducedMotion();
  const enabled = useMobileCarousel();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const trackIndexRef = useRef(count);
  const queuedDeltaRef = useRef<number | null>(null);
  const [trackIndex, setTrackIndex] = useState(count);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [scrollbarInstant, setScrollbarInstant] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);

  const canLoop = count > 1;
  const loopItems = canLoop ? [...REVIEWS, ...REVIEWS, ...REVIEWS] : [...REVIEWS];
  const midStart = count;
  const midEnd = count * 2;
  trackIndexRef.current = trackIndex;

  const displayIndex = ((trackIndex % count) + count) % count;

  const snapIntoMiddle = useCallback(
    (index: number) => {
      if (!canLoop) return index;
      let next = index;
      while (next >= midEnd) next -= count;
      while (next < midStart) next += count;
      return next;
    },
    [canLoop, count, midEnd, midStart],
  );

  const commitMove = useCallback(
    (delta: number) => {
      if (!canLoop || delta === 0) return;

      const current = trackIndexRef.current;
      const base = snapIntoMiddle(current);

      if (base !== current) {
        queuedDeltaRef.current = delta;
        setTransitionEnabled(false);
        setScrollbarInstant(true);
        setTrackIndex(base);
        trackIndexRef.current = base;
        return;
      }

      queuedDeltaRef.current = null;
      setTransitionEnabled(true);
      const next = current + delta;
      trackIndexRef.current = next;
      setTrackIndex(next);
    },
    [canLoop, snapIntoMiddle],
  );

  const { dragX, dragging, bind } = useCarouselDrag(commitMove);

  useEffect(() => {
    if (dragging) setPaused(true);
    else setPaused(false);
  }, [dragging]);

  useLayoutEffect(() => {
    const queued = queuedDeltaRef.current;
    if (queued === null || transitionEnabled) return;

    queuedDeltaRef.current = null;
    trackRef.current?.getBoundingClientRect();

    setTransitionEnabled(true);
    const next = trackIndexRef.current + queued;
    trackIndexRef.current = next;
    setTrackIndex(next);
  }, [trackIndex, transitionEnabled]);

  const goToLogical = useCallback(
    (logical: number) => {
      const target = ((logical % count) + count) % count;
      const current = trackIndexRef.current;
      const curLogical = ((current % count) + count) % count;
      let delta = ((target - curLogical) % count + count) % count;
      if (delta > count / 2) delta -= count;
      if (delta === 0) return;
      commitMove(delta);
    },
    [commitMove, count],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !canLoop) return;

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== track || event.propertyName !== "transform") return;
      if (queuedDeltaRef.current !== null) return;

      const current = trackIndexRef.current;
      const snapped = snapIntoMiddle(current);
      if (snapped === current) return;

      setTransitionEnabled(false);
      setScrollbarInstant(true);
      trackIndexRef.current = snapped;
      setTrackIndex(snapped);
    };

    track.addEventListener("transitionend", handleTransitionEnd);
    return () => track.removeEventListener("transitionend", handleTransitionEnd);
  }, [canLoop, snapIntoMiddle]);

  useEffect(() => {
    if (transitionEnabled || queuedDeltaRef.current !== null) return;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionEnabled(true);
        setScrollbarInstant(false);
      });
    });

    return () => cancelAnimationFrame(id);
  }, [transitionEnabled, trackIndex]);

  useEffect(() => {
    if (!scrollbarInstant) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setScrollbarInstant(false));
    });
    return () => cancelAnimationFrame(id);
  }, [displayIndex, scrollbarInstant]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.2),
      { threshold: [0, 0.2, 0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled || reduceMotion || paused || !inView || !canLoop) return;

    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      if (now - started >= AUTOPLAY_MS) {
        commitMove(1);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [canLoop, commitMove, enabled, inView, paused, reduceMotion, trackIndex]);

  const displayCurrent = String(displayIndex + 1).padStart(2, "0");
  const displayTotal = String(count).padStart(2, "0");
  const thumbWidth = 100 / count;

  return (
    <div
      ref={rootRef}
      className={styles.carousel}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div
        className={`${styles.carouselViewport}${dragging ? ` ${styles.carouselDragging}` : ""}`}
        {...bind}
      >
        <div
          ref={trackRef}
          className={`${styles.carouselTrack}${
            dragging || !transitionEnabled || reduceMotion ? ` ${styles.carouselTrackInstant}` : ""
          }${(inView && !reduceMotion) || dragging ? ` ${styles.carouselTrackLive}` : ""}`}
          style={{
            transform: `translate3d(calc(${-trackIndex} * (var(--slide-size) + var(--carousel-gap)) + ${dragX}px), 0, 0)`,
          }}
        >
          {loopItems.map((review, index) => (
            <div className={styles.slide} key={`${review.name}-${index}`}>
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.scrollbar}>
        <span className={styles.scrollIndex}>{displayCurrent}</span>
        <button
          type="button"
          className={styles.scrollTrack}
          aria-label="Перейти к отзыву"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            goToLogical(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
          }}
        >
          <span
            className={`${styles.scrollFill} ${
              scrollbarInstant ? styles.scrollFillInstant : ""
            }`}
            style={{
              width: `${thumbWidth}%`,
              left: `${displayIndex * thumbWidth}%`,
            }}
          />
        </button>
        <span className={styles.scrollIndex}>{displayTotal}</span>
      </div>
    </div>
  );
}

export function ReviewsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Пауза, а не анмаунт треков: transform и позиция скролла сохраняются.
    const observer = new IntersectionObserver(
      ([entry]) => {
        node.dataset.marqueeRunning = entry.isIntersecting ? "true" : "false";
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="reviews"
      className={styles.section}
      ref={ref}
      data-marquee-running="false"
    >
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease }}
        >
          <p className={styles.label}>Отзывы клиентов</p>
          <h2 className={styles.heading}>Говорят наши клиенты</h2>
        </motion.div>
        <ReviewsCarousel />
      </div>

      <div className={styles.marqueeShell}>
        <div className={styles.rows}>
          {ROW_DIRECTIONS.map((direction, rowIndex) => (
            <div
              key={`${direction}-${rowIndex}`}
              className={`${styles.row} ${
                ROW_INTERACTIVE[rowIndex]
                  ? styles.rowInteractive
                  : styles.rowEdge
              }`}
            >
              <ReviewTrack direction={direction} rowIndex={rowIndex} />
            </div>
          ))}
        </div>

        <div className={styles.fadeTop} aria-hidden />
        <div className={styles.fadeBottom} aria-hidden />
        <div className={styles.fadeLeft} aria-hidden />
        <div className={styles.fadeRight} aria-hidden />
      </div>
    </section>
  );
}
