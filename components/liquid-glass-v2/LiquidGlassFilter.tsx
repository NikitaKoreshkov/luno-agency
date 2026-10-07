"use client";

import styles from "./LiquidGlass.module.css";

export type LiquidGlassFilterProps = {
  filterId: string;
  /**
   * Live glass box in CSS px (userSpaceOnUse). Must match the rendered element,
   * not the baked texture size — otherwise a wide header only refracts ~1024px
   * and the rest looks like flat blur.
   */
  width: number;
  height: number;
  displacementUrl: string;
  specularUrl: string;
  /** feDisplacementMap scale — peak lateral shift in px. */
  scale: number;
  blurStdDev: number;
  saturation: number;
  specularAlpha: number;
  /**
   * Chromatic aberration on the bezel only. The lens interior stays a single
   * displacement pass — splitting the whole scene turns labels into RGB ghosts.
   * 0 skips the extra passes entirely.
   */
  chroma?: number;
  /**
   * Kept for callers. Rim chroma is always clipped to the unsplit silhouette
   * so fringes cannot leak outside the capsule.
   */
  chromaClip?: boolean;
  /** Soft scattering around the specular edge (thicker-material look). */
  glow?: number;
};

/** Colour only — alpha stays on the mid-band so adding R/B does not triple it. */
const CHANNEL_COLOR = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 0",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 0",
} as const;
const CHANNEL_GREEN =
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0";

/**
 * The refraction filter chain, one `<svg>` per surface.
 *
 * Pipeline: blur the backdrop, bend it through the baked displacement map,
 * re-saturate (refraction desaturates), then screen the specular rim on top.
 *
 * Every parameter is a plain attribute rather than an imperative
 * `setAttribute` call, so React owns the DOM and there is no per-frame
 * `document.getElementById` lookup like the upstream demo used.
 */
