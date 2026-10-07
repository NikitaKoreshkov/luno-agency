"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPerfBudget, isCoarsePointer } from "@/lib/perf/deviceTier";
import { registerScrollTriggerScene } from "@/lib/scroll/scrollTriggerSync";
import styles from "./process-section.module.css";

/**
 * Порт Codrops "One Element Scroll" (js/index.js): одна пластина морфит
 * Flip-ом между [data-step] слотами, пока тексты шагов проезжают скроллом.
 * Flip-конфиг, clamp-границы start/end и ease '+=0.5' сняты 1:1 со
 * строк 20-47; вход яркости — со строк 121-135, но реализован opacity-вуалью
 * (см. plateVeil); пересборка на resize — строка 190. Ленис не создаём:
 * синхронизация через registerScrollTriggerScene.
 *
 * Лицо пластины — не панель, а карточка шага с рабочего стола: переход между
 * ними сделан clip-path-шторкой снизу вверх + наездом scale, потому что
 * обычный crossfade на двух фото читается как мигание.
 */

// Обложка пластины — логотип из той же серии карточек (768×1376).
const COVER_PHOTO = "/process/logo.webp";

const STEPS = [
  {
    num: "01",
    title: "Погружение и аудит",
    desc: "Изучаем ваш продукт, оцифровываем бизнес-цели и анализируем конкурентов. Находим скрытые точки роста, чтобы составить индивидуальную стратегию, а не просто скопировать чужое решение.",
    meta: "старт",
    deliver: "аудит · конкуренты · стратегия",
    photo: "/process/step-1.webp",
  },
  {
    num: "02",
    title: "Разработка стратегии и запуск",
    desc: "Проектируем воронку продаж, создаем креативы и запускаем первые кампании или инструменты. Вы получаете четкий медиаплан и прогнозируемый результат еще до старта основных бюджетов.",
    meta: "до бюджета",
    deliver: "воронка · креативы · медиаплан",
    photo: "/process/step-2.webp",
  },
  {
    num: "03",
    title: "Оптимизация и контроль",
    desc: "Подключаем сквозную аналитику и ежедневно оптимизируем показатели. Мы следим за стоимостью каждого лида и эффективностью каждого тенге, отключая то, что не работает, и масштабируя то, что приносит прибыль.",
    meta: "ежедневно",
    deliver: "аналитика · лиды · связки",
    photo: "/process/step-3.webp",
  },
  {
    num: "04",
    title: "Рост прибыли и масштабирование",
    desc: "Передаем вам прозрачные отчеты с понятными бизнес-метриками (ROI, выручка, заказы), а не просто кликами. На основе данных увеличиваем поток клиентов и помогаем вашему бизнесу системно расти.",
    meta: "каждый месяц",
    deliver: "ROI · выручка · заказы",
    photo: "/process/step-4.webp",
  },
] as const;

// index.js:20-23 + 46 — длительность 1, ease sine.inOut (первый шаг — none),
// шаг стартует с '+=' 0.5 ⇒ начала состояний: 0, 1.5, 3, 4.5.
const FLIP_DURATION = 1;
const FLIP_GAP = 0.5;
const FACE_FADE = 0.35;

/**
 * Доводка скраба: scrub:true — это 1:1 за колесом, на длинном тексте шагов
 * пластина дёргается на каждом импульсе Lenis. Число секунд, за которые
 * таймлайн догоняет скролл: на десктопе 1с (плавно, «инерция»), на таче 0.45с
 * (иначе кажется, что блок отстаёт от пальца), на среднем тире 0.7с.
 */
function getScrubSeconds(): number {
  if (isCoarsePointer()) return 0.45;
  return getPerfBudget().tier === "high" ? 1 : 0.7;
}

