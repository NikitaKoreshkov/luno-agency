"use client";

import { useEffect, useRef } from "react";
import { getPerfBudget } from "@/lib/perf/deviceTier";
import { registerScrollTriggerScene } from "@/lib/scroll/scrollTriggerSync";
import styles from "./manifesto-section.module.css";

/**
 * Полноширинный манифест-полоса: 1:1 порт Codrops ScrollBlurTypography,
 * effect-1 (js/effect-1/blurScrollEffect.js:37-50) — посимвольный
 * blur(10px) brightness(0%) → blur(0px) brightness(100%), ease 'none',
 * stagger 0.05, scrub true, start 'top bottom-=15%', end 'bottom center+=15%'.
 * Подстрока — более дешёвый вариант из той же семьи (effect-2,
 * js/effect-2/blurScrollEffect.js:38: blur(10px) brightness(30%)),
 * анимируются слова, не символы.
 *
 * split-type в проекте не установлен — слова/символы режутся здесь при
 * монтировании (полное предложение всегда живёт в SSR-разметке; при отказе
 * JS текст остаётся видимым). Перф-гейт: на low-тире или без
 * decorativeMotion — слова + opacity/translateY; при reducedMotion — статика.
 */

// blurScrollEffect.js:46-47 — диапазон скраба 1:1 из референса.
const SCRUB_START = "top bottom-=15%";
const SCRUB_END = "bottom center+=15%";
// blurScrollEffect.js:43 — stagger между стартами юнитов.
const UNIT_STAGGER = 0.05;

const STATEMENT_1 = "Мы не делаем красиво";
const STATEMENT_2 = "Мы делаем так чтобы окупалось";
const SUBLINE =
  "Реклама продакшн и продукты одна команда один результат";

type SplitUnits = { words: HTMLElement[]; chars: HTMLElement[] };

