/**
 * Capability detection for the refraction glass.
 *
 * The displacement effect needs an SVG filter reference inside `backdrop-filter`.
 * Support is uneven and cannot be inferred from the user agent:
 *
 *  - Chromium: supports `backdrop-filter: url(#id)`.
 *  - Safari/WebKit: needs the `-webkit-` prefix.
 *  - Firefox: implements `backdrop-filter` but ignores SVG filter references in
 *    it, so requesting one silently drops the whole declaration — the surface
 *    would render as flat, untinted glass. Firefox therefore gets the blur-only
 *    path instead of a broken one.
 *
 * Detection is memoised: `CSS.supports` is cheap but this is read during render.
 */

export type GlassCapability = {
  /** Which property name to write, or null when backdrop blur is unavailable. */
  property: "backdrop-filter" | "-webkit-backdrop-filter" | null;
  /** Whether an `url(#id)` term inside that property actually takes effect. */
  displacement: boolean;
};

let cached: GlassCapability | null = null;

export function getGlassCapability(): GlassCapability {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof CSS === "undefined") {
    // SSR: assume blur-only so the markup never depends on client detection.
    return { property: null, displacement: false };
  }

  const standard = CSS.supports("backdrop-filter", "blur(4px)");
  const prefixed = CSS.supports("-webkit-backdrop-filter", "blur(4px)");
  const property = standard
    ? "backdrop-filter"
    : prefixed
      ? "-webkit-backdrop-filter"
      : null;

  // Gecko parses the url() term but never applies it. `CSS.supports` returns
  // true there, so probe the engine directly rather than trusting the parser.
  const isGecko =
    "mozInnerScreenX" in window ||
    /firefox|fxios/i.test(navigator.userAgent);

  // iOS Safari applies blur glassmorphism, but `backdrop-filter: url(#svg)`
  // displacement (liquid glass) is unreliable and often paints a dead plate.
  const appleTouch =
    /iPhone|iPod|iPad/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  cached = {
    property,
    displacement: property !== null && !isGecko && !appleTouch,
  };
  return cached;
}
