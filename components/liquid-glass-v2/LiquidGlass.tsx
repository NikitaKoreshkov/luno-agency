"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { getPerfBudget, prefersReducedMotion } from "@/lib/perf/deviceTier";
import { claimGlassLiveSlot } from "@/lib/glass/glassLiveBudget";
import {
  observeGlassBox,
  observeGlassVisibility,
} from "@/lib/glass/glassObservers";
import { usePointerSheen } from "@/lib/glass/usePointerSheen";
import { getGlassCapability } from "./glassSupport";
import { LiquidGlassFilter } from "./LiquidGlassFilter";
import {
  ensureLiquidAssets,
  peekLiquidAssets,
  requestLiquidAssets,
  type LiquidGlassAssets,
  type LiquidGlassBezelEdges,
  type LiquidGlassConfig,
  type LiquidGlassShape,
} from "./liquidGlassAssets";
import type { LiquidSurfaceType } from "./surfaceEquations";
import styles from "./LiquidGlass.module.css";

/**
 * `regular` — the workhorse: adaptive, more blur, legible over anything.
 * `clear`   — far more transparent, for media-rich backdrops; needs a dimming
 *             layer underneath to keep controls readable (per HIG).
 */
export type LiquidGlassVariant = "regular" | "clear";

export type LiquidGlassProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Corner radius in px. Also applied as the element's own border-radius. */
  radius?: number;
  /** Width of the refracting bezel band in px. */
  bezelWidth?: number;
  /** Virtual glass thickness — larger bends the backdrop further. */
  glassThickness?: number;
  /** Index of refraction. 1.5 ≈ crown glass, 1.33 ≈ water. */
  refractiveIndex?: number;
  surface?: LiquidSurfaceType;
  /** Backdrop blur inside the filter chain. */
  blur?: number;
  saturation?: number;
  specularAlpha?: number;
  /** Multiplier on the displacement scale. 1 = physically derived peak. */
  refraction?: number;
  /** Per-channel dispersion along the bezel. 0 = single displacement pass. */
  chroma?: number;
  /**
   * Kept for callers. Fringes are always clipped to the unsplit silhouette.
   */
  chromaClip?: boolean;
  /** Soft bloom around the specular edge. */
  glow?: number;
  /** Translucent fill over the refracted backdrop. */
  tint?: string;
  rimColor?: string;
  /**
   * Lab / preview: ignore perf-tier gate so refraction always tries to run
   * (still falls back to flat blur on Firefox / no-backdrop engines).
   */
  forceRefraction?: boolean;
  /** True once displacement maps are on and the host is in view. */
  onActiveChange?: (active: boolean) => void;
  /**
   * Visual clip radius. Defaults to `radius` (map geometry). Pass `0` for a
   * square sticky bar while keeping a non-zero map radius for edge refraction.
   */
  clipRadius?: number;
  /** Draw the CSS inset rim / border. Off for square lab chrome. */
  showRim?: boolean;
  /**
   * Where the CSS rim / sheen draws.
   * `y` = top + bottom only (lab sticky headers).
   */
  rimEdges?: "all" | "y";
  /**
   * Where the displacement bezel bends the backdrop.
   * `y` = top + bottom only — no side warp on a full-width header.
   */
  bezelEdges?: LiquidGlassBezelEdges;
  /**
   * `stadium` (default) — rounded/pill displacement.
   * `rect` — square chrome with deep straight-edge bezel (lab headers).
   */
  shape?: LiquidGlassShape;
  variant?: LiquidGlassVariant;
  /**
   * Fades the refracted layer toward the raw backdrop. Lets a control sitting
   * on another glass surface stay flat at rest and lift into a real lens only
   * while it is hovered or pressed, instead of stacking two live materials.
   */
  lensOpacity?: number;
  /**
   * Entrance / exit opacity for the whole material.
   *
   * Use this instead of animating `opacity` on the surface or any of its
   * ancestors. An ancestor with `opacity < 1` — or just `will-change: opacity` —
   * is a Backdrop Root, which cuts `backdrop-filter` off from the page and makes
   * the material vanish for the duration of the fade (or permanently, in the
   * `will-change` case). This prop fades each layer on its own instead.
   *
   * It is plumbed as the inheritable `--lg-surface-opacity` custom property, so
   * an animation library can tween that variable on any wrapper and every layer
   * follows without a React re-render.
   */
  surfaceOpacity?: number;
  /**
   * Content to bend *inside* the lens instead of sampling what is behind it.
   *
   * This is how a switch thumb or a segmented indicator works: it carries a
   * copy of the track fill, and the lens bends that copy, which reads as a
   * highlight travelling through glass. It also runs where `backdrop-filter`
   * with an SVG filter does not (WebKit, Gecko), because the filter applies to
   * the element's own pixels.
   */
  refractionTarget?: ReactNode;
  /** Sample the real backdrop. Defaults off when `refractionTarget` is given. */
  backdrop?: boolean;
  /**
   * CSS blur radius for the backdrop, in px — the *material's* frost, as opposed
   * to `blur`, which only softens the source inside the filter chain. A menu
   * floating over a busy grid needs plenty of it to stay legible; a header over
   * its own list needs almost none.
   */
  backdropBlur?: number;
  /**
   * Ceiling on the displacement, in px. The physical peak comes out of the glass
   * thickness, which on a control-sized lens can exceed the lens itself — the
   * fill then gets thrown clear of the glass instead of bowed inside it. Cap it
   * near the bezel width, which is as far as light entering the bezel can bend.
   */
  maxDisplacement?: number;
  /**
   * Light the material from within, anchored under the pointer — Apple's
   * "illuminates from within, starting under your fingertips".
   */
  illuminate?: boolean;
  /**
   * Bake displacement at this size instead of the live box. The filter region
   * still follows the element; `feImage` stretches the map. Use when a panel
   * will grow (accordion) so the bezel never swaps from a stretched-small map
   * to a freshly baked tall one — that swap is a hard cut.
   */
  mapSize?: { width: number; height: number };
  /**
   * Ignore live-size cache hits and ResizeObserver bakes. Pair with `mapSize`.
   * While `mapSize` is still unknown, hold off baking so the first paint is
   * already the destination geometry.
   */
  lockMapSize?: boolean;
  /**
   * Bake maps in this layout turn instead of the idle queue. Setup plates use
   * it so the first paint is already refracted — no “glass turning on” fade.
   */
  urgent?: boolean;
  /**
   * Keep the last filter on (covered by a modal, etc.). Skip visibility
   * detach and new bakes so closing the overlay does not replay the intro.
   */
  hold?: boolean;
};

