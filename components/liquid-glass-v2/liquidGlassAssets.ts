import { getPerfBudget } from "@/lib/perf/deviceTier";
import {
  GLASS_SCROLL_SETTLE_MS,
  glassScrollQuietFor,
  subscribeGlassScrollActivity,
} from "@/lib/glass/glassScrollActivity";
import {
  calculateDisplacementMap1D,
  calculateDisplacementMap2D,
  calculateDisplacementMap2DRect,
  calculateSpecularHighlight,
  calculateSpecularHighlightRect,
} from "./refractionMaps";
import { SurfaceEquations, type LiquidSurfaceType } from "./surfaceEquations";

/**
 * Memoised generation of the displacement + specular maps.
 *
 * Generation is synchronous main-thread pixel work, so the rules here are:
 *
 *  - **Quantise the size.** A panel that resizes by 3px does not need a new map;
 *    rounding to a bucket turns a resize drag from hundreds of regenerations
 *    into a handful.
 *  - **Cache by full config.** Two glass surfaces with the same geometry share
 *    one pair of maps and one SVG filter.
 *  - **Never regenerate during a scroll or pointer gesture.** Callers schedule
 *    through `requestLiquidAssets`, which queues to idle time and drains a few
 *    maps per slice rather than all of them at once.
 *  - **Bake near native (Retina-aware), cap only huge plates.** `feImage`
 *    stretches with `preserveAspectRatio="none"`; a 240px map over a role card
 *    (~400 CSS px, 2× DPR) reads as a jagged low-res lens. Optical scale
 *    (displacement peak) stays in CSS px either way.
 */

export type LiquidGlassShape = "stadium" | "rect";
export type LiquidGlassBezelEdges = "all" | "y";

export type LiquidGlassConfig = {
  width: number;
  height: number;
  radius: number;
  bezelWidth: number;
  glassThickness: number;
  refractiveIndex: number;
  surface: LiquidSurfaceType;
  /** `rect` = square chrome with deep edge bezel; default stadium (pill/rounded). */
  shape?: LiquidGlassShape;
  /** `y` = top + bottom refraction only (lab sticky headers). */
  bezelEdges?: LiquidGlassBezelEdges;
  /**
   * Bake the specular rim texture. Lab sticky bars pass `false` when
   * `specularAlpha` is zero — encoding a full-size specular PNG for a layer
   * the filter never samples is pure main-thread waste.
   */
  includeSpecular?: boolean;
};

export type LiquidGlassAssets = {
  displacementUrl: string;
  specularUrl: string;
  /** Peak lateral shift in px — the natural `scale` for feDisplacementMap. */
  maximumDisplacement: number;
  width: number;
  height: number;
};

/** Size bucket in px. Large enough to absorb resize jitter, small enough that
 *  the bezel geometry stays visually correct. */
const SIZE_QUANTUM = 8;

/** Beyond this the pixel loops get expensive enough to be visible as a hitch. */
const MAX_DIMENSION = 1024;

/**
 * Longest side of the *baked texture* in pixels.
 *
 * Card hover lenses are ~360–480 CSS px on a 2× Air; anything near 240px here
 * is stretched by `feImage` and looks like a low-res filter. Buttons stay 1:1
 * either way. Only full-bleed plates (headers, tall panels) still downsample.
 */
function mapMaxSide(): number {
  const tier = getPerfBudget().tier;
  if (tier === "low") return 320;
  if (tier === "medium") return 640;
  return MAX_DIMENSION;
}

/** Native CSS size, extra pixels on Retina, never past `mapMaxSide()`. */
function mapBakeScale(width: number, height: number): number {
  const longest = Math.max(width, height, 1);
  const dpr =
    typeof window === "undefined"
      ? 1
      : Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(dpr, mapMaxSide() / longest);
}

/** 1×1 transparent PNG — placeholder when specular is not sampled. */
const EMPTY_SPECULAR_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Retention. LRU, not FIFO — a map that is still on screen must not be thrown
 * out just because 24 newer geometries were requested. The working set of one
 * app screen is ~15–25 configs (top bar, menu, sidebar rest/travel, a handful
 * of buttons). Anything above that is decoded PNG data the GPU also keeps, and
 * a 128-slot / 28MB ceiling is what ballooned RAM after the first pass.
 */