export default function ManifestoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const budget = getPerfBudget();
    // Правила перф-гейта: reducedMotion → статика (текст виден без анимаций),
    // low-тир или !decorativeMotion → слова + opacity/translateY (без filter).
    if (budget.reducedMotion) return;
    const cheapWords = budget.tier === "low" || !budget.decorativeMotion;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import("gsap").then(({ default: gsap }) => {
      import("gsap/ScrollTrigger").then(({ default: ScrollTrigger }) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        const sectionEl = sectionRef.current;
        const statementEl = statementRef.current;
        const subEl = subRef.current;
        if (!sectionEl || !statementEl || !subEl) return;

        const lineEls = Array.from(
          statementEl.querySelectorAll<HTMLElement>("[data-line]"),
        );

        // ── Собственный сплитер (аналог SplitType 'words, chars', textSplitter.js:32).
        // Оригинальный текст держим в Map — на нём же SSR-разметка.
        const originals = new WeakMap<HTMLElement, string>();

        const splitElement = (
          el: HTMLElement,
          toChars: boolean,
        ): SplitUnits => {
          const original = originals.get(el) ?? el.textContent ?? "";
          originals.set(el, original);
          el.textContent = "";
          const words: HTMLElement[] = [];
          const chars: HTMLElement[] = [];
          for (const token of original.split(/(\s+)/)) {
            if (!token) continue;
            if (/^\s+$/.test(token)) {
              el.appendChild(document.createTextNode(token));
              continue;
            }
            const word = document.createElement("span");
            word.className = styles.word;
            if (toChars) {
              for (const ch of Array.from(token)) {
                const char = document.createElement("span");
                char.className = styles.char;
                char.textContent = ch;
                word.appendChild(char);
                chars.push(char);
              }
            } else {
              word.textContent = token;
            }
            el.appendChild(word);
            words.push(word);
          }
          return { words, chars };
        };

        const unsplitElement = (el: HTMLElement) => {
          const original = originals.get(el);
          if (typeof original === "string") el.textContent = original;
        };

        let ctx: ReturnType<typeof gsap.context> | null = null;
        let triggers: ScrollTrigger[] = [];
        let splitEls: HTMLElement[] = [];

        const disposeScene = () => {
          ctx?.revert();
          ctx = null;
          triggers = [];
        };

        // Композитный слой под blur/transform нужен только пока секция в кадре.
        // Без этого гейта will-change вешался на все символы сразу при сборке
        // сцены: 54 слоя висело, когда манифест стоял в 5600 px ниже экрана.
        let units: HTMLElement[] = [];
        let willDropped = false;
        const applyWillChange = (on: boolean) => {
          const value = cheapWords ? "opacity, transform" : "filter";
          if (on) willDropped = false;
          for (const el of units) el.style.willChange = on ? value : "auto";
        };

        const build = () => {
          disposeScene();
          const triggersBefore = ScrollTrigger.getAll().length;

          if (cheapWords) {
            // Дешёвый путь: только слова, opacity + translateY, без filter.
            const statementWords: HTMLElement[] = [];
            for (const line of lineEls) {
              const units = splitElement(line, false);
              statementWords.push(...units.words);
            }
            const subUnits = splitElement(subEl, false);
            splitEls = [...lineEls, subEl];
            units = [...statementWords, ...subUnits.words];

            ctx = gsap.context(() => {
              gsap.fromTo(
                statementWords,
                { opacity: 0, y: 24 },
                {
                  ease: "none",
                  opacity: 1,
                  y: 0,
                  stagger: UNIT_STAGGER,
                  scrollTrigger: {
                    trigger: statementEl,
                    start: SCRUB_START,
                    end: SCRUB_END,
                    scrub: true,
                  },
                },
              );
              gsap.fromTo(
                subUnits.words,
                { opacity: 0, y: 16 },
                {
                  ease: "none",
                  opacity: 1,
                  y: 0,
                  stagger: UNIT_STAGGER,
                  scrollTrigger: {
                    trigger: subEl,
                    start: SCRUB_START,
                    end: SCRUB_END,
                    scrub: true,
                  },
                },
              );
            }, sectionEl);
          } else {
            // Полный порт effect-1 (blurScrollEffect.js:37-50): символы + filter.
            const statementChars: HTMLElement[] = [];
            for (const line of lineEls) {
              const units = splitElement(line, true);
              statementChars.push(...units.chars);
            }
            const subWords = splitElement(subEl, false).words;
            splitEls = [...lineEls, subEl];
            units = [...statementChars, ...subWords];

            const dropWillChange = (self: { progress: number }) => {
              if (willDropped || self.progress < 1) return;
              willDropped = true;
              applyWillChange(false);
            };

            ctx = gsap.context(() => {
              // blurScrollEffect.js:38-39 — from: blur(10px) brightness(0%).
              // blurScrollEffect.js:42 — to: blur(0px) brightness(100%).
              gsap.fromTo(
                statementChars,
                { filter: "blur(10px) brightness(0%)" },
                {
                  ease: "none", // blurScrollEffect.js:41
                  filter: "blur(0px) brightness(100%)",
                  stagger: UNIT_STAGGER, // blurScrollEffect.js:43
                  scrollTrigger: {
                    trigger: statementEl,
                    start: SCRUB_START,
                    end: SCRUB_END,
                    scrub: true, // blurScrollEffect.js:48
                    onUpdate: dropWillChange,
                  },
                },
              );
              // Подстрока — effect-2 (blurScrollEffect.js:38): brightness(30%),
              // на словах вместо символов — заметно дешевле при том же виде.
              gsap.fromTo(
                subWords,
                { filter: "blur(10px) brightness(30%)" },
                {
                  ease: "none",
                  filter: "blur(0px) brightness(100%)",
                  stagger: UNIT_STAGGER,
                  scrollTrigger: {
                    trigger: subEl,
                    start: SCRUB_START,
                    end: SCRUB_END,
                    scrub: true,
                    onUpdate: dropWillChange,
                  },
                },
              );
            }, sectionEl);
          }

          // Собираем ScrollTrigger, созданные этой сценой (гейт по видимости).
          triggers = ScrollTrigger.getAll().slice(triggersBefore);
        };

        build();

        // ── Гейт по видимости: enable/disable, никогда не паузим в скролле.
        // lastVisible помнит состояние, чтобы пересборка на resize не оставила
        // свежие триггеры выключенными, если секция уже в кадре.
        let lastVisible = false;
        const setEnabled = (enabled: boolean) => {
          for (const st of triggers) {
            if (enabled) st.enable();
            else st.disable();
          }
          applyWillChange(enabled);
        };
        const observer = new IntersectionObserver(
          (entries) => {
            lastVisible = entries[entries.length - 1]?.isIntersecting ?? false;
            setEnabled(lastVisible);
          },
          { rootMargin: "200px 0px" },
        );
        // Пока секция далеко — триггеры выключены; from-поза (blur/opacity)
        // уже зафиксирована immediateRender у fromTo.
        setEnabled(false);
        observer.observe(sectionEl);

        // ── Lenis уже крутит window scroll: синхронизируемся через seam.
        const releaseSync = registerScrollTriggerScene(ScrollTrigger);

        // ── Resize: пересплит + пересборка, как TextSplitter.js:41-60
        // (ResizeObserver + debounce 100ms, только если ширина изменилась).
        let previousContainerWidth: number | null = null;
        let resizeTimer: number | null = null;
        const resizeObserver = new ResizeObserver((entries) => {
          const width = Math.floor(entries[0]?.contentRect.width ?? 0);
          if (resizeTimer !== null) window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            resizeTimer = null;
            if (
              previousContainerWidth !== null &&
              previousContainerWidth !== width
            ) {
              for (const el of splitEls) unsplitElement(el);
              build();
              setEnabled(lastVisible);
              ScrollTrigger.refresh();
            }
            previousContainerWidth = width;
          }, 100);
        });
        resizeObserver.observe(statementEl);

        cleanup = () => {
          observer.disconnect();
          resizeObserver.disconnect();
          if (resizeTimer !== null) window.clearTimeout(resizeTimer);
          releaseSync();
          disposeScene();
          for (const el of splitEls) {
            unsplitElement(el);
          }
          ScrollTrigger.refresh();
        };
      });
    });

    return () => {
      cancelled = true;
      cleanup?.();
      cleanup = null;
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Манифест">
      <div className={styles.inner}>
        <h2 ref={statementRef} className={styles.statement}>
          <span className={styles.line} data-line>
            {STATEMENT_1}
          </span>
          <span className={styles.line} data-line>
            {STATEMENT_2}
          </span>
        </h2>
        <p ref={subRef} className={styles.subline}>
          {SUBLINE}
        </p>
      </div>
    </section>
  );
}
