/**
 * Caps how many LiquidGlass surfaces may keep a live SVG displacement filter
 * at once. Each `backdrop-filter: url(#svg)` re-samples the page every frame;
 * a desk full of lenses (header, composer, sidebar pill, switches, menus) is
 * what heats a MacBook Air even when JS heap stays modest (~350 MB).
 *
 * Surfaces that lose a slot keep frost blur + tint — the material still reads
 * as glass, without the expensive refraction pass. Priority rebalances when
 * claimants mount/unmount or the perf budget changes.
 */

import { getPerfBudget } from "@/lib/perf/deviceTier";

/** Page chrome vs glass sitting on a modal/overlay. */
export type GlassLiveLayer = "page" | "overlay";

type Entry = {
  id: string;
  priority: number;
  layer: GlassLiveLayer;
  onChange: (allowed: boolean) => void;
  allowed: boolean;
};

const entries = new Map<string, Entry>();
let scheduled = false;
let overlayCount = 0;

function overlayOpen(): boolean {
  return overlayCount > 0;
}

function syncOverlayAttr(): void {
  if (typeof document === "undefined") return;
  if (overlayOpen()) document.documentElement.dataset.glassOverlay = "1";
  else delete document.documentElement.dataset.glassOverlay;
}

/**
 * Pause live refraction on page chrome while a modal owns the viewport.
 * Overlay-layer claimants keep competing for the cap; everything else
 * drops to frost + tint until the last overlay releases.
 */
export function pushGlassOverlay(): () => void {
  overlayCount += 1;
  syncOverlayAttr();
  scheduleRebalance();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    overlayCount = Math.max(0, overlayCount - 1);
    syncOverlayAttr();
    scheduleRebalance();
  };
}

function cap(): number {
  const budget = getPerfBudget();
  // Windows / low tiers: no live SVG refraction anywhere — every claimant
  // stays on frost + tint. See PerfBudget.svgGlassDisplacement.
  if (!budget.svgGlassDisplacement) return 0;
  return Math.max(1, budget.maxLiveGlassFilters);
}

function wakeWatchdog(): void {
  // Lazy import avoids a cycle: watchdog → liveBudget → watchdog.
  void import("./glassCompositorWatchdog").then((m) => {
    m.ensureGlassCompositorWatchdog();
  });
}

function rank(a: Entry, b: Entry): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function applyAllowed(entry: Entry, next: boolean): void {
  if (entry.allowed === next) return;
  entry.allowed = next;
  entry.onChange(next);
}

function rebalance(): void {
  scheduled = false;
  const covering = overlayOpen();
  const live: Entry[] = [];
  for (const entry of entries.values()) {
    if (covering && entry.layer !== "overlay") {
      applyAllowed(entry, false);
      continue;
    }
    live.push(entry);
  }
  live.sort(rank);
  const max = cap();
  for (let i = 0; i < live.length; i += 1) {
    const entry = live[i]!;
    // Priority ≥ 90 is sticky chrome (`urgent`). Those plates keep the SVG
    // pass even over cap — flipping `allowed` would clear the filter for a
    // frame and the header glass would blink off while a slider mounts.
    // A cap of 0 means the platform has no SVG refraction at all.
    applyAllowed(entry, max > 0 && (i < max || entry.priority >= 90));
  }
  if (entries.size > 0) wakeWatchdog();
}

function scheduleRebalance(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(rebalance);
}

/**
 * Register a live refraction claimant. `onChange(false)` means blur-only;
 * `true` restores the SVG chain. Returns the release function.
 */
export function claimGlassLiveSlot(
  id: string,
  priority: number,
  onChange: (allowed: boolean) => void,
  layer: GlassLiveLayer = "page",
): () => void {
  const prev = entries.get(id);
  if (prev) {
    prev.priority = priority;
    prev.onChange = onChange;
    prev.layer = layer;
    scheduleRebalance();
    return () => {
      entries.delete(id);
      scheduleRebalance();
    };
  }

  const entry: Entry = {
    id,
    priority,
    layer,
    onChange,
    // Optimistic until the microtask runs — avoids a flat flash on mount.
    allowed: true,
  };
  entries.set(id, entry);
  scheduleRebalance();

  return () => {
    entries.delete(id);
    scheduleRebalance();
  };
}

/** After a runtime perf downgrade — shrink the live set to the new cap. */
export function refreshGlassLiveBudget(): void {
  scheduleRebalance();
}

export function glassLiveClaimCount(): number {
  return entries.size;
}