const CACHE_LIMIT = 32;
const CACHE_BYTES_LIMIT = 10 * 1024 * 1024;

const cache = new Map<string, LiquidGlassAssets>();
const inFlight = new Map<string, Promise<LiquidGlassAssets>>();
let cacheBytes = 0;

function quantise(value: number): number {
  return Math.max(
    SIZE_QUANTUM,
    Math.min(MAX_DIMENSION, Math.round(value / SIZE_QUANTUM) * SIZE_QUANTUM),
  );
}

export function normaliseConfig(
  config: LiquidGlassConfig,
): LiquidGlassConfig {
  const width = quantise(config.width);
  const height = quantise(config.height);
  const shape: LiquidGlassShape = config.shape === "rect" ? "rect" : "stadium";
  const halfMin = Math.min(width, height) / 2;

  const includeSpecular = config.includeSpecular !== false;

  if (shape === "rect") {
    // Bezel depth is independent of corner radius; keep radius for specular
    // rounding so a CSS-clipped plate doesn’t get square highlight ticks.
    return {
      ...config,
      shape,
      width,
      height,
      radius: Math.max(0, Math.min(config.radius, halfMin)),
      bezelWidth: Math.max(1, Math.min(config.bezelWidth, halfMin - 1)),
      bezelEdges: config.bezelEdges === "y" ? "y" : "all",
      includeSpecular,
    };
  }

  // A radius over half the shortest side produces a degenerate bezel.
  const radius = Math.max(1, Math.min(config.radius, halfMin));
  // Stadium map carves the bezel *inside* the corner radius.
  // bezelWidth > radius → nearly empty map → plain blur. Always clamp.
  const bezelWidth = Math.max(1, Math.min(config.bezelWidth, radius));
  return {
    ...config,
    shape,
    width,
    height,
    radius,
    bezelWidth,
    includeSpecular,
  };
}

export function configKey(config: LiquidGlassConfig): string {
  return [
    config.width,
    config.height,
    Math.round(config.radius),
    Math.round(config.bezelWidth),
    Math.round(config.glassThickness),
    config.refractiveIndex.toFixed(3),
    config.surface,
    config.shape ?? "stadium",
    config.bezelEdges ?? "all",
    config.includeSpecular === false ? "0" : "1",
  ].join(":");
}

function assetBytes(assets: LiquidGlassAssets): number {
  return assets.displacementUrl.length + assets.specularUrl.length;
}

/** Move a hit to the young end — Map iterates in insertion order. */
function touch(key: string, assets: LiquidGlassAssets): LiquidGlassAssets {
  cache.delete(key);
  cache.set(key, assets);
  return assets;
}

function readCache(key: string): LiquidGlassAssets | null {
  const hit = cache.get(key);
  return hit ? touch(key, hit) : null;
}

function rememberInCache(key: string, assets: LiquidGlassAssets): void {
  const previous = cache.get(key);
  if (previous) {
    cacheBytes -= assetBytes(previous);
    cache.delete(key);
  }
  cache.set(key, assets);
  cacheBytes += assetBytes(assets);

  while (
    cache.size > 1 &&
    (cache.size > CACHE_LIMIT || cacheBytes > CACHE_BYTES_LIMIT)
  ) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const stale = cache.get(oldest);
    if (stale) {
      cacheBytes -= assetBytes(stale);
      revokeAssets(stale);
    }
    cache.delete(oldest);
  }
}

