/**
 * Shared scroll / gesture activity for glass surfaces.
 *
 * Sticky `backdrop-filter: url(#svg)` and dozens of card frosts re-sample the
 * page on every scroll frame. Baking maps mid-gesture does the same. One
 * capture-phase listener fans out to:
 *  - liquid-glass map idle queue
 *  - `html[data-glass-scroll]` for CSS to drop cheap card frosts during scroll
 *
 * Call `noteGlassScroll()` from overflow scrollers (inbox transcript, lists) —
 * the window listener ignores nested targets on purpose.
 *
 * Live SVG refraction on panels stays on during scroll (see-through is the
 * point). Control lenses stay unmounted until press; closed popovers unmount.
 */

export const GLASS_SCROLL_SETTLE_MS = 140;

type BusyListener = (busy: boolean) => void;

const listeners = new Set<BusyListener>();
let lastScrollAt = 0;
let scrollBound = false;
let settleTimer = 0;
let busy = false;

function setBusy(next: boolean): void {
  if (busy === next) return;
  busy = next;
  if (typeof document !== "undefined") {
    if (next) document.documentElement.dataset.glassScroll = "1";
    else delete document.documentElement.dataset.glassScroll;
  }
  for (const listener of listeners) listener(next);
}

function armSettle(): void {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    settleTimer = 0;
    if (performance.now() - lastScrollAt >= GLASS_SCROLL_SETTLE_MS) {
      setBusy(false);
    } else {
      armSettle();
    }
  }, GLASS_SCROLL_SETTLE_MS);
}

function onScroll(event?: Event): void {
  if (event) {
    const target = event.target;
    if (
      target &&
      target !== document &&
      target !== document.documentElement &&
      target !== document.body
    ) {
      return;
    }
  }
  lastScrollAt = performance.now();
  setBusy(true);
  armSettle();
}

function bindScroll(): void {
  if (scrollBound || typeof window === "undefined") return;
  scrollBound = true;
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
}

function unbindScroll(): void {
  if (!scrollBound) return;
  // Keep the capture listener while any subscriber exists. Tear down only when
  // idle and nobody is listening — avoids missing the first gesture after mount.
  if (listeners.size > 0 || busy) return;
  scrollBound = false;
  window.removeEventListener("scroll", onScroll, { capture: true });
  if (settleTimer) {
    window.clearTimeout(settleTimer);
    settleTimer = 0;
  }
}

/** Ensure the capture listener is armed (lab pages call this on mount). */
export function ensureGlassScrollTracking(): void {
  bindScroll();
}

/** Mark activity from non-window scrollers (overflow panels, etc.). */
export function noteGlassScroll(): void {
  bindScroll();
  onScroll();
}

export function isGlassScrollBusy(): boolean {
  return busy;
}

export function glassScrollQuietFor(): number {
  if (!lastScrollAt) return Number.POSITIVE_INFINITY;
  return performance.now() - lastScrollAt;
}

/**
 * Subscribe to busy/idle transitions. Immediately replays the current state.
 * Tracking starts on the first subscriber.
 */
export function subscribeGlassScrollActivity(
  listener: BusyListener,
): () => void {
  listeners.add(listener);
  bindScroll();
  listener(busy);
  return () => {
    listeners.delete(listener);
    unbindScroll();
  };
}
