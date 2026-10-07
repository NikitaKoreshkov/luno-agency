/**
 * Lightweight compositor watchdog for glass-heavy app/desk pages.
 *
 * Hero WebGL already has `createFramePacer`; the desk does not. When several
 * SVG backdrop filters are live, frame time climbs and the fan spins even if
 * RAM looks fine. This sampler watches real rAF intervals and drops one perf
 * tier (which shrinks `maxLiveGlassFilters`) when a sustained majority of
 * frames arrive late.
 *
 * Idle (no live glass, no scroll busy): sleeps on a 500 ms timer so we do not
 * burn a permanent rAF loop on the MacBook Air.
 */

import { downgradePerfBudget } from "@/lib/perf/deviceTier";
import { refreshGlassLiveBudget, glassLiveClaimCount } from "./glassLiveBudget";
import { isGlassScrollBusy } from "./glassScrollActivity";

const WARMUP_FRAMES = 60;
const SAMPLE_WINDOW = 90;
const LATE_RATIO_LIMIT = 0.4;
const LATE_MS = 22; // ~45 fps floor — below this the UI feels sticky
const IDLE_GAP_MS = 1000;
const SLEEP_MS = 500;

let armed = false;
let raf = 0;
let sleep = 0;
let warmup = 0;
let windowFrames = 0;
let lateFrames = 0;
let lastSampleMs = 0;
let exhausted = false;

function clearTimers(): void {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (sleep) {
    window.clearTimeout(sleep);
    sleep = 0;
  }
}

function scheduleHot(): void {
  if (raf || sleep || !armed || exhausted) return;
  raf = requestAnimationFrame(tick);
}

function scheduleSleep(): void {
  if (raf || sleep || !armed || exhausted) return;
  sleep = window.setTimeout(() => {
    sleep = 0;
    scheduleHot();
  }, SLEEP_MS);
}

function tick(now: number): void {
  raf = 0;
  if (!armed || exhausted) return;

  // Only spend samples while glass is actually taxing the compositor.
  const hot = glassLiveClaimCount() > 0 || isGlassScrollBusy();
  if (!hot) {
    lastSampleMs = now;
    scheduleSleep();
    return;
  }

  if (warmup < WARMUP_FRAMES) {
    warmup += 1;
    lastSampleMs = now;
    scheduleHot();
    return;
  }

  const delta = now - lastSampleMs;
  lastSampleMs = now;
  if (delta > 0 && delta < IDLE_GAP_MS) {
    windowFrames += 1;
    if (delta > LATE_MS) lateFrames += 1;

    if (windowFrames >= SAMPLE_WINDOW) {
      const lateRatio = lateFrames / windowFrames;
      windowFrames = 0;
      lateFrames = 0;
      if (lateRatio >= LATE_RATIO_LIMIT) {
        if (downgradePerfBudget() === null) {
          exhausted = true;
          clearTimers();
          return;
        }
        refreshGlassLiveBudget();
      }
    }
  }

  scheduleHot();
}

/** Idempotent — safe to call from AppShell / lab mounts. */
export function ensureGlassCompositorWatchdog(): void {
  if (typeof window === "undefined") return;
  if (armed) {
    // Wake from sleep if a new glass surface just claimed a slot.
    if (!raf && !sleep && !exhausted) scheduleHot();
    return;
  }
  armed = true;
  scheduleHot();
}

export function stopGlassCompositorWatchdog(): void {
  if (!armed) return;
  armed = false;
  exhausted = false;
  warmup = 0;
  windowFrames = 0;
  lateFrames = 0;
  clearTimers();
}