export default function ProcessSection() {
  // "pending" рендерится как анимированная разметика (SSR-safe, контент
  // полностью виден), useLayoutEffect ниже выбирает режим до первой отрисовки.
  const [mode, setMode] = useState<"pending" | "motion" | "static">("pending");
  const [started, setStarted] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const narrativeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLSpanElement>(null);
  const railFillRef = useRef<HTMLDivElement>(null);

  // PERF GATE: reduced motion / слабый тир — просто видимый список шагов,
  // без пина, Flip и ScrollTrigger.
  useLayoutEffect(() => {
    const budget = getPerfBudget();
    setMode(
      budget.reducedMotion || !budget.decorativeMotion ? "static" : "motion",
    );
  }, []);

  // Гейт по видимости: сцену поднимаем один раз, когда секция рядом.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Композитные подсказки (пластина, вуаль, рельс) держим живыми только пока
  // секция в кадре: иначе слои пластины с 5 фото висят на всём скролле страницы.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        el.dataset.vis = entry.isIntersecting ? "1" : "0";
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      delete el.dataset.vis;
    };
  }, []);

  // Появление текста шага и пипсы прогресса: только флаг data-on + CSS.
  // GSAP-таймлайн для появления не используем — его откатывает ctx.revert()
  // на resize, и шаг остаётся невидимым.
  useEffect(() => {
    if (mode !== "motion") return;
    const root = sectionRef.current;
    const wrap = narrativeRef.current;
    if (!root || !wrap) return;

    const rows = Array.from(
      wrap.querySelectorAll<HTMLElement>("[data-step-row]"),
    );
    const pips = new Map(
      Array.from(root.querySelectorAll<HTMLElement>("[data-pip]")).map((p) => [
        p.dataset.pip,
        p,
      ]),
    );
    const revealed = new Set<HTMLElement>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target as HTMLElement;
          const pip = pips.get(row.dataset.stepRow);
          if (pip) pip.dataset.on = entry.isIntersecting ? "1" : "0";
          if (entry.isIntersecting && !revealed.has(row)) {
            revealed.add(row);
            row.dataset.on = "1";
          }
        }
      },
      // Полоса в 10% высоты вокруг центра экрана: шаг «входит», когда его
      // середина проходит середину вьюпорта — там же, где пластина садится
      // в слот.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const row of rows) io.observe(row);
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "motion" || !started) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import("gsap")
      .then(({ default: gsap }) =>
        Promise.all([
          import("gsap/Flip"),
          import("gsap/ScrollTrigger"),
        ]).then(([{ Flip }, { default: ScrollTrigger }]) => ({
          gsap,
          Flip,
          ScrollTrigger,
        })),
      )
      .then(({ gsap, Flip, ScrollTrigger }) => {
        if (cancelled) return;
        gsap.registerPlugin(Flip, ScrollTrigger);

        const wrapEl = narrativeRef.current;
        const stageEl = stageRef.current;
        const plateEl = plateRef.current;
        const veilEl = veilRef.current;
        const railEl = railFillRef.current;
        if (!wrapEl || !stageEl || !plateEl) return;

        const scrub = getScrubSeconds();

        let ctx: { revert: () => void } | null = null;
        let resizeTimer: number | null = null;

        const build = () => {
          // index.js:16-17 — перед пересборкой всегда откатываем прошлый
          // контекст (снимает трансформы пластины и её ScrollTrigger-ы).
          ctx?.revert();
          ctx = null;

          // index.js:10 — шаги это [data-step] плейсхолдеры.
          const stepEls = Array.from(
            wrapEl.querySelectorAll<HTMLElement>("[data-step]"),
          );
          if (stepEls.length === 0) return;

          // will-change только пока живёт таймлайн (index.js:303).
          plateEl.dataset.live = "1";
          if (railEl) railEl.dataset.live = "1";

          ctx = gsap.context(() => {
            const stepPhotos = Array.from(
              plateEl.querySelectorAll<HTMLElement>("[data-plate-photo]"),
            );
            const stepCaptions = Array.from(
              plateEl.querySelectorAll<HTMLElement>("[data-plate-caption]"),
            );

            const flipConfig = {
              duration: FLIP_DURATION, // index.js:21
              ease: "sine.inOut", // index.js:22
            };
            // Общая длительность: (n-1) * (1 + 0.5) + 1. Нужна, чтобы «дыхание»
            // последнего кадра не вылезло за конец таймлайна — иначе скраб
            // сожмёт все посадки и пластина перестанет совпадать со слотами.
            const TOTAL =
              (stepEls.length - 1) * (FLIP_DURATION + FLIP_GAP) +
              FLIP_DURATION;

            // index.js:26 — состояния снимаются с каждого [data-step].
            const states = stepEls.map((stepElement) =>
              Flip.getState(stepElement),
            );

            // index.js:29-38 — trigger/endTrigger/clamp/immediateRender 1:1,
            // scrub — секунды доводки вместо 1:1 за колесом.
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: stageEl,
                start: "clamp(center center)",
                endTrigger: stepEls[stepEls.length - 1],
                end: "clamp(center center)",
                scrub,
                immediateRender: false,
                invalidateOnRefresh: true,
              },
            });

            // index.js:41-47 — Flip.fit на каждый state; у первого шага ease
            // 'none', остальные — с отступом '+=' 0.5 ⇒ времена 0/1.5/3/4.5.
            states.forEach((state, index) => {
              const at = index * (FLIP_DURATION + FLIP_GAP);
              // Типы gsap объявляют возврат Flip.fit как Tween|void|null —
              // в рантайме это всегда валидный Tween для tl.add.
              tl.add(
                Flip.fit(plateEl, state, {
                  ...flipConfig,
                  ease: index === 0 ? "none" : flipConfig.ease,
                }) as never,
                at,
              );

              // Трансформация кадра: новый раскрывается снизу вверх поверх
              // старого, начиная с лёгкого наезда (scale 1.16 → 1). Старое фото
              // не гаснет, а остаётся под новым — переход читается как
              // перелицовка, а не как fade.
              const photo = stepPhotos[index];
              if (photo) {
                tl.fromTo(
                  photo,
                  { clipPath: "inset(0 0 100% 0)", scale: 1.16 },
                  {
                    clipPath: "inset(0 0 0% 0)",
                    scale: 1,
                    duration: FLIP_DURATION,
                    ease: flipConfig.ease,
                  },
                  at,
                );
                // «Живой» кадр: пока шаг держится по центру, фото медленно
                // наезжает ещё чуть-чуть. На скрабе это дыхание, а не зум.
                const dwell = TOTAL - (at + FLIP_DURATION);
                if (dwell > 0.2) {
                  tl.to(
                    photo,
                    { scale: 1.05, duration: dwell, ease: "none" },
                    at + FLIP_DURATION,
                  );
                }
              }
              // Подпись догоняет посадку: снизу вверх, когда кадр уже открыт
              // наполовину — иначе текст идёт поверх режущегося края.
              const caption = stepCaptions[index];
              if (caption) {
                tl.fromTo(
                  caption,
                  { opacity: 0, y: 14 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: FACE_FADE + 0.15,
                    ease: flipConfig.ease,
                  },
                  at + 0.45,
                );
              }
            });

            // 1px рельс прогресса: те же clamp-границы и та же доводка, что и
            // у Flip-таймлайна, иначе полоса опережает пластину на глаз.
            if (railEl) {
              gsap.fromTo(
                railEl,
                { scaleX: 0 },
                {
                  scaleX: 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: stageEl,
                    start: "clamp(center center)",
                    endTrigger: stepEls[stepEls.length - 1],
                    end: "clamp(center center)",
                    scrub,
                    immediateRender: false,
                    invalidateOnRefresh: true,
                  },
                },
              );
            }

            // index.js:121-135 — вход первой секции из 80% яркости. Тот же
            // результат, но opacity на отдельном слое: анимация filter
            // перекрашивает весь текст пластины на каждый кадр скраба.
            if (veilEl) {
              gsap.fromTo(
                veilEl,
                { opacity: 1 },
                {
                  opacity: 0,
                  ease: "sine",
                  scrollTrigger: {
                    trigger: stageEl,
                    start: "clamp(top bottom)",
                    end: "clamp(bottom top)",
                    scrub,
                    invalidateOnRefresh: true,
                  },
                },
              );
            }
          }, wrapEl);
        };

        const rebuild = () => {
          build();
          // refresh() пересчитывает ВСЕ ScrollTrigger на странице, поэтому он
          // один на пересборку, а не на каждый тик.
          ScrollTrigger.refresh();
        };

        build();
        ScrollTrigger.refresh();

        // Слоты измеряются до того, как догрузился Unbounded: без пересборки
        // на подгрузку шрифта пластина садится с ошибкой в высоту текста.
        // Секция стартует рядом с вьюпортом, так что обычно это no-op.
        if (document.fonts && document.fonts.status !== "loaded") {
          document.fonts.ready.then(rebuild).catch(() => {});
        }

        // index.js:190 — states привязаны к layout, на resize пересобираем.
        // По «тишине» после последнего события, а не на каждое: drag-resize
        // окна иначе гоняет Flip.getState + refresh каждые 100 мс.
        const onResize = () => {
          if (resizeTimer !== null) window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            resizeTimer = null;
            rebuild();
            // До ближайшего кадра скраба пластина осталась бы в трансформе
            // от старых слотов — прокручиваем обновление сразу.
            ScrollTrigger.update();
          }, 180);
        };
        window.addEventListener("resize", onResize, { passive: true });

        // Lenis уже крутит window scroll — обновление ScrollTrigger общее на
        // всю страницу, свой инстанс не создаём.
        const releaseSync = registerScrollTriggerScene(ScrollTrigger);

        cleanup = () => {
          releaseSync();
          window.removeEventListener("resize", onResize);
          if (resizeTimer !== null) window.clearTimeout(resizeTimer);
          // Снимает Flip-таймлайн, рельс и вуаль вместе с их триггерами.
          // Пина тут нет, значит чужие позиции не смещаются и refresh() не нужен.
          ctx?.revert();
          delete plateEl.dataset.live;
          if (railEl) delete railEl.dataset.live;
        };
      })
      .catch(() => {
        // gsap не поднялся — отдаём простой видимый список, без мёртвой сцены.
        if (!cancelled) setMode("static");
      });

    return () => {
      cancelled = true;
      cleanup?.();
      cleanup = null;
    };
  }, [mode, started]);

  const isStatic = mode === "static";

  return (
    <section
      id="process"
      ref={sectionRef}
      className={styles.section}
      data-scene={mode === "motion" ? "motion" : "boot"}
      aria-labelledby="process-heading"
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <p className={styles.label}>Как мы работаем</p>
          <h2 id="process-heading" className={styles.heading}>
            <span>Четыре шага</span>
            <span>от аудита до роста</span>
          </h2>
        </div>

        {isStatic ? (
          <ol className={styles.list}>
            {STEPS.map((step) => (
              <li key={step.num} className={styles.listItem}>
                <span className={`${styles.listPlate} luno-panel`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.platePhoto}
                    src={step.photo}
                    alt=""
                    width={768}
                    height={1376}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <div className={styles.listBody}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.narrative} ref={narrativeRef}>
            <div className={styles.rail} aria-hidden>
              <div className={styles.railFill} ref={railFillRef} />
              {STEPS.map((step, i) => (
                <span
                  key={step.num}
                  className={styles.railPip}
                  data-pip={i + 1}
                  data-on="0"
                />
              ))}
            </div>

            <div className={styles.stage} ref={stageRef}>
              <div
                ref={plateRef}
                className={`${styles.plate} luno-panel`}
                aria-hidden
              >
                <div className={styles.plateFace}>
                  {/* Обложка пластины — та же серия карточек с рабочего стола:
                      логотип на лунном фоне. Под шагами, открытыми снизу вверх. */}
                  <div className={styles.plateBrand}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.platePhoto}
                      src={COVER_PHOTO}
                      alt="LUNO"
                      width={768}
                      height={1376}
                      decoding="async"
                    />
                    <div className={styles.plateCaption}>
                      <div className={styles.plateTop}>
                        {/* Словесный знак уже встроен в кадр — текстом его не
                            дублируем, остаётся только подпись и точки шагов. */}
                        <span className={styles.plateStepMeta}>процесс</span>
                        <span className={styles.plateBrandDots} aria-hidden>
                          {STEPS.map((step) => (
                            <i key={step.num} />
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>
                  {STEPS.map((step) => (
                    <div key={step.num} className={styles.plateStep}>
                      {/* Карточка шага: заголовок встроен в картинку, поэтому
                          alt пустой — те же слова стоят <h3> рядом со слотом,
                          иначе скринридер читает их дважды. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.platePhoto}
                        data-plate-photo
                        src={step.photo}
                        alt=""
                        width={768}
                        height={1376}
                        decoding="async"
                      />
                      <div className={styles.plateCaption} data-plate-caption>
                        <div className={styles.plateTop}>
                          <span className={styles.plateStepNum}>{step.num}</span>
                          <span className={styles.plateStepMeta}>
                            {step.meta}
                          </span>
                        </div>
                        <span className={styles.plateStepDeliver}>
                          {step.deliver}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Вход из 80% яркости (index.js:121-135) — слой с opacity,
                    а не анимация filter: второй перекрашивает текст пластины
                    на каждый кадр доводки. */}
                <span className={styles.plateVeil} ref={veilRef} />
              </div>
            </div>

            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={styles.step}
                data-slot={i + 1}
                data-step-row={i + 1}
                data-on="0"
              >
                <div className={styles.stepSlot} data-step aria-hidden />
                <div className={styles.stepBody}>
                  <span className={styles.stepNum}>{step.num}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
