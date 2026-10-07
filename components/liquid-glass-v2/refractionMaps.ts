/**
 * Refraction + specular map generation for the liquid-glass surface.
 *
 * Vendored from ricardious/liquid-glass-sandbox (MIT), with the pixel loops
 * narrowed to the bezel band only — the original walked every pixel of the
 * pane, but the centre is always neutral (128,128,0,255), so on a large panel
 * the vast majority of iterations wrote a constant. Restricting the scan to the
 * bezel makes generation roughly proportional to the perimeter instead of the
 * area, which matters because this runs on the main thread.
 *
 * See ./LICENSE-vendor.md.
 */

/**
 * 1-D refraction profile across the bezel. Applies Snell's law for the given
 * index of refraction to the surface normal at each sample, then projects the
 * refracted ray onto the back face of the glass to get a lateral offset.
 */
export function calculateDisplacementMap1D(
  glassThickness: number,
  bezelWidth: number,
  surfaceFn: (x: number) => number,
  refractiveIndex: number,
  samples = 128,
): number[] {
  const eta = 1 / refractiveIndex;

  function refract(
    normalX: number,
    normalY: number,
  ): [number, number] | null {
    const dot = normalY;
    const k = 1 - eta * eta * (1 - dot * dot);
    // Total internal reflection — no refracted ray exists.
    if (k < 0) return null;
    const kSqrt = Math.sqrt(k);
    return [
      -(eta * dot + kSqrt) * normalX,
      eta - (eta * dot + kSqrt) * normalY,
    ];
  }

  const result: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const x = i / samples;
    const y = surfaceFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = surfaceFn(Math.max(0, Math.min(1, x + dx)));
    const derivative = (y2 - y) / dx;
    const magnitude = Math.sqrt(derivative * derivative + 1);
    const refracted = refract(-derivative / magnitude, -1 / magnitude);

    if (!refracted) {
      result.push(0);
      continue;
    }
    const remainingHeight = y * bezelWidth + glassThickness;
    result.push(refracted[0] * (remainingHeight / refracted[1]));
  }
  return result;
}

