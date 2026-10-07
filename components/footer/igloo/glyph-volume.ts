import * as THREE from "three";

/**
 * SDF volume baker: turns the LUNO wordmark into the same data format igloo.inc
 * streams for its logos (`.ktx2` 64³ RGBA8 volumes), so the ported particle
 * compute shader can stay byte-identical.
 *
 * Their encoding, verified by decoding `x_64.ktx2` and the other reference
 * volumes from the site:
 *
 *   A  = clamp(dist / 4 + 0.5, 0, 1) * 255, dist in units of the full volume
 *      extent (the volume is 1.0 wide, so one voxel = 1/res) and negative inside
 *   RGB = 127.5 * (1 + normalize(grad))   grad points outward
 *
 * The shader reads it back as `dist = (a * 2 - 1) * 2` and
 * `grad = normalize(rgb * 2 - 1)` (bundle 40924-40926).
 *
 * Their logo is a flat extruded shape: the decoded x_64 slab is ~9 voxels of 64
 * thick, so the glyph is extruded with the same half-thickness.
 */

const SVG_URL = "/luno-logo.svg";
/**
 * Voxel count per axis. Their streamed volumes are 64³, but those carry
 * near-square marks; `luno` is 1532x545 (aspect 2.81), so after the aspect-fit
 * the wordmark owns 88% of the face width and only 88/2.81 = 31% of the height.
 * At 64³ that is 20 voxels of cap height and 2.9 voxels across a stem, which the
 * surface force cannot hold: the stems blur into the neighbouring shell. 128³
 * restores the voxel-per-stroke the square glyph gets at 64³ (the encoding is in
 * extent units, so raising `res` changes fidelity and cost only, never a force).
 */
const VOLUME_RES = 128;
/**
 * Slab thickness as a fraction of the silhouette's own height. Their decoded
 * `x_64` volume is 9 voxels of 64 thick (0.141 of the extent) for a near-square
 * mark that fills ~0.8 of the face, i.e. the plate is 0.176 of its own height.
 * Carrying the absolute 0.141 onto `luno` would be wrong: the wordmark fills
 * only 0.31 of the face height after the aspect-fit, so the plate would be 45%
 * of the letter height, the strokes would self-occlude, and the Y-spin would
 * sweep a brick past the camera. The ratio is what the reference encodes.
 */
const SLAB_DEPTH_RATIO = 0.176;
/**
 * Mask resolution the 2D distance transform runs at, then sampled onto the grid.
 * 512 keeps a stem at ~24 px, so the 2D SDF the volume samples from is smooth
 * across the whole 128³ sweep.
 */
const MASK_RES = 512;
/** Fraction of the volume face the glyph silhouette fills; the rest is outside space. */
const FIT_SHARE = 0.88;
/** Alpha cut for "solid", i.e. the 0.5 iso-contour of the antialiased raster. */
const ALPHA_CUT = 128;
/** dist / 4 encoding range: the widest distance worth representing, in volume units. */
const DIST_RANGE = 2;

export type GlyphVolume = {
  texture: THREE.Data3DTexture;
  /** The glyph's own gradient on the same face, for tinting the particles. */
  colorTexture: THREE.DataTexture;
  /** Silhouette bbox in volume-face fractions (u for x, v for y; v = 0 is the bottom). */
  bounds: { x0: number; x1: number; y0: number; y1: number };
  dispose: () => void;
};

type Mask = {
  size: number;
  solid: Uint8Array;
  /** Silhouette bbox in volume-face fractions (v = 0 is the bottom). */
  box: { minX: number; maxX: number; minY: number; maxY: number };
  /** The silhouette-to-mask transform, reused by the colour map so both agree. */
  fit: number;
  offX: number;
  offY: number;
  srcBox: { minX: number; minY: number };
};

const BIG_RES = 1024;

