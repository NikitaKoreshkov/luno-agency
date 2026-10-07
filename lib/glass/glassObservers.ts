"use client";

/**
 * Shared observers for glass surfaces.
 *
 * Every glass control used to construct its own `ResizeObserver` — and an armed
 * one constructed two, since the lens wrapper and the surface inside it each
 * measured themselves. A toolbar, a sidebar and a lab full of chips added up to
 * dozens of live observers, each with its own callback, its own entry list and
 * its own slot in the browser's per-frame observation loop.
 *
 * A single observer with many targets does the same job: the engine walks its
 * targets once and delivers one batched callback, so the cost per surface drops
 * to a Map lookup. The visibility observer exists for a second reason — a lab
 * page can hold far more glass than fits on screen, and baking refraction maps
 * for surfaces nobody has scrolled to is work that buys nothing.
 */

export type GlassBox = { width: number; height: number };

type BoxListener = (box: GlassBox) => void;
type VisibilityListener = (visible: boolean) => void;

type BoxEntry = {
  listeners: Set<BoxListener>;
  /**
   * Last size the observer reported. A `ResizeObserver` delivers an initial
   * observation when `observe` is first called, but that only happens for the
   * *first* listener on an element — a second one would otherwise sit at zero
   * until the element happened to change size. Replaying the cached box gives it
   * the same start without a `getBoundingClientRect` (which would force layout).
   */
  last: GlassBox | null;
};

const boxTargets = new Map<Element, BoxEntry>();
let boxObserver: ResizeObserver | null = null;

function readBox(entry: ResizeObserverEntry): GlassBox {
  // `contentRect` rather than a `getBoundingClientRect` call: the observer
  // already has the geometry, so reading it here costs no forced layout.
  return {
    width: Math.round(entry.contentRect.width),
    height: Math.round(entry.contentRect.height),
  };
}

/** Layout-time seed. WebKit often skips the first ResizeObserver for a
 *  newly mounted node inside a transformed parent (GSAP `force3D` pills). */
function readClientBox(element: Element): GlassBox {
  const node = element as HTMLElement;
  return {
    width: Math.round(node.clientWidth || 0),
    height: Math.round(node.clientHeight || 0),
  };
}

function publishBox(target: BoxEntry, box: GlassBox): void {
  if (box.width < 8 && box.height < 8) return;
  target.last = box;
  if (boxFrozen) return;
  for (const listener of target.listeners) listener(box);
}

let boxFrozen = false;

function flushBoxListeners(): void {
  for (const target of boxTargets.values()) {
    if (!target.last) continue;
    for (const listener of target.listeners) listener(target.last);
  }
}

/** Pause size-driven glass updates (sidebar width tween, etc.). */
export function freezeGlassBoxObservers(): void {
  boxFrozen = true;
}

export function isGlassBoxFrozen(): boolean {
  return boxFrozen;
}

/** Resume and replay the last observed box once, so surfaces land on rest size. */
export function unfreezeGlassBoxObservers(): void {
  if (!boxFrozen) return;
  boxFrozen = false;
  flushBoxListeners();
}

function ensureBoxObserver(): ResizeObserver | null {
  if (typeof ResizeObserver === "undefined") return null;
  boxObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = boxTargets.get(entry.target);
      if (!target) continue;
      const box = readBox(entry);
      // A 0×0 first tick (hidden / pre-layout) must not replace a real seed —
      // standing lenses never resize again, so that zero stuck until travel.
      if (box.width < 8 && box.height < 8) continue;
      target.last = box;
      if (boxFrozen) continue;
      for (const listener of target.listeners) listener(box);
    }
  });
  return boxObserver;
}

