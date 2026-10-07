/**
 * Device performance tiering for the hero scene and glass layers.
 *
 * Why this exists: the render budget used to be a single `coarsePointer`
 * boolean, which effectively tuned the site for Apple Silicon + 60 Hz. That
 * assumption breaks badly elsewhere:
 *
 *  - Windows laptops usually render WebGL through ANGLE → D3D11 on an Intel
 *    iGPU sharing bandwidth with the CPU. A full-resolution UnrealBloom chain
 *    (~13 fullscreen draws) plus a 160k-vertex skinned mesh costs several times
 *    what it does on Metal with unified memory.
 *  - Windows OS display scaling (125% / 150%) reports fractional DPR, so a
 *    "1.5 cap" still allocates ~2.25× the fragments of DPR 1.
 *  - High-refresh panels (120–165 Hz) ask for 2–3× more frames per second than
 *    the 60 Hz baseline the animation was tuned against.
 *
 * So the budget is *measured*, not assumed, and can be downgraded at runtime by
 * the FPS watchdog when frames are actually being missed.
 */

export type PerfTier = "low" | "medium" | "high";

/**
 * SSR + CSS fallback before `getPerfBudget()` classifies the device.
 * Keep in sync with `:root { --perf-glass-blur }` in `src/app/globals.css`.
 */
export const SSR_GLASS_BLUR_PX = 14;

export type PerfBudget = {
  tier: PerfTier;
  /** Hard cap for `renderer.setPixelRatio` on landing canvases (not the hero). */
  maxPixelRatio: number;
  /**
   * Hero Seraph + bloom/radial only. Phones used to inherit `maxPixelRatio: 1`
   * (and bloom at 0.5×) which stretches a ~390 CSS-px buffer across a 2–3×
   * display — the “pixel soup”. The phone viewport is still much smaller than
   * a 1.5× 1440p Mac, so 2.5× here is sharper *and* cheaper than desktop.
   */
  heroMaxPixelRatio: number;
  /** Multiplier on the bloom blur chain resolution (1 = full composer res). */
  bloomScale: number;
  /** Hero bloom chain — 1 = same softness as desktop, even on phones. */
  heroBloomScale: number;
  /** Extra fullscreen radial-gradient pass. */
  radialPass: boolean;
  /** Hero radial glow — part of the light look, kept on phones. */
  heroRadialPass: boolean;
  /** Target frame cap for the hero loop. 0 = uncapped (follow display). */
  maxFps: number;
  /** Backdrop blur radius budget for glass surfaces, in px. */
  glassBlurPx: number;
  /**
   * How many LiquidGlass surfaces may keep a live SVG displacement filter
   * concurrently. Extra claimants stay on frost blur + tint (still glass,
   * without the compositor tax that heats fanless laptops).
   */
  maxLiveGlassFilters: number;
  /** Whether the full-viewport lava WebGL layer may run. */
  lava: boolean;
  /** Whether per-glyph lava colour sampling may run. */
  glyphLavaSampling: boolean;
  /**
   * SVG `feDisplacementMap` refraction on glass surfaces (header lens,
   * liquid-glass-react). `filter: url(#svg)` stacked on `backdrop-filter`
   * forces a CPU raster + readback per frame in Chromium on Windows/D3D —
   * the single most expensive thing on the page there. Off → CSS blur + rim
   * gradient, which still reads as glass.
   */
  svgGlassDisplacement: boolean;
  /**
   * Full-viewport `mix-blend-mode` layers (film grain) and infinite decorative
   * CSS animations. Off on the low tier — every blended fullscreen layer is a
   * whole-screen readback per composited frame.
   */
  decorativeMotion: boolean;
  reducedMotion: boolean;
};

/**
 * Windows detection. Chromium on Windows renders WebGL through ANGLE → D3D11
 * and rasterises SVG filters on the CPU; several budgets key off this.
 */
export function isWindowsPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? "";
  if (/win/i.test(platform)) return true;
  return /Windows NT/i.test(navigator.userAgent);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** iPhone / iPad — WebKit will not run SVG-in-backdrop liquid glass reliably. */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPod|iPad/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Pain pin / 3D drum / similar scroll theatres: skip on coarse pointers and
 * on Windows below the dedicated-GPU "high" tier. Mac high keeps the full stage.
 */
export function shouldUseCheapLandingPin(): boolean {
  if (typeof window === "undefined") return false;
  if (isCoarsePointer()) return true;
  if (!isWindowsPlatform()) return false;
  return getPerfBudget().tier !== "high";
}

