/**
 * Verbatim GLSL chunks from igloo.inc's `App3D` bundle (abeto.co framework).
 * Copied character-for-character from the beautified reference so the effect's
 * numbers cannot drift: port target is the shipped look, not an approximation.
 *
 * Bundle line map (`/tmp/igloo-study/App3D.pretty.js`):
 *   22981 `ae`  global uniform block   40133 `pF`  fps-normalised easing
 *   40134 `mF`  PCG curl noise         40135 `AF`  linearstep
 *   32307 `Ht`  fit family             39441 `yd`  rotation helpers
 *   33745 `Zo`  aastep
 */

/**
 * `ae` is a UBO (`uniform Global { vec2 resolution; vec2 resolutionUI; float
 * aspect; float time; float dtRatio; }`). Three r156 can bind a UniformsGroup,
 * but the field order has to match the std140 layout and every material then
 * needs the same group; plain uniforms with the same names compile to identical
 * code and keep the shader bodies byte-identical to the reference.
 */
export const GLSL_GLOBAL = /* glsl */ `
uniform vec2 resolution;
uniform float time;
uniform float dtRatio;
`;

/** Bundle 40133 (`pF`). */
export const GLSL_FPS = /* glsl */ `
float lerpCoefFPS(float t, float dt) { return 1.0 - exp2(log2(1.0 - t) * dt); }
float frictionFPS(float t, float dt) { return exp2(log2(t) * dt); }
float lerpFPS(float x, float y, float t, float dt) { return mix(x, y, lerpCoefFPS(t, dt)); }
`;

/** Bundle 40134 (`mF`): PCG-hashed simplex gradients, cross product of two fields. */
export const GLSL_NOISE = /* glsl */ `
uvec2 _pcg3d16(uvec3 p) {
  uvec3 v = p * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v.x += v.y * v.z; v.y += v.z * v.x;
  return v.xy;
}
uvec2 _pcg4d16(uvec4 p) {
  uvec4 v = p * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v.x += v.y * v.w; v.y += v.z * v.x;
  return v.xy;
}
vec3 _gradient3d(uint hash) {
  vec3 g = vec3(uvec3(hash) & uvec3(0x80000, 0x40000, 0x20000));
  return g * (1.0 / vec3(0x40000, 0x20000, 0x10000)) - 1.0;
}
vec4 _gradient4d(uint hash) {
  vec4 g = vec4(uvec4(hash) & uvec4(0x80000, 0x40000, 0x20000, 0x10000));
  return g * (1.0 / vec4(0x40000, 0x20000, 0x10000, 0x8000)) - 1.0;
}
vec3 BitangentNoise3D(vec3 p) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(p + dot(p, C.yyy));
  vec3 x0 = p - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = i + 32768.5;
  uvec2 hash0 = _pcg3d16(uvec3(i));
  uvec2 hash1 = _pcg3d16(uvec3(i + i1));
  uvec2 hash2 = _pcg3d16(uvec3(i + i2));
  uvec2 hash3 = _pcg3d16(uvec3(i + 1.0));
  vec3 p00 = _gradient3d(hash0.x);
  vec3 p01 = _gradient3d(hash0.y);
  vec3 p10 = _gradient3d(hash1.x);
  vec3 p11 = _gradient3d(hash1.y);
  vec3 p20 = _gradient3d(hash2.x);
  vec3 p21 = _gradient3d(hash2.y);
  vec3 p30 = _gradient3d(hash3.x);
  vec3 p31 = _gradient3d(hash3.y);
  vec4 m = clamp(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0, 1.0);
  vec4 mt = m * m;
  vec4 m4 = mt * mt;
  mt = mt * m;
  vec4 pdotx = vec4(dot(p00, x0), dot(p10, x1), dot(p20, x2), dot(p30, x3));
  vec4 temp = mt * pdotx;
  vec3 gradient0 = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient0 += m4.x * p00 + m4.y * p10 + m4.z * p20 + m4.w * p30;
  pdotx = vec4(dot(p01, x0), dot(p11, x1), dot(p21, x2), dot(p31, x3));
  temp = mt * pdotx;
  vec3 gradient1 = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient1 += m4.x * p01 + m4.y * p11 + m4.z * p21 + m4.w * p31;
  return cross(gradient0, gradient1) * 3918.76;
}
vec3 BitangentNoise4D(vec4 p) {
  const vec4 F4 = vec4(0.309016994374947451);
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(p + dot(p, F4));
  vec4 x0 = p - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = i + 32768.5;
  uvec2 hash0 = _pcg4d16(uvec4(i));
  uvec2 hash1 = _pcg4d16(uvec4(i + i1));
  uvec2 hash2 = _pcg4d16(uvec4(i + i2));
  uvec2 hash3 = _pcg4d16(uvec4(i + i3));
  uvec2 hash4 = _pcg4d16(uvec4(i + 1.0));
  vec4 p00 = _gradient4d(hash0.x);
  vec4 p01 = _gradient4d(hash0.y);
  vec4 p10 = _gradient4d(hash1.x);
  vec4 p11 = _gradient4d(hash1.y);
  vec4 p20 = _gradient4d(hash2.x);
  vec4 p21 = _gradient4d(hash2.y);
  vec4 p30 = _gradient4d(hash3.x);
  vec4 p31 = _gradient4d(hash3.y);
  vec4 p40 = _gradient4d(hash4.x);
  vec4 p41 = _gradient4d(hash4.y);
  vec3 m0 = clamp(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0, 1.0);
  vec2 m1 = clamp(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0, 1.0);
  vec3 m02 = m0 * m0;
  vec3 m03 = m02 * m0;
  vec2 m12 = m1 * m1;
  vec2 m13 = m12 * m1;
  vec3 temp0 = m02 * vec3(dot(p00, x0), dot(p10, x1), dot(p20, x2));
  vec2 temp1 = m12 * vec2(dot(p30, x3), dot(p40, x4));
  vec4 grad0 = -6.0 * (temp0.x * x0 + temp0.y * x1 + temp0.z * x2 + temp1.x * x3 + temp1.y * x4);
  grad0 += m03.x * p00 + m03.y * p10 + m03.z * p20 + m13.x * p30 + m13.y * p40;
  temp0 = m02 * vec3(dot(p01, x0), dot(p11, x1), dot(p21, x2));
  temp1 = m12 * vec2(dot(p31, x3), dot(p41, x4));
  vec4 grad1 = -6.0 * (temp0.x * x0 + temp0.y * x1 + temp0.z * x2 + temp1.x * x3 + temp1.y * x4);
  grad1 += m03.x * p01 + m03.y * p11 + m03.z * p21 + m13.x * p31 + m13.y * p41;
  return cross(grad0.xyz, grad1.xyz) * 81.0;
}
`;