/** Watch an element's content box. Returns the unsubscribe. */
export function observeGlassBox(
  element: Element,
  listener: BoxListener,
): () => void {
  const observer = ensureBoxObserver();
  let raf = 0;

  let target = boxTargets.get(element);
  if (!target) {
    target = { listeners: new Set(), last: null };
    boxTargets.set(element, target);
    target.listeners.add(listener);
    observer?.observe(element);
    // Don't wait for the engine's initial observation — standing sidebar
    // lenses never resize after land, so a missed first tick left them flat
    // until the pill travelled.
    publishBox(target, readClientBox(element));
    if (!target.last) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        const current = boxTargets.get(element);
        if (!current) return;
        publishBox(current, readClientBox(element));
      });
    }
  } else {
    target.listeners.add(listener);
    if (target.last) listener(target.last);
    else publishBox(target, readClientBox(element));
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    const current = boxTargets.get(element);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    boxTargets.delete(element);
    observer?.unobserve(element);
  };
}

/**
 * How far outside the viewport a surface still counts as visible. Wide enough
 * that a map is baked before the surface is scrolled into view, so it never
 * appears as flat blur and then pops into refraction.
 */
const VISIBILITY_MARGIN = "320px";

type VisibilityEntry = {
  listeners: Set<VisibilityListener>;
  /** Replayed to late subscribers, for the same reason as `BoxEntry.last`. */
  last: boolean | null;
};

const visibilityTargets = new Map<Element, VisibilityEntry>();
let visibilityObserver: IntersectionObserver | null = null;

function ensureVisibilityObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  visibilityObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = visibilityTargets.get(entry.target);
        if (!target) continue;
        target.last = entry.isIntersecting;
        for (const listener of target.listeners) listener(entry.isIntersecting);
      }
    },
    { rootMargin: VISIBILITY_MARGIN },
  );
  return visibilityObserver;
}

/**
 * Fire once, the first time an element comes near the viewport, then stop
 * watching it.
 *
 * Deliberately one-shot. The caller only wants to know when it is worth baking a
 * refraction map, and that question has no answer that can become false again —
 * the map is cached either way. Reporting every crossing instead meant a React
 * state update per control per scroll pass, in both directions, which is work
 * landing in exactly the frames that have none to spare. Unobserving as we go
 * also shrinks the observer's target list as the user scrolls.
 *
 * Reports `true` immediately when the engine has no `IntersectionObserver`, so an
 * unsupported browser warms everything rather than nothing.
 */
export function observeGlassNearViewport(
  element: Element,
  listener: () => void,
): () => void {
  let done = false;
  let unsubscribe: (() => void) | null = null;

  const once: VisibilityListener = (visible) => {
    if (!visible || done) return;
    done = true;
    // Detaching from inside the observer callback is safe, and leaving it
    // attached would keep delivering crossings nobody reads. `unsubscribe` is
    // still null when the element was already known to be visible and the
    // subscription replayed synchronously — the tail below covers that case.
    unsubscribe?.();
    listener();
  };

  unsubscribe = subscribeVisibility(element, once);
  if (done) unsubscribe();

  return () => {
    done = true;
    unsubscribe?.();
  };
}

function subscribeVisibility(
  element: Element,
  listener: VisibilityListener,
): () => void {
  const observer = ensureVisibilityObserver();
  if (!observer) {
    listener(true);
    return () => {};
  }

  let target = visibilityTargets.get(element);
  if (!target) {
    target = { listeners: new Set(), last: null };
    visibilityTargets.set(element, target);
    target.listeners.add(listener);
    observer.observe(element);
  } else {
    target.listeners.add(listener);
    if (target.last !== null) listener(target.last);
  }

  return () => {
    const current = visibilityTargets.get(element);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    visibilityTargets.delete(element);
    observer.unobserve(element);
  };
}

/**
 * Continuous visibility for live filter cost.
 *
 * Unlike `observeGlassNearViewport`, this keeps reporting so a surface that
 * scrolls away can drop its SVG `backdrop-filter` chain and put it back when it
 * returns — without a React update on every pixel of scroll, only on crossings.
 */
export function observeGlassVisibility(
  element: Element,
  listener: VisibilityListener,
): () => void {
  return subscribeVisibility(element, listener);
}