/**
 * Reads the unmasked GL renderer string. Costs one throwaway context, so the
 * result is memoised — never call this per frame.
 */
let cachedGpuInfo: { renderer: string; software: boolean } | null = null;

function readGpuInfo(): { renderer: string; software: boolean } {
  if (cachedGpuInfo) return cachedGpuInfo;
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "")
        : String(gl.getParameter(gl.RENDERER) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    renderer = "";
  }
  const lower = renderer.toLowerCase();
  const software =
    lower.includes("swiftshader") ||
    lower.includes("basic render") ||
    lower.includes("llvmpipe") ||
    lower.includes("software");
  cachedGpuInfo = { renderer, software };
  return cachedGpuInfo;
}

/** Integrated GPUs that share memory bandwidth with the CPU. */
function isWeakGpu(renderer: string): boolean {
  const r = renderer.toLowerCase();
  if (!r) return false;
  // Apple Silicon iGPUs are strong — never classify them as weak.
  if (r.includes("apple")) return false;
  return (
    r.includes("intel") &&
    // Arc / Iris Xe are acceptable; older HD/UHD Graphics are not.
    !r.includes("arc") &&
    (r.includes("hd graphics") ||
      r.includes("uhd graphics") ||
      r.includes("iris(r) plus") ||
      r.includes("gma"))
  );
}

let cachedBudget: PerfBudget | null = null;
/** Runtime downgrades from the watchdog persist for the page lifetime. */
let runtimeDowngrades = 0;

function classifyTier(): PerfTier {
  const cores = navigator.hardwareConcurrency ?? 4;
  // Non-standard but widely available in Chromium; absent in Safari/Firefox.
  // Default high when unknown — Safari on Apple Silicon often omits deviceMemory,
  // and falling back to 8 was incorrectly parking MacBook Air in "medium".
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 16;
  const { renderer, software } = readGpuInfo();

  if (software) return "low";
  if (isCoarsePointer()) {
    // Phones: only recent high-core devices get the middle tier.
    return cores >= 6 && memory >= 4 ? "medium" : "low";
  }
  // Apple Silicon desktop/laptop: keep full hero HDR + UnrealBloom.
  if (renderer.toLowerCase().includes("apple")) return "high";

  // Chromium on Windows composites WebGL through ANGLE→D3D11 and rasterises
  // SVG/backdrop filters on the CPU. A "high" budget there is what makes
  // the landing hitch on 60 / 144 / 165 Hz panels while the same Mac is fine.
  if (isWindowsPlatform()) {
    if (isWeakGpu(renderer) || cores <= 6 || memory <= 8) return "low";
    const dedicated = /nvidia|geforce|rtx|radeon|rx\s*\d/i.test(renderer);
    if (!dedicated) return "medium";
    if (cores <= 8) return "medium";
  }

  if (cores <= 4 || memory <= 4 || isWeakGpu(renderer)) return "low";
  if (cores <= 8 || memory <= 8) return "medium";
  return "high";
}

