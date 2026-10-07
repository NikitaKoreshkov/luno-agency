import type { LiquidGlassShape } from "@/components/liquid-glass-v2/liquidGlassAssets";
import type { LiquidSurfaceType } from "@/components/liquid-glass-v2/surfaceEquations";

/** Fixed optics — refraction / blur (not chrome). */
export type LabTopBarGlassOptics = {
  shape: LiquidGlassShape;
  radius: number;
  clipRadius: number;
  bezelWidth: number;
  useAutoBezel: boolean;
  bezelRatio: number;
  glassThickness: number;
  refractiveIndex: number;
  surface: LiquidSurfaceType;
  blur: number;
  saturation: number;
  refraction: number;
};

/** Visual shell: fill, border, inset around the stadium. */
export type LabTopBarGlassChrome = {
  tintAlpha: number;
  tintMode: "light" | "dark";
  showRim: boolean;
  rimAlpha: number;
  rimWidth: number;
  insetHighlight: number;
  insetShadow: number;
  sheen: number;
  specularAlpha: number;
};

export type LabTopBarGlassConfig = LabTopBarGlassOptics & LabTopBarGlassChrome;

export const LAB_TOPBAR_GLASS_OPTICS: LabTopBarGlassOptics = {
  shape: "stadium",
  radius: 0,
  clipRadius: 0,
  bezelWidth: 28,
  useAutoBezel: true,
  bezelRatio: 0.66,
  glassThickness: 130,
  refractiveIndex: 1.55,
  surface: "convex_squircle",
  blur: 1.5,
  saturation: 1.6,
  refraction: 1.45,
};

export const LAB_TOPBAR_GLASS_CHROME: LabTopBarGlassChrome = {
  tintAlpha: 0.045,
  tintMode: "dark",
  showRim: true,
  rimAlpha: 0.22,
  rimWidth: 0,
  insetHighlight: 0.28,
  insetShadow: 0.12,
  sheen: 0.16,
  specularAlpha: 0,
};

/** Paper analog: light fill, ink lip — the inverse of smoked glass on OLED. */
export const LAB_TOPBAR_GLASS_CHROME_LIGHT: LabTopBarGlassChrome = {
  tintAlpha: 0.28,
  tintMode: "light",
  showRim: true,
  rimAlpha: 0.14,
  rimWidth: 0,
  insetHighlight: 0.62,
  insetShadow: 0.1,
  sheen: 0.1,
  specularAlpha: 0,
};

export const LAB_TOPBAR_GLASS_CONFIG: LabTopBarGlassConfig = {
  ...LAB_TOPBAR_GLASS_OPTICS,
  ...LAB_TOPBAR_GLASS_CHROME,
};

export function chromeForAppTheme(
  theme: "light" | "dark",
): LabTopBarGlassChrome {
  return theme === "light"
    ? LAB_TOPBAR_GLASS_CHROME_LIGHT
    : LAB_TOPBAR_GLASS_CHROME;
}

export function resolveLabTopBarBezel(
  optics: LabTopBarGlassOptics,
  barHeight: number,
): number {
  const radius = Math.max(1, Math.round((optics.radius || barHeight) / 2));
  if (!optics.useAutoBezel) {
    return Math.max(1, Math.min(Math.round(optics.bezelWidth), radius - 2));
  }
  if (optics.shape === "stadium") {
    // Stadium map carves the bezel inside the end-cap radius.
    return Math.max(
      8,
      Math.min(radius - 2, Math.round(radius * optics.bezelRatio)),
    );
  }
  return Math.max(
    8,
    Math.min(48, Math.round(barHeight * optics.bezelRatio)),
  );
}

export function tintFromChrome(chrome: LabTopBarGlassChrome): string {
  const a = Math.max(0, Math.min(1, chrome.tintAlpha));
  return chrome.tintMode === "dark"
    ? `rgba(0,0,0,${a})`
    : `rgba(255,255,255,${a})`;
}

export function rimFromChrome(chrome: LabTopBarGlassChrome): string {
  const a = Math.max(0, Math.min(1, chrome.rimAlpha));
  return chrome.tintMode === "light"
    ? `rgba(20, 28, 24, ${a})`
    : `rgba(255, 255, 255, ${a})`;
}