function revokeAssets(assets: LiquidGlassAssets): void {
  for (const url of [assets.displacementUrl, assets.specularUrl]) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

/**
 * One scratch canvas for every encode. Two maps per config times every distinct
 * geometry on a page is a lot of short-lived canvases, each of which is a GPU/CPU
 * surface allocation rather than a plain JS object.
 */
let scratch: HTMLCanvasElement | null = null;

function encode(imageData: ImageData): string {
  // Always data URL — Safari/WebKit often refuses blob: URLs inside <feImage>,
  // which is exactly why refraction looked "dead" when we tried this on the header.
  scratch ??= document.createElement("canvas");
  const canvas = scratch;
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  // Setting the size already clears it, so no explicit clearRect is needed.
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function generate(config: LiquidGlassConfig): LiquidGlassAssets {
  // The 1-D profile stays in real pixels: it decides how far light actually
  // bends, which must not change with the texture resolution.
  const profile = calculateDisplacementMap1D(
    config.glassThickness,
    config.bezelWidth,
    SurfaceEquations[config.surface] ?? SurfaceEquations.convex_squircle,
    config.refractiveIndex,
  );
  const maximumDisplacement = profile.reduce(
    (peak, v) => Math.max(peak, Math.abs(v)),
    0,
  );

  const peak = maximumDisplacement || 1;
  // Geometry scales with the texture so the bezel keeps the same fraction of
  // the surface once `feImage` maps it onto the live box.
  const k = mapBakeScale(config.width, config.height);
  const mapWidth = Math.max(8, Math.round(config.width * k));
  const mapHeight = Math.max(8, Math.round(config.height * k));
  const mapRadius = Math.max(1, config.radius * k);
  const mapBezel = Math.max(1, config.bezelWidth * k);

  const displacement =
    config.shape === "rect"
      ? calculateDisplacementMap2DRect(
          mapWidth,
          mapHeight,
          mapBezel,
          peak,
          profile,
          config.bezelEdges === "y" ? "y" : "all",
        )
      : calculateDisplacementMap2D(
          mapWidth,
          mapHeight,
          mapRadius,
          mapBezel,
          peak,
          profile,
        );

  const wantSpecular = config.includeSpecular !== false;
  const specularUrl = wantSpecular
    ? encode(
        config.shape === "rect"
          ? calculateSpecularHighlightRect(
              mapWidth,
              mapHeight,
              mapBezel,
              Math.PI / 3,
              mapRadius,
            )
          : calculateSpecularHighlight(
              mapWidth,
              mapHeight,
              mapRadius,
              mapBezel,
            ),
      )
    : EMPTY_SPECULAR_URL;

  return {
    displacementUrl: encode(displacement),
    specularUrl,
    maximumDisplacement,
    width: config.width,
    height: config.height,
  };
}

/** Synchronous cache peek — safe to call during render. */
export function peekLiquidAssets(
  config: LiquidGlassConfig,
): LiquidGlassAssets | null {
  return readCache(configKey(normaliseConfig(config)));
}

/**
 * Bake (or reuse) maps synchronously. Morphing controls need rest + travel sizes
 * in cache *before* the height tween, otherwise the live capsule rides a
 * stretched stale map and shows a double edge on land.
 */
export function ensureLiquidAssets(
  config: LiquidGlassConfig,
): LiquidGlassAssets {
  const normalised = normaliseConfig(config);
  const key = configKey(normalised);
  const cached = readCache(key);
  if (cached) return cached;
  const assets = generate(normalised);
  rememberInCache(key, assets);
  return assets;
}

/**
 * Bake the maps for a geometry ahead of time and forget about the result.
 *
 * Controls call this once they know their size, so the first hover finds a warm
 * cache instead of paying for generation right when the pointer arrives — which
 * is what made the effect look like it lagged behind the cursor.
 */
export function prewarmLiquidAssets(config: LiquidGlassConfig): void {
  const key = configKey(normaliseConfig(config));
  if (cache.has(key) || inFlight.has(key)) return;
  void requestLiquidAssets(config).catch(() => {
    /* Prewarming is best-effort: a failure just means a cold first hover. */
  });
}

type IdleDeadline = { timeRemaining: () => number; didTimeout: boolean };

type IdleWindow = Window & {
  requestIdleCallback?: (
    cb: (deadline: IdleDeadline) => void,
    opts?: { timeout: number },
  ) => number;
};

/**
 * One queue for all pending generations, drained a little at a time.
 *
 * Each request used to register its own `requestIdleCallback`. The browser is
 * free to run many of those in a single idle period, and their 300ms timeout
 * eventually forces the stragglers into a frame regardless — so a page that
 * mounts thirty controls could run sixty pixel loops and sixty PNG encodes
 * back to back, which is what made the app hitch shortly after load.
 *
 * Draining a shared queue instead means the main thread gets handed back between
 * maps: as many as comfortably fit in the current idle slice, then the rest on
 * the next one. Nothing is dropped and nothing is downscaled, so the result is
 * identical — it just stops arriving all at once.
 */
const queue: Array<() => void> = [];
let scheduled = false;
let scrollGateBound = false;
/** Oldest waiting bake — scroll-restore can keep the gate busy past settle. */
let queueStartedAt = 0;
const SCROLL_GATE_MAX_MS = 400;

/**
 * Rough cost of one generation, in ms. Used only to decide whether another map
 * fits in the remaining idle time; being wrong just means one extra map in this
 * slice or one fewer.
 */
const GENERATION_BUDGET_MS = 14;

function drain(deadline?: IdleDeadline): void {
  scheduled = false;

  const quiet = glassScrollQuietFor();
  const blockedFor = queueStartedAt ? performance.now() - queueStartedAt : 0;
  if (quiet < GLASS_SCROLL_SETTLE_MS && blockedFor < SCROLL_GATE_MAX_MS) {
    // Come back once the gesture has had time to end, rather than burning the
    // frame we were just handed.
    window.setTimeout(schedule, GLASS_SCROLL_SETTLE_MS - quiet);
    return;
  }

  // Always run one, even on a busy thread — otherwise a page that never goes
  // idle would leave surfaces as flat blur indefinitely.
  do {
    const task = queue.shift();
    if (!task) break;
    task();
  } while (
    queue.length > 0 &&
    deadline !== undefined &&
    deadline.timeRemaining() > GENERATION_BUDGET_MS
  );

  if (queue.length > 0) {
    schedule();
  } else {
    queueStartedAt = 0;
  }
}

function schedule(): void {
  if (scheduled || queue.length === 0) return;
  scheduled = true;
  const idle = (window as IdleWindow).requestIdleCallback;
  if (idle) {
    idle((deadline) => drain(deadline), { timeout: 300 });
    return;
  }
  window.setTimeout(() => drain(), 0);
}

function whenIdle(run: () => void): void {
  if (queue.length === 0) queueStartedAt = performance.now();
  queue.push(run);
  if (!scrollGateBound) {
    scrollGateBound = true;
    // Shared capture listener: pause baking mid-gesture and resume on settle.
    subscribeGlassScrollActivity((busy) => {
      if (!busy && queue.length > 0) schedule();
    });
  }
  schedule();
}

/**
 * Resolve the maps for a config, generating them at idle time on a cache miss.
 * Concurrent callers for the same geometry share one generation pass.
 */
export function requestLiquidAssets(
  config: LiquidGlassConfig,
): Promise<LiquidGlassAssets> {
  const normalised = normaliseConfig(config);
  const key = configKey(normalised);

  const cached = readCache(key);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = new Promise<LiquidGlassAssets>((resolve, reject) => {
    whenIdle(() => {
      try {
        resolve(generate(normalised));
      } catch (error) {
        reject(error);
      }
    });
  })
    .then((assets) => {
      rememberInCache(key, assets);
      inFlight.delete(key);
      return assets;
    })
    .catch((error) => {
      inFlight.delete(key);
      throw error;
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Fast Refresh re-executes this module but in-flight React state still holds
 * the old Map. Dropping it on dispose is what stops the data-URL cache from
 * stacking every HMR of the glass pipeline on top of the last one.
 */
const hot = (
  import.meta as ImportMeta & {
    webpackHot?: { dispose: (cb: () => void) => void };
  }
).webpackHot;
hot?.dispose(() => {
  for (const assets of cache.values()) revokeAssets(assets);
  cache.clear();
  inFlight.clear();
  cacheBytes = 0;
  queue.length = 0;
});