export function LiquidGlassFilter({
  filterId,
  width,
  height,
  displacementUrl,
  specularUrl,
  scale,
  blurStdDev,
  saturation,
  specularAlpha,
  chroma = 0,
  glow = 0,
}: LiquidGlassFilterProps) {
  const dispersed = chroma > 0.001;
  /**
   * A surface can ask for no specular rim at all (the lab sticky bars do). The
   * layer would then be composited at zero alpha — invisible, but still a second
   * `feImage` to sample, a transfer function and a blend, all per pixel of the
   * region. On a full-width bar that the compositor re-filters on every frame of
   * every scroll, dropping the branch is free performance: the saturate pass
   * becomes the filter's output and the result is identical.
   */
  const lit = specularAlpha > 0.001;
  const peakScale = dispersed ? scale * (1 + chroma) : scale;
  // Displacement shifts by at most scale/2; the glow blurs about 3σ further.
  // SliderExhibit uses x/y="-50%" width/height="200%" so the warped edge is
  // not clipped before CSS radius-clip. A tight pad on a 40×26 thumb stairs.
  const exhibitPad =
    width < 420 || height < 96
      ? Math.ceil(Math.max(width, height) * 0.5)
      : 0;
  const pad =
    Math.max(
      exhibitPad,
      Math.ceil(peakScale / 2 + (glow > 0.001 ? glow * 18 : 0)) + 10,
    );
  const dpr =
    typeof window !== "undefined"
      ? Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      : 1;
  // Safari otherwise rasterises large SVG filters at ~1× and the lens looks
  // like a stretched low-res texture. Chrome ignores `filterRes`.
  const filterRes = `${Math.round((width + pad * 2) * dpr)} ${Math.round(
    (height + pad * 2) * dpr,
  )}`;

  return (
    <svg className={styles.filterHost} aria-hidden="true" focusable="false">
      <defs>
        {/*
          The region only needs room for the displaced edge plus the glow's
          spread — a few px. Sized in user space rather than as a percentage of
          the box, because a percentage makes every pass cost four times the
          element's area on a large panel, and each pass is per-pixel work. Too
          tight and the bezel shows a hard seam, hence the padding.
        */}
        <filter
          id={filterId}
          filterUnits="userSpaceOnUse"
          x={-pad}
          y={-pad}
          width={width + pad * 2}
          height={height + pad * 2}
          filterRes={filterRes}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blurStdDev}
            result="blurred"
          />
          <feImage
            href={displacementUrl}
            xlinkHref={displacementUrl}
            x="0"
            y="0"
            width={width}
            height={height}
            result="displacementMap"
            preserveAspectRatio="none"
          />

          {dispersed ? (
            <>
              {/* Interior of the lens: one warp, so labels stay a single colour. */}
              <feDisplacementMap
                in="blurred"
                in2="displacementMap"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="warped"
              />
              {/*
                Displacement maps store 128 as “no shift”. Fold R/G around 0.5
                so the bezel lights up and the flat centre stays black.
              */}
              <feComponentTransfer in="displacementMap" result="folded">
                <feFuncR type="table" tableValues="1 0 1" />
                <feFuncG type="table" tableValues="1 0 1" />
                <feFuncB type="discrete" tableValues="0" />
                <feFuncA type="discrete" tableValues="1" />
              </feComponentTransfer>
              <feColorMatrix
                in="folded"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 0 0 0"
                result="bezelRaw"
              />
              {/* Keep only the outer rim — inner bezel still overlaps the type. */}
              <feComponentTransfer in="bezelRaw" result="bezelMask">
                <feFuncA type="table" tableValues="0 0 0 0 0.04 0.2 0.62 1" />
              </feComponentTransfer>
              <feDisplacementMap
                in="blurred"
                in2="displacementMap"
                scale={scale * (1 + chroma)}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced-r"
              />
              <feDisplacementMap
                in="blurred"
                in2="displacementMap"
                scale={scale * (1 - chroma)}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced-b"
              />
              <feColorMatrix
                in="displaced-r"
                type="matrix"
                values={CHANNEL_COLOR.r}
                result="channel-r"
              />
              <feColorMatrix
                in="warped"
                type="matrix"
                values={CHANNEL_GREEN}
                result="channel-g"
              />
              <feColorMatrix
                in="displaced-b"
                type="matrix"
                values={CHANNEL_COLOR.b}
                result="channel-b"
              />
              <feComposite
                in="channel-r"
                in2="channel-g"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="1"
                k4="0"
                result="channel-rg"
              />
              <feComposite
                in="channel-rg"
                in2="channel-b"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="1"
                k4="0"
                result="splitRgb"
              />
              <feComposite
                in="splitRgb"
                in2="bezelMask"
                operator="in"
                result="fringe"
              />
              <feComposite
                in="fringe"
                in2="warped"
                operator="over"
                result="combined"
              />
              {/* Never let R/B silhouettes paint outside the capsule. */}
              <feComposite
                in="combined"
                in2="warped"
                operator="in"
                result="displaced"
              />
            </>
          ) : (
            <feDisplacementMap
              in="blurred"
              in2="displacementMap"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
          )}

          <feColorMatrix
            in="displaced"
            type="saturate"
            values={String(saturation)}
            result="displacedSaturated"
          />
          {lit ? (
            <>
              <feImage
                href={specularUrl}
                xlinkHref={specularUrl}
                x="0"
                y="0"
                width={width}
                height={height}
                result="specularLayer"
                preserveAspectRatio="none"
              />
              <feComponentTransfer in="specularLayer" result="specularFaded">
                <feFuncA type="linear" slope={specularAlpha} />
              </feComponentTransfer>
              {glow > 0.001 ? (
                <>
                  {/* Larger glass scatters light more softly around its edge. */}
                  <feGaussianBlur
                    in="specularFaded"
                    stdDeviation={glow * 6}
                    result="specularBloom"
                  />
                  <feComposite
                    in="specularFaded"
                    in2="specularBloom"
                    operator="arithmetic"
                    k1="0"
                    k2="1"
                    k3="0.6"
                    k4="0"
                    result="specularLit"
                  />
                </>
              ) : null}
              <feBlend
                in={glow > 0.001 ? "specularLit" : "specularFaded"}
                in2="displacedSaturated"
                mode="screen"
              />
            </>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
}