/** Neutral displacement: R=128 (no x shift), G=128 (no y shift), opaque. */
function fillNeutral(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

/**
 * Write one computed displacement into all four quadrants at once.
 *
 * A rounded rectangle has four-fold symmetry, so only the top-left quadrant is
 * ever computed: mirroring across the vertical axis negates the X shift, across
 * the horizontal axis the Y shift. That cuts the per-pixel work to a quarter,
 * which is what keeps generation inside a frame when a panel is animating.
 */
function writeQuad(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  dX: number,
  dY: number,
): void {
  const mx = width - 1 - x;
  const my = height - 1 - y;
  const r = 128 + dX;
  const g = 128 + dY;
  const rMirror = 128 - dX;
  const gMirror = 128 - dY;

  let idx = (y * width + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;

  // Guard the centre row / column of an odd-sized map against a double write.
  if (mx !== x) {
    idx = (y * width + mx) * 4;
    data[idx] = rMirror;
    data[idx + 1] = g;
  }
  if (my !== y) {
    idx = (my * width + x) * 4;
    data[idx] = r;
    data[idx + 1] = gMirror;
    if (mx !== x) {
      idx = (my * width + mx) * 4;
      data[idx] = rMirror;
      data[idx + 1] = gMirror;
    }
  }
}

/**
 * The specular pass only has point symmetry, not four-fold: the light arrives
 * from one direction, so mirroring a single axis would move the highlight.
 */
function writeMirrored(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: number,
  alpha: number,
): void {
  let idx = (y * width + x) * 4;
  data[idx] = color;
  data[idx + 1] = color;
  data[idx + 2] = color;
  data[idx + 3] = alpha;

  const mx = width - 1 - x;
  const my = height - 1 - y;
  if (mx === x && my === y) return;
  idx = (my * width + mx) * 4;
  data[idx] = color;
  data[idx + 1] = color;
  data[idx + 2] = color;
  data[idx + 3] = alpha;
}

/**
 * Corner-relative coordinates. Straight edges collapse to a single axis, so the
 * same radial maths covers both the rounded corners and the flat sides.
 */
function cornerOffset(
  v: number,
  size: number,
  radius: number,
  betweenRadiuses: number,
): number {
  if (v < radius) return v - radius;
  if (v >= size - radius) return v - radius - betweenRadiuses;
  return 0;
}

export function calculateDisplacementMap2D(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  maximumDisplacement: number,
  precomputedMap: number[],
): ImageData {
  const imageData = new ImageData(width, height);
  fillNeutral(imageData.data);

  const radiusSquared = radius * radius;
  const outerAa = 2.4;
  const radiusOuter = radius + outerAa;
  const radiusOuterSquared = radiusOuter * radiusOuter;
  const radiusMinusBezelSquared = Math.max(
    0,
    (radius - bezelWidth) * (radius - bezelWidth),
  );
  const widthBetween = width - radius * 2;
  const heightBetween = height - radius * 2;
  const rOuter = Math.sqrt(radiusOuterSquared);
  const rInner = Math.sqrt(radiusSquared);

  // Only the bezel band can be non-neutral; the interior stays as filled above.
  const band = Math.ceil(Math.max(bezelWidth, radius)) + 2;
  const halfWidth = Math.ceil(width / 2);
  const halfHeight = Math.ceil(height / 2);

  for (let y1 = 0; y1 < halfHeight; y1 += 1) {
    const inTopBand = y1 < band;
    const y = cornerOffset(y1, height, radius, heightBetween);
    // Rows past the corner band only bend along the left edge; everything
    // further in is flat, so there is nothing to walk.
    const xLimit = inTopBand ? halfWidth : Math.min(band, halfWidth);

    for (let x1 = 0; x1 < xLimit; x1 += 1) {
      const x = cornerOffset(x1, width, radius, widthBetween);

      const distanceSquared = x * x + y * y;
      if (
        distanceSquared > radiusOuterSquared ||
        distanceSquared < radiusMinusBezelSquared
      ) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      // Smoothstep the outer ring — a linear 1px AA band aliases into “рваные края”.
      let opacity = 1;
      if (distanceSquared >= radiusSquared) {
        const t = Math.max(
          0,
          Math.min(1, (distance - rInner) / (rOuter - rInner)),
        );
        opacity = 1 - t * t * (3 - 2 * t);
      }
      const cos = distance > 0 ? x / distance : 0;
      const sin = distance > 0 ? y / distance : 0;
      const bezelRatio = Math.max(
        0,
        Math.min(1, (radius - distance) / bezelWidth),
      );
      const bezelIndex = Math.min(
        precomputedMap.length - 1,
        Math.max(0, Math.floor(bezelRatio * precomputedMap.length)),
      );
      const shift = precomputedMap[bezelIndex] || 0;
      const scale = maximumDisplacement > 0 ? 127 * opacity / maximumDisplacement : 0;

      writeQuad(
        imageData.data,
        width,
        height,
        x1,
        y1,
        -cos * shift * scale,
        -sin * shift * scale,
      );
    }
  }
  return imageData;
}

/**
 * Axis-aligned rectangular bezel — for square chrome (lab sticky bars).
 *
 * Unlike the stadium map, bezel depth is independent of corner radius, so a
 * tall lens band on the long edges does not force capsule ends.
 */
export function calculateDisplacementMap2DRect(
  width: number,
  height: number,
  bezelWidth: number,
  maximumDisplacement: number,
  precomputedMap: number[],
  bezelEdges: "all" | "y" = "all",
): ImageData {
  const imageData = new ImageData(width, height);
  fillNeutral(imageData.data);

  const bezel = Math.max(1, Math.min(bezelWidth, Math.floor(Math.min(width, height) / 2)));
  const band = bezel + 1;
  const invMax = maximumDisplacement > 0 ? 1 / maximumDisplacement : 0;
  const mapLen = precomputedMap.length;
  const halfWidth = Math.ceil(width / 2);
  const halfHeight = Math.ceil(height / 2);
  const yOnly = bezelEdges === "y";

  for (let y1 = 0; y1 < halfHeight; y1 += 1) {
    const inTopBand = y1 < band;
    // Horizontal-only headers skip the left/right columns entirely.
    if (!inTopBand && yOnly) break;
    const xLimit = inTopBand ? halfWidth : Math.min(band, halfWidth);

    for (let x1 = 0; x1 < xLimit; x1 += 1) {
      const dL = x1;
      const dR = width - 1 - x1;
      const dT = y1;
      const dB = height - 1 - y1;
      const d = yOnly ? Math.min(dT, dB) : Math.min(dL, dR, dT, dB);
      if (d >= bezel) continue;

      // Inward normals from every edge that shares the minimum distance
      // (corners get a diagonal blend instead of a stadium arc).
      let nx = 0;
      let ny = 0;
      const gate = d + 0.5;
      if (!yOnly) {
        if (dL <= gate) nx -= 1;
        if (dR <= gate) nx += 1;
      }
      if (dT <= gate) ny -= 1;
      if (dB <= gate) ny += 1;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;

      const bezelRatio = Math.max(0, Math.min(1, d / bezel));
      const bezelIndex = Math.min(
        mapLen - 1,
        Math.max(0, Math.floor(bezelRatio * mapLen)),
      );
      const shift = precomputedMap[bezelIndex] || 0;
      const scale = shift * invMax * 127;

      writeQuad(imageData.data, width, height, x1, y1, -nx * scale, -ny * scale);
    }
  }
  return imageData;
}

/** Soft edge falloff — hard cos falloff at 1.5px aliased into “рваные края”. */
const SPECULAR_THICKNESS = 2.75;
const SPECULAR_OUTER_AA = 2.1;

/** Square-corner specular: a thin highlight along the four straight edges. */
export function calculateSpecularHighlightRect(
  width: number,
  height: number,
  bezelWidth: number,
  specularAngle = Math.PI / 3,
  /** Visual plate radius — fades the highlight inside rounded CSS clips. */
  clipRadius = 0,
): ImageData {
  const imageData = new ImageData(width, height);
  const lightX = Math.cos(specularAngle);
  const lightY = Math.sin(specularAngle);
  const specularThickness = SPECULAR_THICKNESS;
  const bezel = Math.max(1, Math.min(bezelWidth, Math.floor(Math.min(width, height) / 2)));
  const band = Math.ceil(Math.max(bezel, specularThickness)) + 2;
  const halfHeight = Math.ceil(height / 2);
  const radius = Math.max(
    0,
    Math.min(clipRadius, Math.min(width, height) / 2),
  );

  for (let y1 = 0; y1 < halfHeight; y1 += 1) {
    const inTopBand = y1 < band;

    for (let x1 = 0; x1 < width; x1 += 1) {
      if (!inTopBand && x1 >= band && x1 < width - band) {
        x1 = width - band - 1;
        continue;
      }

      const dL = x1;
      const dR = width - 1 - x1;
      const dT = y1;
      const dB = height - 1 - y1;
      const d = Math.min(dL, dR, dT, dB);
      if (d >= specularThickness) continue;

      // Outside a rounded plate: kill specular so a rect map doesn’t paint
      // square corner ticks that get clipped into jagged arcs.
      let roundMask = 1;
      if (radius > 0.5) {
        const cx = x1 < width / 2 ? x1 - radius : x1 - (width - radius);
        const cy = y1 < height / 2 ? y1 - radius : y1 - (height - radius);
        const inCorner =
          (x1 < radius || x1 >= width - radius) &&
          (y1 < radius || y1 >= height - radius);
        if (inCorner) {
          const dist = Math.hypot(cx, cy);
          if (dist > radius + SPECULAR_OUTER_AA) continue;
          if (dist > radius) {
            roundMask = 1 - (dist - radius) / SPECULAR_OUTER_AA;
          } else if (dist < radius - specularThickness) {
            continue;
          }
        }
      }

      let nx = 0;
      let ny = 0;
      const gate = d + 0.5;
      if (dL <= gate) nx -= 1;
      if (dR <= gate) nx += 1;
      if (dT <= gate) ny -= 1;
      if (dB <= gate) ny += 1;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;

      const facing = Math.abs(nx * lightX + -ny * lightY);
      const edgeRatio = Math.max(0, Math.min(1, (specularThickness - d) / specularThickness));
      // Smoothstep — softer than the old quarter-circle, less pixel ringing.
      const softFalloff = edgeRatio * edgeRatio * (3 - 2 * edgeRatio);
      const coefficient = facing * softFalloff * roundMask;
      const color = Math.min(255, 255 * coefficient);

      writeMirrored(
        imageData.data,
        width,
        height,
        x1,
        y1,
        color,
        Math.min(255, color * coefficient),
      );
    }
  }
  return imageData;
}

/** Thin bright rim where the bezel normal faces the light direction. */
export function calculateSpecularHighlight(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  specularAngle = Math.PI / 3,
): ImageData {
  const imageData = new ImageData(width, height);
  const lightX = Math.cos(specularAngle);
  const lightY = Math.sin(specularAngle);
  const specularThickness = SPECULAR_THICKNESS;

  const radiusSquared = radius * radius;
  const radiusOuter = radius + SPECULAR_OUTER_AA;
  const radiusOuterSquared = radiusOuter * radiusOuter;
  const radiusMinusSpecularSquared = Math.max(
    0,
    (radius - specularThickness) * (radius - specularThickness),
  );
  const widthBetween = width - radius * 2;
  const heightBetween = height - radius * 2;
  const rOuter = Math.sqrt(radiusOuterSquared);
  const rInner = Math.sqrt(radiusSquared);
  const band = Math.ceil(Math.max(bezelWidth, radius)) + 2;
  const halfHeight = Math.ceil(height / 2);

  for (let y1 = 0; y1 < halfHeight; y1 += 1) {
    const inTopBand = y1 < band;
    const y = cornerOffset(y1, height, radius, heightBetween);

    for (let x1 = 0; x1 < width; x1 += 1) {
      if (!inTopBand && x1 >= band && x1 < width - band) {
        x1 = width - band - 1;
        continue;
      }
      const x = cornerOffset(x1, width, radius, widthBetween);

      const distanceSquared = x * x + y * y;
      if (
        distanceSquared > radiusOuterSquared ||
        distanceSquared < radiusMinusSpecularSquared
      ) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      let opacity = 1;
      if (distanceSquared >= radiusSquared) {
        const t = Math.max(
          0,
          Math.min(1, (distance - rInner) / (rOuter - rInner)),
        );
        opacity = 1 - t * t * (3 - 2 * t);
      }
      const cos = distance > 0 ? x / distance : 0;
      const sin = distance > 0 ? -y / distance : 0;
      const facing = Math.abs(cos * lightX + sin * lightY);
      const edgeRatio = Math.max(
        0,
        Math.min(1, (radius - distance) / specularThickness),
      );
      const softFalloff = edgeRatio * edgeRatio * (3 - 2 * edgeRatio);
      const coefficient = facing * softFalloff;
      const color = Math.min(255, 255 * coefficient);

      writeMirrored(
        imageData.data,
        width,
        height,
        x1,
        y1,
        color,
        Math.min(255, color * coefficient * opacity),
      );
    }
  }
  return imageData;
}
