"use client";

import { useEffect, useRef } from "react";
import { getPerfBudget } from "@/lib/perf/deviceTier";
import styles from "./services-panel-glass.module.css";

const ACTIVATION_ZONE = 200;
const ELASTICITY = 0.18;
const LERP = 0.08;

interface Props {
  children: React.ReactNode;
  id?: string;
  magnetic?: boolean;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Одна панель = объект в общем реестре. Раньше каждый инстанс вешал свои
 * scroll/mousemove слушатели и дёргал getBoundingClientRect() на каждое событие
 * (22 панели × каждый кадр скролла = принудительный layout) плюс setState на
 * каждое движение мыши. Теперь слушатели и rAF общие, все замеры идут одним
 * пакетом перед всеми записями, а rim пишется в CSS-переменную.
 */
type Panel = {
  el: HTMLElement;
  cx: number;
  cy: number;
  /** Центр панели в координатах документа: скролл вычитается из Lenis, а не из layout. */
  cyDoc: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  onScreen: boolean;
  atRest: boolean;
};

const panels = new Set<Panel>();
const pointer = { x: 0, y: 0, live: false };

let raf = 0;
let measureRaf = 0;
let settleTimer = 0;

/** Позиция скролла без чтения layout: Lenis держит значение в JS и обновляет его в свой rAF. */
function currentScrollY(): number {
  return window.__lenisInstance?.scroll ?? window.scrollY;
}

function measure(p: Panel) {
  const rect = p.el.getBoundingClientRect();
  if (rect.width < 1) return;
  p.cx = rect.left + rect.width / 2;
  p.cyDoc = rect.top + currentScrollY() + rect.height / 2;
  p.cy = p.cyDoc - currentScrollY();
  p.w = rect.width;
  p.h = rect.height;
}

function measureAll() {
  for (const p of panels) if (p.onScreen) measure(p);
}

function queueMeasure() {
  if (measureRaf) return;
  measureRaf = requestAnimationFrame(() => {
    measureRaf = 0;
    measureAll();
    startLoop();
  });
}

/**
 * На скролле геометрию переставляем только когда страница встала: раньше
 * каждый кадр скролла вызывал пакет getBoundingClientRect() (замер на M2:
 * 141 принудительный layout за 200 кадров скролла). Между этим центр панели
 * считается из document-координаты и смещения Lenis.
 */
function scheduleSettleMeasure() {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    settleTimer = 0;
    queueMeasure();
  }, 160);
}

function rimFor(p: Panel, ox: number, oy: number, fade: number) {
  if (fade <= 0) {
    p.el.style.removeProperty("--rim-bg");
    return;
  }
  const angle = 135 + ox * 1.5;
  const peak = Math.min(1, 0.85 + Math.abs(ox) * 0.002);
  const edge = Math.min(0.9, 0.06 + (Math.abs(ox) + Math.abs(oy)) * 0.001);
  p.el.style.setProperty(
    "--rim-bg",
    `linear-gradient(${angle.toFixed(2)}deg,
      rgba(255,255,255,${edge.toFixed(3)}) 0%,
      rgba(255,255,255,${peak.toFixed(3)}) 45%,
      rgba(255,255,255,${(peak * 0.9).toFixed(3)}) 55%,
      rgba(255,255,255,${(edge * 0.7).toFixed(3)}) 100%)`,
  );
}

