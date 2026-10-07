/**
 * Height profile of the glass bezel, normalised to x ∈ [0, 1] where 0 is the
 * outer edge of the bezel and 1 is where the flat centre of the pane begins.
 *
 * Vendored from ricardious/liquid-glass-sandbox (MIT). See ./LICENSE-vendor.md.
 */
export const SurfaceEquations = {
  convex_circle: (x: number) => Math.sqrt(1 - (1 - x) ** 2),
  convex_squircle: (x: number) => (1 - (1 - x) ** 4) ** (1 / 4),
  concave: (x: number) => 1 - Math.sqrt(1 - x ** 2),
  lip: (x: number) => {
    const convex = (1 - (1 - Math.min(x * 2, 1)) ** 4) ** (1 / 4);
    const concave = 1 - Math.sqrt(1 - (1 - x) ** 2) + 0.1;
    const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    return convex * (1 - smootherstep) + concave * smootherstep;
  },
};

export type LiquidSurfaceType = keyof typeof SurfaceEquations;