async function rasterize(svgUrl: string) {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to rasterize ${svgUrl}`));
    img.src = svgUrl;
  });
  const iw = img.naturalWidth || 1532;
  const ih = img.naturalHeight || 545;
  const scale = BIG_RES / Math.max(iw, ih);
  const w = Math.max(2, Math.round(iw * scale));
  const h = Math.max(2, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable while baking the glyph volume");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

function buildMask(raster: { data: Uint8ClampedArray; w: number; h: number }): Mask {
  const { data, w, h } = raster;
  const alphaAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3];

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alphaAt(x, y) < ALPHA_CUT) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) throw new Error("Glyph produced an empty silhouette");

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const size = MASK_RES;
  // Aspect-fit the silhouette into the square mask; the long axis fills FIT_SHARE.
  const fit = (FIT_SHARE * size) / Math.max(bw, bh);
  const offX = (size - bw * fit) / 2;
  const offY = (size - bh * fit) / 2;

  const solid = new Uint8Array(size * size);
  for (let my = 0; my < size; my += 1) {
    for (let mx = 0; mx < size; mx += 1) {
      // Nearest-sample the source raster around the silhouette box.
      const sx = minX + Math.floor((mx - offX) / fit);
      const sy = minY + Math.floor((my - offY) / fit);
      if (alphaAt(sx, sy) >= ALPHA_CUT) solid[my * size + mx] = 1;
    }
  }

  // Silhouette bbox expressed in volume-face fractions, v flipped so v = 0 is
  // the bottom (GL texture rows start at the bottom of the image).
  const u0 = offX / size;
  const u1 = (offX + bw * fit) / size;
  const v1 = 1 - offY / size;
  const v0 = 1 - (offY + bh * fit) / size;
  return {
    size,
    solid,
    fit,
    offX,
    offY,
    srcBox: { minX, minY },
    box: { minX: u0, maxX: u1, minY: v0, maxY: v1 },
  };
}

/**
 * The glyph's own gradient, baked into the same square face the volume uses, so
 * a particle can look up its colour by the very coordinate the compute shader
 * already uses for the SDF. Rows are flipped to match the volume (row 0 = the
 * bottom of the mark), and the area outside the silhouette carries the average
 * brand colour rather than black: stray particles in the halo still get a hue.
 */
function buildColorMap(mask: Mask, raster: { data: Uint8ClampedArray; w: number; h: number }) {
  const { data, w, h } = raster;
  const size = mask.size;
  const { fit, offX, offY, srcBox } = mask;

  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let avgA = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] / 255;
      if (a <= 0) continue;
      avgR += data[i] * a;
      avgG += data[i + 1] * a;
      avgB += data[i + 2] * a;
      avgA += a;
    }
  }
  const inv = avgA > 0 ? 1 / avgA : 0;
  const fill = [avgR * inv, avgG * inv, avgB * inv];

  const rgba = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    // Map row 0 is the bottom of the mark, mask row 0 is the top of the raster.
    const my = size - 1 - row;
    for (let mx = 0; mx < size; mx += 1) {
      const sx = srcBox.minX + (mx - offX) / fit;
      const sy = srcBox.minY + (my - offY) / fit;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const px = x0 + dx;
          const py = y0 + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const i = (py * w + px) * 4;
          const alpha = data[i + 3] / 255;
          const weight =
            alpha * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
          if (weight <= 0) continue;
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
          a += weight;
        }
      }
      const src = a > 0.05 ? [r / a, g / a, b / a] : fill;
      const p = (row * size + mx) * 4;
      rgba[p] = Math.round(src[0]);
      rgba[p + 1] = Math.round(src[1]);
      rgba[p + 2] = Math.round(src[2]);
      rgba[p + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Felzenszwalb 1D squared distance transform, applied along rows then columns.
 * `f[i]` = 0 where the sample belongs to the set, +inf elsewhere; the result is
 * the squared distance to the nearest member of the set.
 */
const INF = 1e20;
function distanceTransform1d(f: Float32Array, n: number) {
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q += 1) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (k > 0 && s <= z[k]) {
      k -= 1;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const diff = q - v[k];
    d[q] = diff * diff + f[v[k]];
  }
  return d;
}

function signedDistance(mask: Mask): Float32Array {
  const n = mask.size;
  const toSolid = new Float32Array(n * n);
  const toEmpty = new Float32Array(n * n);
  const line = new Float32Array(n);

  const dt = (getter: (i: number, j: number) => number, out: Float32Array) => {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) line[i] = getter(i, j);
      const rows = distanceTransform1d(line, n);
      for (let i = 0; i < n; i += 1) out[j * n + i] = rows[i];
    }
    const col = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) col[j] = out[j * n + i];
      const cols = distanceTransform1d(col, n);
      for (let j = 0; j < n; j += 1) out[j * n + i] = cols[j];
    }
  };

  dt(
    (i, j) => (mask.solid[j * n + i] ? 0 : INF),
    toSolid,
  );
  dt(
    (i, j) => (mask.solid[j * n + i] ? INF : 0),
    toEmpty,
  );

  const sd = new Float32Array(n * n);
  for (let i = 0; i < n * n; i += 1) {
    sd[i] = Math.sqrt(toSolid[i]) - Math.sqrt(toEmpty[i]);
  }
  return sd;
}

/** Bilinear sample of the 2D signed distance, in mask pixels (negative = inside). */
function sample2d(sd: Float32Array, n: number, x: number, y: number) {
  const xi = Math.min(n - 1, Math.max(0, x));
  const yi = Math.min(n - 1, Math.max(0, y));
  const x0 = Math.min(n - 1, Math.floor(xi));
  const y0 = Math.min(n - 1, Math.floor(yi));
  const x1 = Math.min(n - 1, x0 + 1);
  const y1 = Math.min(n - 1, y0 + 1);
  const fx = xi - x0;
  const fy = yi - y0;
  const a = sd[y0 * n + x0];
  const b = sd[y0 * n + x1];
  const c = sd[y1 * n + x0];
  const e = sd[y1 * n + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/**
 * Extrusion of a 2D SDF along z: exact for a slab, so the rim keeps a real
 * distance instead of a stretched one.
 */
function extrude(d2: number, dz: number) {
  const mx = Math.max(d2, dz);
  if (mx < 0) return mx;
  const px = Math.max(d2, 0);
  const py = Math.max(dz, 0);
  return Math.hypot(px, py);
}

export async function bakeGlyphVolume(svgUrl: string = SVG_URL): Promise<GlyphVolume> {
  const raster = await rasterize(svgUrl);
  const mask = buildMask(raster);
  const n = mask.size;
  const sd2 = signedDistance(mask);

  const res = VOLUME_RES;
  const step = n / res;
  const px = 1 / n;
  const field = new Float32Array(res * res * res);
  // Half-thickness in extent units, from the silhouette the mask actually has.
  const slabHalf = (SLAB_DEPTH_RATIO * (mask.box.maxY - mask.box.minY)) / 2;

  for (let k = 0; k < res; k += 1) {
    // Volume z is centred on 0, extent 1.0, so the slab spans ±slabHalf.
    const z = (k + 0.5) / res - 0.5;
    const dz = Math.abs(z) - slabHalf;
    for (let j = 0; j < res; j += 1) {
      // v = 0 is the bottom row of the glyph, mask row 0 is the top.
      const my = n - (j + 0.5) * step;
      for (let i = 0; i < res; i += 1) {
        const mx = (i + 0.5) * step;
        const d2 = sample2d(sd2, n, mx, my) * px;
        field[(k * res + j) * res + i] = extrude(d2, dz);
      }
    }
  }

  const data = new Uint8Array(res * res * res * 4);
  for (let k = 0; k < res; k += 1) {
    const km = k > 0 ? k - 1 : 0;
    const kp = k < res - 1 ? k + 1 : res - 1;
    for (let j = 0; j < res; j += 1) {
      const jm = j > 0 ? j - 1 : 0;
      const jp = j < res - 1 ? j + 1 : res - 1;
      for (let i = 0; i < res; i += 1) {
        const im = i > 0 ? i - 1 : 0;
        const ip = i < res - 1 ? i + 1 : res - 1;
        const idx = (k * res + j) * res + i;
        // Central differences over a symmetric span, so the gradient stays
        // unbiased at the flat interior of the slab.
        const gx = (field[(k * res + j) * res + ip] - field[(k * res + j) * res + im]) / (ip - im || 1);
        const gy = (field[(k * res + jp) * res + i] - field[(k * res + jm) * res + i]) / (jp - jm || 1);
        const gz = (field[(kp * res + j) * res + i] - field[(km * res + j) * res + i]) / (kp - km || 1);
        const len = Math.hypot(gx, gy, gz);
        const nx = len > 1e-9 ? gx / len : 0;
        const ny = len > 1e-9 ? gy / len : 0;
        const nz = len > 1e-9 ? gz / len : 0;
        const dist = field[idx];
        const p = idx * 4;
        data[p] = Math.round(127.5 * (1 + nx));
        data[p + 1] = Math.round(127.5 * (1 + ny));
        data[p + 2] = Math.round(127.5 * (1 + nz));
        data[p + 3] = Math.round(
          255 * Math.min(1, Math.max(0, dist / (2 * DIST_RANGE) + 0.5)),
        );
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, res, res, res);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const box = mask.box;
  const colorTexture = buildColorMap(mask, raster);
  return {
    texture,
    colorTexture,
    bounds: {
      x0: box.minX,
      x1: box.maxX,
      y0: box.minY,
      y1: box.maxY,
    },
    dispose: () => {
      texture.dispose();
      colorTexture.dispose();
    },
  };
}

let cache: Promise<GlyphVolume> | null = null;

/** Shared bake: the mount and the prefetch must not rasterise the glyph twice. */
export function getGlyphVolume(): Promise<GlyphVolume> {
  if (!cache) {
    cache = bakeGlyphVolume().catch((error) => {
      cache = null;
      throw error;
    });
  }
  return cache;
}