function frame() {
  raf = 0;
  let animating = false;
  const scrollY = currentScrollY();

  for (const p of panels) {
    if (!p.onScreen) continue;
    p.cy = p.cyDoc - scrollY;

    let tx = 0;
    let ty = 0;
    let sx = 1;
    let sy = 1;
    let ox = 0;
    let oy = 0;
    let fade = 0;

    if (pointer.live && p.w >= 1) {
      const edgeX = Math.max(0, Math.abs(pointer.x - p.cx) - p.w / 2);
      const edgeY = Math.max(0, Math.abs(pointer.y - p.cy) - p.h / 2);
      const dist = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
      fade = dist > ACTIVATION_ZONE ? 0 : 1 - dist / ACTIVATION_ZONE;

      ox = ((pointer.x - p.cx) / p.w) * 100 * fade;
      oy = ((pointer.y - p.cy) / p.h) * 100 * fade;

      const deltaX = pointer.x - p.cx;
      const deltaY = pointer.y - p.cy;
      const centerDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
      const nx = deltaX / centerDistance;
      const ny = deltaY / centerDistance;
      const stretch = Math.min(centerDistance / 300, 1) * ELASTICITY * fade;

      tx = deltaX * ELASTICITY * 0.1 * fade;
      ty = deltaY * ELASTICITY * 0.1 * fade;
      sx = Math.max(0.985, 1 + Math.abs(nx) * stretch * 0.3 - Math.abs(ny) * stretch * 0.15);
      sy = Math.max(0.985, 1 + Math.abs(ny) * stretch * 0.3 - Math.abs(nx) * stretch * 0.15);
    }

    if (p.atRest && tx === 0 && ty === 0 && sx === 1 && sy === 1) continue;
    p.atRest = false;

    p.tx = lerp(p.tx, tx, LERP);
    p.ty = lerp(p.ty, ty, LERP);
    p.sx = lerp(p.sx, sx, LERP);
    p.sy = lerp(p.sy, sy, LERP);

    const settled =
      Math.abs(p.tx - tx) < 0.02 &&
      Math.abs(p.ty - ty) < 0.02 &&
      Math.abs(p.sx - sx) < 0.001 &&
      Math.abs(p.sy - sy) < 0.001;

    if (settled) {
      p.tx = tx;
      p.ty = ty;
      p.sx = sx;
      p.sy = sy;
    }

    p.el.style.transform = `translate3d(${p.tx.toFixed(2)}px, ${p.ty.toFixed(2)}px, 0) scale(${p.sx.toFixed(4)}, ${p.sy.toFixed(4)})`;
    rimFor(p, ox, oy, fade);

    if (settled) {
      if (fade <= 0) {
        delete p.el.dataset.mag;
        p.atRest = true;
      }
    } else {
      animating = true;
      p.el.dataset.mag = "on";
    }
  }

  if (animating) raf = requestAnimationFrame(frame);
}

function startLoop() {
  if (raf || panels.size === 0) return;
  raf = requestAnimationFrame(frame);
}

function onPointerMove(event: MouseEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.live = true;
  startLoop();
}

function onPointerLeave() {
  pointer.live = false;
  startLoop();
}

let listeners = 0;

function acquireListeners() {
  listeners += 1;
  if (listeners > 1) return () => releaseListeners();
  window.addEventListener("mousemove", onPointerMove, { passive: true });
  window.addEventListener("mouseleave", onPointerLeave);
  window.addEventListener("scroll", scheduleSettleMeasure, { passive: true });
  window.addEventListener("resize", queueMeasure, { passive: true });
  return () => releaseListeners();
}

function releaseListeners() {
  listeners -= 1;
  if (listeners > 0) return;
  window.removeEventListener("mousemove", onPointerMove);
  window.removeEventListener("mouseleave", onPointerLeave);
  window.removeEventListener("scroll", scheduleSettleMeasure);
  window.removeEventListener("resize", queueMeasure);
  if (settleTimer) {
    window.clearTimeout(settleTimer);
    settleTimer = 0;
  }
  if (measureRaf) cancelAnimationFrame(measureRaf);
  measureRaf = 0;
}

export function ServicesPanelGlass({
  children,
  id = "services-panel",
  magnetic = true,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!magnetic) return;
    const budget = getPerfBudget();
    // На слабом тире декоративное движение отключено бюджетом; rim остаётся
    // статическим (дефолт --glass-panel-rim), стекло не «гаснет».
    if (budget.reducedMotion || !budget.decorativeMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const el = shellRef.current;
    if (!el) return;

    const panel: Panel = {
      el,
      cx: 0,
      cy: 0,
      cyDoc: 0,
      w: 0,
      h: 0,
      tx: 0,
      ty: 0,
      sx: 1,
      sy: 1,
      onScreen: false,
      atRest: true,
    };
    panels.add(panel);

    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries[entries.length - 1];
        const next = seen?.isIntersecting ?? false;
        if (next === panel.onScreen) return;
        panel.onScreen = next;
        if (next) queueMeasure();
        else {
          el.style.transform = "";
          el.style.removeProperty("--rim-bg");
          delete el.dataset.mag;
          panel.atRest = true;
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(el);

    const release = acquireListeners();
    queueMeasure();

    return () => {
      release();
      observer.disconnect();
      panels.delete(panel);
      el.style.transform = "";
      el.style.removeProperty("--rim-bg");
      delete el.dataset.mag;
    };
  }, [magnetic]);

  return (
    <div
      id={id}
      ref={shellRef}
      className={`${styles.shell}${magnetic ? "" : ` ${styles.shellStatic}`}`}
    >
      <div className={styles.rim} aria-hidden />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