/** Bundle 40135 (`AF`). */
export const GLSL_LINEARSTEP = /* glsl */ `
float linearstep(float begin, float end, float t) {
  return clamp((t - begin) / (end - begin), 0.0, 1.0);
}
`;

/** Bundle 32307 (`Ht`). */
export const GLSL_FIT = /* glsl */ `
float efit(float x, float a1, float a2, float b1, float b2) {
  return b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);
}
float fit(float x, float a1, float a2, float b1, float b2) {
  return clamp(efit(x, a1, a2, b1, b2), min(b1, b2), max(b1, b2));
}
float fit01(float x, float a1, float a2) { return fit(x, 0.0, 1.0, a1, a2); }
float fit10(float x, float a1, float a2) { return fit(x, 1.0, 0.0, a1, a2); }
float fit11(float x, float a1, float a2) { return fit(x, -1.0, 1.0, a1, a2); }
`;

/** Bundle 39441 (`yd`), reduced to the two helpers these shaders call. */
export const GLSL_ROT = /* glsl */ `
mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
`;

/** Bundle 33745 (`Zo`). Included by the reference display fragment. */
export const GLSL_AASTEP = /* glsl */ `
float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold - afwidth, threshold + afwidth, value);
}
`;

/** `ie.getTextureSizeParticles` — bundle 26000. */
export function textureSizeForParticles(count: number): number {
  return Math.max(Math.ceil(Math.sqrt(count) / 4) * 4, 4);
}

/** `ie.frictionFPS` — bundle 25915: `exp(log(t) * dtRatio)`. */
export function frictionFPS(dissipation: number, dtRatio: number): number {
  return Math.exp(Math.log(dissipation) * dtRatio);
}

/** `Fe.ratio` — bundle 25606: frame delta normalised to 60 fps, capped at 5. */
export function dtRatio(deltaMs: number): number {
  return Math.min(5, deltaMs / (1000 / 60));
}