function budgetForTier(tier: PerfTier, reducedMotion: boolean): PerfBudget {
  // Hero look is non-negotiable on desktop: full-res UnrealBloom + radial pass.
  // Only the true "low" tier (weak iGPU / phones) may shrink the bloom chain.
  const base: Record<PerfTier, Omit<PerfBudget, "tier" | "reducedMotion">> = {
    low: {
      maxPixelRatio: 1,
      heroMaxPixelRatio: 1,
      bloomScale: 0.5,
      heroBloomScale: 0.5,
      radialPass: false,
      heroRadialPass: false,
      maxFps: 30,
      glassBlurPx: 8,
      // Sticky chrome only — menus that open take the slot via priority.
      maxLiveGlassFilters: 2,
      lava: false,
      glyphLavaSampling: false,
      svgGlassDisplacement: false,
      decorativeMotion: false,
    },
    medium: {
      maxPixelRatio: 1.5,
      heroMaxPixelRatio: 1.5,
      bloomScale: 1,
      heroBloomScale: 1,
      radialPass: true,
      heroRadialPass: true,
      maxFps: 60,
      glassBlurPx: SSR_GLASS_BLUR_PX,
      maxLiveGlassFilters: 4,
      // Lava stays on (it is part of the hero look) but the renderer drops its
      // internal resolution per tier — see LAVA_RESOLUTION_SCALE.
      lava: true,
      // Per-glyph lava tint samples the metaball field for every header letter —
      // left off: the visual win is tiny next to the main-thread cost on scroll.
      glyphLavaSampling: false,
      svgGlassDisplacement: false,
      decorativeMotion: true,
    },
    high: {
      maxPixelRatio: 1.5,
      heroMaxPixelRatio: 1.5,
      bloomScale: 1,
      heroBloomScale: 1,
      radialPass: true,
      heroRadialPass: true,
      // Frame cap; the pacer turns this into an even divisor of the display
      // rate (165 Hz → 82.5 fps, 144 → 72, 120 → 60) so cadence never judders.
      maxFps: 60,
      glassBlurPx: 22,
      // Header + composer + sidebar + one menu + a control lens. Beyond that
      // the MacBook Air GPU stays warm resampling SVG backdrop filters.
      maxLiveGlassFilters: 5,
      lava: true,
      glyphLavaSampling: false,
      // Refined below: off on Windows even for strong GPUs (CPU raster path).
      svgGlassDisplacement: true,
      decorativeMotion: true,
    },
  };

  const b = { ...base[tier] };

  // Phones: hero look matches desktop (full bloom + radial, 2.5× backing store).
  // Fill-rate is still below a 1.5× 1440p Mac — the CSS viewport is much smaller.
  // Other landing canvases keep the cheap `maxPixelRatio` / `bloomScale` caps.
  // Software GL stays on the tiny budget; it cannot afford 2× bloom.
  if (
    typeof window !== "undefined" &&
    isCoarsePointer() &&
    !readGpuInfo().software
  ) {
    b.heroMaxPixelRatio = 2.5;
    b.heroBloomScale = 1;
    b.heroRadialPass = true;
    b.maxFps = Math.min(b.maxFps, tier === "low" ? 30 : 45);
  }

  if (isWindowsPlatform()) {
    // Keep the hero glow / lava; drop the compositor taxes that hitch scroll.
    b.svgGlassDisplacement = false;
    b.decorativeMotion = false;
    b.glassBlurPx = Math.min(b.glassBlurPx, tier === "low" ? 8 : 12);
    b.maxLiveGlassFilters = Math.min(b.maxLiveGlassFilters, tier === "high" ? 3 : 2);
    if (tier === "low") b.maxFps = 30;
  }
  if (!reducedMotion) return { tier, reducedMotion, ...b };

  // Reduced motion: keep the visual material, drop the motion cost.
  return {
    tier,
    reducedMotion,
    ...b,
    maxFps: Math.min(b.maxFps, 30),
    lava: false,
    glyphLavaSampling: false,
    decorativeMotion: false,
  };
}

/**
 * Mirror the budget onto <html> so CSS can degrade without JS per element:
 *   html[data-perf-tier="low"] .grain { animation: none }
 */
function applyBudgetToDocument(budget: PerfBudget): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.perfTier = budget.tier;
  root.dataset.perfMotion = budget.decorativeMotion ? "full" : "reduced";
  root.dataset.perfOs = isWindowsPlatform() ? "windows" : "other";
  // Glass surfaces read this instead of hard-coding blur(22px): backdrop blur
  // cost grows with radius² × area, and a 22px radius on a dozen panels is
  // what makes Windows iGPUs drop frames while scrolling the landing.
  root.style.setProperty("--perf-glass-blur", `${budget.glassBlurPx}px`);
}

export function getPerfBudget(): PerfBudget {
  if (cachedBudget) return cachedBudget;
  if (typeof window === "undefined") {
    // SSR: assume the safe middle. React-managed attributes must not read
    // `glassBlurPx` / `tier` — those change after classify (medium 14 vs high 22)
    // and used to hydrate-mismatch LiquidGlass.
    cachedBudget = budgetForTier("medium", false);
    return cachedBudget;
  }
  let tier = classifyTier();
  for (let i = 0; i < runtimeDowngrades; i += 1) tier = downgrade(tier);
  cachedBudget = budgetForTier(tier, prefersReducedMotion());
  applyBudgetToDocument(cachedBudget);
  return cachedBudget;
}

function downgrade(tier: PerfTier): PerfTier {
  return tier === "high" ? "medium" : "low";
}

/**
 * Called by the FPS watchdog when frames are being missed consistently. Drops
 * one tier and invalidates the cache so the next `getPerfBudget()` reflects it.
 * Returns the new budget, or null when already at the floor.
 */
export function downgradePerfBudget(): PerfBudget | null {
  const current = getPerfBudget();
  if (current.tier === "low") return null;
  runtimeDowngrades += 1;
  cachedBudget = null;
  return getPerfBudget();
}

/** Test/debug helper — forget memoised detection. */
export function resetPerfBudget(): void {
  cachedBudget = null;
  runtimeDowngrades = 0;
}