/** Measured box, rounded to whole px — subpixel changes must not retrigger. */
type Box = { width: number; height: number };

const EMPTY_BOX: Box = { width: 0, height: 0 };

/**
 * How long the box has to hold still before a new map is baked. Long enough to
 * sit out an open/close animation, short enough to feel immediate after a drag.
 * The stale map keeps rendering meanwhile, stretched by `feImage`.
 */
const RESIZE_SETTLE_MS = 140;

/**
 * Live filter-region quantum. Maps already bake on an 8px grid. A 4px live
 * region still rebuilt the SVG filter several times during a 12px sidebar
 * swell, which read as a snap on the rim even though the capsule interpolated.
 */
const LIVE_BOX_QUANTUM = 8;

function quantiseLive(value: number): number {
  return Math.max(
    0,
    Math.round(value / LIVE_BOX_QUANTUM) * LIVE_BOX_QUANTUM,
  );
}

export function LiquidGlass({
  children,
  className,
  style,
  radius = 28,
  bezelWidth = 24,
  glassThickness = 110,
  refractiveIndex = 1.5,
  surface = "convex_squircle",
  blur = 0.5,
  saturation = 1.35,
  specularAlpha = 0.8,
  refraction = 1,
  chroma = 0,
  chromaClip = true,
  glow = 0,
  tint,
  rimColor,
  forceRefraction = false,
  clipRadius,
  showRim = true,
  rimEdges = "all",
  bezelEdges = "all",
  shape = "stadium",
  variant = "regular",
  lensOpacity = 1,
  surfaceOpacity,
  illuminate = false,
  refractionTarget,
  backdrop = refractionTarget === undefined,
  backdropBlur,
  maxDisplacement,
  mapSize,
  lockMapSize = false,
  onActiveChange,
  urgent = false,
  hold = false,
}: LiquidGlassProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const refractRef = useRef<HTMLDivElement>(null);
  /**
   * `liveBox` tracks the host every frame so the filter region and feImage stay
   * locked to the capsule while width/height animate. `bakeBox` only advances
   * after the size settles — baking a map per animation frame is what used to
   * hitch the main thread on panel opens.
   */
  const [liveBox, setLiveBox] = useState<Box>(EMPTY_BOX);
  const [bakeBox, setBakeBox] = useState<Box>(EMPTY_BOX);
  const [assets, setAssets] = useState<LiquidGlassAssets | null>(null);
  /**
   * Off-screen surfaces drop the SVG filter chain entirely. Default true so the
   * first paint after mount doesn't flash flat-then-refract while the observer
   * boots; crossings then toggle without touching scroll frames.
   */
  const [inView, setInView] = useState(true);
  /**
   * Soft cap from `maxLiveGlassFilters`. Over-budget surfaces stay glass-looking
   * (blur + tint) without a live SVG pass. Sticky/urgent plates keep priority
   * so scroll-through liquid glass stays live on chrome panels.
   */
  const [liveAllowed, setLiveAllowed] = useState(true);

  // Stable, SSR-safe unique id — filter ids must not collide across instances.
  // Prefix with a letter: pure-digit ids are invalid in SVG / URL fragments.
  const rawId = useId();
  const baseId = useMemo(
    () => `lgv2-${rawId.replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`,
    [rawId],
  );

  // Safari caches a filter by id and will keep showing the previous
  // displacement texture after a resize, so every new map gets a new id.
  const generation = useRef(0);
  const lastMapUrl = useRef<string | null>(null);
  if (assets && assets.displacementUrl !== lastMapUrl.current) {
    lastMapUrl.current = assets.displacementUrl;
    generation.current += 1;
  }
  const filterId = `${baseId}-${generation.current}`;

  const capability = getGlassCapability();
  const budget = getPerfBudget();

  // Displacement is skipped on weak devices and in reduced-motion mode: the
  // filter chain is the expensive part, and the flat blur reads acceptably.
  // Content refraction is exempt from the engine check — bending an element's
  // own pixels is a plain `filter`, which every browser supports.
  const engineCanRefract =
    capability.displacement || refractionTarget !== undefined;
  const wantsDisplacement =
    engineCanRefract &&
    (forceRefraction || (budget.tier !== "low" && !budget.reducedMotion));

  // Specular rim PNG is skipped when the filter never samples it.
  const includeSpecular = specularAlpha > 0.001 || glow > 0.001;

  // Live refraction only while near the viewport — sticky bars stay hot.
  // `hold` keeps the last filter while a modal covers this surface.
  useEffect(() => {
    if (hold) {
      setInView(true);
      return;
    }
    const host = hostRef.current;
    if (!host || !wantsDisplacement) return;
    return observeGlassVisibility(host, setInView);
  }, [wantsDisplacement, hold]);

  // Soft concurrent budget — urgent/sticky chrome wins slots over idle lenses.
  // Scroll does NOT freeze refraction: see-through liquid glass is the point.
  // useLayoutEffect so `closest` sees the overlay host before the first claim.
  useLayoutEffect(() => {
    if (!wantsDisplacement || !(inView || hold)) {
      setLiveAllowed(true);
      return;
    }
    const overlayHost = hostRef.current?.closest("[data-glass-overlay-host]");
    const layer = overlayHost ? "overlay" : "page";
    // Overlay chrome (header, travelling rail, segmented) must all stay live:
    // a sticky page header used to starve the modal nav lens.
    const priority = overlayHost
      ? 90
      : urgent
        ? 90
        : hold
          ? 80
          : forceRefraction
            ? 55
            : 25;
    return claimGlassLiveSlot(baseId, priority, setLiveAllowed, layer);
  }, [wantsDisplacement, inView, hold, urgent, forceRefraction, baseId]);

  // ── Measure ─────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !wantsDisplacement) return;

    let settle = 0;
    let baked = false;

    // A shared ResizeObserver rather than one per surface: it still fires only
    // when *this* element changes and still reports the size without a
    // getBoundingClientRect call (so no forced layout), but a page full of glass
    // ends up with one observer instead of dozens.
    const stop = observeGlassBox(host, (next) => {
      // Always keep the filter region on the live box. If we wait for settle,
      // a travelling segmented pill keeps the old map's coordinate space while
      // its CSS width has already moved — the white/green fills then hang past
      // the capsule or lag behind it.
      const live = {
        width: quantiseLive(next.width),
        height: quantiseLive(next.height),
      };
      setLiveBox((prev) =>
        prev.width === live.width && prev.height === live.height ? prev : live,
      );

      const bake = (box: Box = next) => {
        baked = true;
        setBakeBox((prev) =>
          prev.width === box.width && prev.height === box.height ? prev : box,
        );
      };

      // Accordion / morphing plates pass a destination `mapSize` so the bezel
      // never rebakes at the end of a height tween (stretched map → new map).
      if (lockMapSize) {
        if (mapSize && mapSize.width >= 16 && mapSize.height >= 16) {
          bake(mapSize);
        }
        return;
      }

      // First size bakes immediately so there is something to show. Later sizes
      // wait for the box to hold still — a panel animating its height would
      // otherwise encode a PNG on every frame.
      if (!baked) {
        if (next.width >= 16 && next.height >= 8) bake();
        return;
      }

      // Morphing capsules (mode switch) prewarm rest/travel. When the live size
      // already has a map, adopt it immediately — waiting for RESIZE_SETTLE_MS
      // leaves a stretched travel map on the landed rest pill (double edge).
      const probe: LiquidGlassConfig = {
        width: next.width,
        height: next.height,
        radius,
        bezelWidth,
        glassThickness,
        refractiveIndex,
        surface,
        shape,
        bezelEdges,
        includeSpecular,
      };
      if (peekLiquidAssets(probe)) {
        window.clearTimeout(settle);
        bake();
        return;
      }

      window.clearTimeout(settle);
      settle = window.setTimeout(bake, RESIZE_SETTLE_MS);
    });
    return () => {
      window.clearTimeout(settle);
      stop();
    };
  }, [
    wantsDisplacement,
    radius,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    surface,
    shape,
    bezelEdges,
    includeSpecular,
    lockMapSize,
    mapSize?.width,
    mapSize?.height,
  ]);

  useLayoutEffect(() => {
    if (!lockMapSize || !mapSize) return;
    if (mapSize.width < 16 || mapSize.height < 16) return;
    setBakeBox((prev) =>
      prev.width === mapSize.width && prev.height === mapSize.height
        ? prev
        : mapSize,
    );
  }, [lockMapSize, mapSize?.width, mapSize?.height]);

  const config = useMemo<LiquidGlassConfig | null>(() => {
    if (lockMapSize && (!mapSize || mapSize.width < 16 || mapSize.height < 16)) {
      return null;
    }
    if (!wantsDisplacement || bakeBox.width < 16 || bakeBox.height < 16) {
      return null;
    }
    return {
      width: bakeBox.width,
      height: bakeBox.height,
      radius,
      bezelWidth,
      glassThickness,
      refractiveIndex,
      surface,
      shape,
      bezelEdges,
      includeSpecular,
    };
  }, [
    wantsDisplacement,
    lockMapSize,
    mapSize,
    bakeBox.width,
    bakeBox.height,
    radius,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    surface,
    shape,
    bezelEdges,
    includeSpecular,
  ]);

  // Prefer the live box for the filter's user-space region; fall back to the
  // bake box before the first observation lands.
  const filterBox =
    liveBox.width > 0 && liveBox.height > 0 ? liveBox : bakeBox;

  // ── Generate maps ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!config) {
      if (!hold) setAssets(null);
      return;
    }
    const ready = peekLiquidAssets(config);
    if (ready) {
      setAssets(ready);
      return;
    }
    if (hold) return;
    if (urgent) {
      try {
        setAssets(ensureLiquidAssets(config));
      } catch {
        setAssets(null);
      }
      return;
    }
    let active = true;
    requestLiquidAssets(config)
      .then((next) => {
        if (active) setAssets(next);
      })
      .catch(() => {
        if (active) setAssets(null);
      });
    return () => {
      active = false;
    };
  }, [config, urgent, hold]);

  // While the host is mid-animation, the bake box is still frozen — but if a
  // prewarmed map already exists for the *live* size (each segment width in a
  // variable segmented control), swap to it immediately so the fill snaps to
  // the capsule instead of riding a stretched map until settle.
  useEffect(() => {
    if (lockMapSize) return;
    if (!wantsDisplacement || liveBox.width < 16 || liveBox.height < 16) return;
    if (
      liveBox.width === bakeBox.width &&
      liveBox.height === bakeBox.height
    ) {
      return;
    }
    const probe: LiquidGlassConfig = {
      width: liveBox.width,
      height: liveBox.height,
      radius,
      bezelWidth,
      glassThickness,
      refractiveIndex,
      surface,
      shape,
      bezelEdges,
      includeSpecular,
    };
    const hit = peekLiquidAssets(probe);
    if (!hit) return;
    setAssets(hit);
    setBakeBox((prev) =>
      prev.width === liveBox.width && prev.height === liveBox.height
        ? prev
        : { width: liveBox.width, height: liveBox.height },
    );
  }, [
    lockMapSize,
    wantsDisplacement,
    liveBox.width,
    liveBox.height,
    bakeBox.width,
    bakeBox.height,
    radius,
    bezelWidth,
    glassThickness,
    refractiveIndex,
    surface,
    shape,
    bezelEdges,
    includeSpecular,
  ]);

  // ── Apply the backdrop filter ───────────────────────────────────────────
  // WebKit needs (1) an absolute page#id URL and (2) both -webkit- and standard
  // properties. Relative `url(#id)` alone is why the header attempt looked dead.
  //
  // Refraction stays live during scroll — that is the material. Cost is cut by
  // lazy control lenses (armed only on press), unmounting closed popovers, and
  // a soft concurrent live-slot budget for non-urgent surfaces.
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const urgentRef = useRef(urgent);
  urgentRef.current = urgent;

  useEffect(() => {
    const node = backdropRef.current;
    if (!node) return;

    const clear = () => {
      for (const prop of [
        "filter",
        "-webkit-filter",
        "backdrop-filter",
        "-webkit-backdrop-filter",
      ] as const) {
        node.style.removeProperty(prop);
      }
    };

    const keepFilter = holdRef.current || urgentRef.current;

    if (
      !assets ||
      !wantsDisplacement ||
      !capability.property ||
      !backdrop ||
      !(inView || hold)
    ) {
      if (!keepFilter) clear();
      return;
    }

    // Companion blur: the frost of the material itself. Also what keeps the pane
    // reading as glass while the map settles, and on engines that honour only one
    // of the two properties.
    //
    // Deliberately blur-only. The SVG chain already ends in a `saturate` pass, so
    // adding one here squared it (1.24 → ~1.54) and any colour in the page behind
    // the surface bloomed through the glass — which is what tinted every panel in
    // the analytics lab green, on top of its mint/forest ambient glows.
    const companionBlur =
      backdropBlur ?? (variant === "clear" ? blur : Math.max(2, blur * 2));

    // Over-budget (non-urgent) surfaces keep frost + tint without SVG.
    // Urgent / sticky chrome always keeps liquid scroll-through.
    if (!liveAllowed && !urgent && !hold) {
      const frost = `blur(${Math.max(companionBlur, budget.glassBlurPx * 0.4)}px)`;
      node.style.removeProperty("filter");
      node.style.removeProperty("-webkit-filter");
      node.style.setProperty("backdrop-filter", frost);
      node.style.setProperty("-webkit-backdrop-filter", frost);
      return () => {
        if (!keepFilter) clear();
      };
    }

    const pageUrl = window.location.href.split("#")[0];
    const filterUrl = `url("${pageUrl}#${filterId}")`;
    const liquidBackdrop = `${filterUrl} blur(${companionBlur}px)`;

    node.style.setProperty("filter", filterUrl);
    node.style.setProperty("-webkit-filter", filterUrl);
    node.style.setProperty("backdrop-filter", liquidBackdrop);
    node.style.setProperty("-webkit-backdrop-filter", liquidBackdrop);

    return () => {
      if (!keepFilter) clear();
    };
  }, [
    assets,
    backdrop,
    backdropBlur,
    blur,
    budget.glassBlurPx,
    capability.property,
    filterId,
    hold,
    inView,
    liveAllowed,
    urgent,
    variant,
    wantsDisplacement,
  ]);

  // Content refraction. Unlike the backdrop path this is a plain `filter`, so it
  // needs no engine capability check — every browser bends an element's own
  // pixels. Still an absolute URL: WebKit resolves `url(#id)` against the
  // document base, not the current page.
  useEffect(() => {
    const node = refractRef.current;
    if (!node) return;

    const clear = () => {
      node.style.removeProperty("filter");
      node.style.removeProperty("-webkit-filter");
    };

    const keepFilter = holdRef.current || urgentRef.current;

    if (
      !assets ||
      !refractionTarget ||
      !(inView || hold) ||
      (!liveAllowed && !urgent && !hold)
    ) {
      if (!keepFilter) clear();
      return;
    }

    const pageUrl = window.location.href.split("#")[0];
    const filterUrl = `url("${pageUrl}#${filterId}")`;
    node.style.setProperty("filter", filterUrl);
    node.style.setProperty("-webkit-filter", filterUrl);

    return () => {
      if (!keepFilter) clear();
    };
  }, [assets, filterId, hold, inView, liveAllowed, refractionTarget, urgent]);

  // Pointer-anchored illumination. Written straight to CSS vars: a state update
  // per pointermove would re-render the whole subtree at input frequency.
  //
  // Eased rather than pinned to the cursor: the highlight is a body of light
  // inside a thick pane, so it has to trail the pointer and settle. Snapping it
  // to the exact cursor position is what makes the effect read as a spotlight
  // held against the surface.
  const sheen = usePointerSheen(hostRef, {
    xVar: "--lg-glow-x",
    yVar: "--lg-glow-y",
    reduced: prefersReducedMotion(),
  });

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      sheen.anchor(event);
    },
    [sheen],
  );

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      sheen.anchor(event, true);
    },
    [sheen],
  );

  const active = assets !== null && wantsDisplacement && (inView || hold);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const rootStyle: CSSProperties = {
    borderRadius: clipRadius ?? (shape === "rect" ? 0 : radius),
    ...(tint ? ({ "--lg-tint": tint } as CSSProperties) : null),
    ...(rimColor ? ({ "--lg-rim": rimColor } as CSSProperties) : null),
    ...(lensOpacity !== 1
      ? ({ "--lg-lens-opacity": String(lensOpacity) } as CSSProperties)
      : null),
    ...(surfaceOpacity !== undefined
      ? ({ "--lg-surface-opacity": String(surfaceOpacity) } as CSSProperties)
      : null),
    ...style,
  };

  return (
    <div
      ref={hostRef}
      className={[
        styles.root,
        active ? "" : styles.flat,
        variant === "clear" ? styles.clear : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={rootStyle}
      onPointerMove={illuminate ? handlePointerMove : undefined}
      onPointerEnter={illuminate ? handlePointerEnter : undefined}
      onPointerLeave={illuminate ? sheen.release : undefined}
    >
      {active && assets && filterBox.width > 0 && filterBox.height > 0 ? (
        <LiquidGlassFilter
          filterId={filterId}
          width={filterBox.width}
          height={filterBox.height}
          displacementUrl={assets.displacementUrl}
          specularUrl={assets.specularUrl}
          scale={Math.min(
            assets.maximumDisplacement * refraction,
            maxDisplacement ?? Number.POSITIVE_INFINITY,
          )}
          blurStdDev={blur}
          saturation={saturation}
          specularAlpha={specularAlpha}
          chroma={chroma}
          chromaClip={chromaClip}
          glow={glow}
        />
      ) : null}
      {backdrop ? (
        <div ref={backdropRef} className={styles.backdrop} aria-hidden="true" />
      ) : null}
      {refractionTarget ? (
        // Two nested layers on purpose. The inner one owns the filter, so the map
        // lines up with the lens box rather than with the oversized copy inside
        // it; the outer one clips, because a filter's output is not bounded by the
        // filtered element — displaced pixels would otherwise land outside the
        // glass as a duplicate of the fill.
        <div className={styles.refractClip} aria-hidden="true">
          <div ref={refractRef} className={styles.refract}>
            {refractionTarget}
          </div>
        </div>
      ) : null}
      <div className={styles.tint} aria-hidden="true" />
      {illuminate ? <div className={styles.glow} aria-hidden="true" /> : null}
      {showRim ? (
        <div
          className={[styles.rim, rimEdges === "y" ? styles.rimY : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />
      ) : null}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
