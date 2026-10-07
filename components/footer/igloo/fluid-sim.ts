import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { dtRatio, frictionFPS } from "./gpu-glsl";

/**
 * Port of igloo.inc's `$U` fluid solver (bundle 31426-31538) plus its eight
 * `FLUID_*` shader materials (bundle 30823-31383). Shader bodies are verbatim;
 * the JS transcribes their update order pass for pass.
 *
 * Their materials are raw (each shader declares its own `precision`,
 * `attribute vec3 position`, `attribute vec2 uv`), so they map onto
 * `RawShaderMaterial`. The fullscreen triangle behind `FullScreenQuad` is the
 * same vertex data as their `FU`/`NU` geometry (bundle 30295-30300), so the
 * pixels match.
 */

const QUAD_VERTEX = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;

void main () {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const NEIGHBOUR_VERTEX = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform vec2 texelSize;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main () {
  vUv = uv;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position, 1.0);
}
`;

/** Their curl vertex pass declares no `vUv` at all. Kept that way. */
const CURL_VERTEX = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform vec2 texelSize;

varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main () {
  vL = uv - vec2(texelSize.x, 0.0);
  vR = uv + vec2(texelSize.x, 0.0);
  vT = uv + vec2(0.0, texelSize.y);
  vB = uv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position, 1.0);
}
`;

const CLEAR_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2D;

uniform sampler2D uTexture;
uniform float value;

varying highp vec2 vUv;

void main () {
  gl_FragColor.rgb = value * texture2D(uTexture, vUv).rgb;
  gl_FragColor.a = 1.0;
}
`;

/**
 * `WU` in LINE mode (bundle 30917 defines `SPLAT_DOT` only for mode 1, and `wF`
 * asks for "line"), so the dot branch is left out rather than compiled out.
 */
const SPLAT_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform vec2 prevPoint;
uniform float radius;
uniform bool isDye;

varying vec2 vUv;

float line(vec2 uv, vec2 point1, vec2 point2) {
  vec2 pa = uv - point1, ba = point2 - point1;
  pa.x *= aspectRatio;
  ba.x *= aspectRatio;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float cubicIn(float t) {
  return t * t * t;
}

void main () {
  vec3 splat = cubicIn(clamp(1.0 - line(vUv, prevPoint.xy, point.xy) / radius, 0.0, 1.0)) * color;

  vec3 base = texture2D(uTarget, vUv).xyz;
  vec3 result = base + splat;
  if (isDye) result = clamp(result, vec3(0.0), vec3(1.0));

  gl_FragColor = vec4(result, 1.0);
}
`;

const CURL_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2D;

uniform sampler2D uVelocity;

varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;

void main () {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`;

const VORTICITY_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main () {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
}
`;

/** `XU` with `borders: false`, so `LIMIT_BORDERS` is never defined. */
const DIVERGENCE_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2D;

uniform sampler2D uVelocity;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;

void main () {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;

  float div = 0.5 * (R - L + T - B);
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

const PRESSURE_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2D;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;

void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float C = texture2D(uPressure, vUv).x;
  float divergence = texture2D(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

const GRADIENT_FRAGMENT = /* glsl */ `
precision mediump float;
precision mediump sampler2D;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;

void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

function advectionFragment(manualFiltering: boolean) {
  return /* glsl */ `
precision highp float;
precision highp sampler2D;
${manualFiltering ? "#define MANUAL_FILTERING" : ""}

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;

varying vec2 vUv;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main () {
  vec4 result;

  #ifdef MANUAL_FILTERING
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    result = bilerp(uSource, coord, dyeTexelSize);
  #else
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    result = texture2D(uSource, coord);
  #endif

  gl_FragColor.rgb = result.rgb * dissipation;
  gl_FragColor.a = 1.0;
}
`;
}

/**
 * The config `wF` hands to `$U` (bundle 40658-40670). One detail is load-bearing:
 * they pass `pressureIterations: 2` (plural) while `$U` destructures
 * `pressureIteration` (singular, 31430), so that value is silently dropped and
 * the framework default `PRESSURE_ITERATIONS = 3` (31390) is what the live site
 * runs. 3 is the faithful number; 2 would be a change.
 */
const SIM_RES = 128;
const DYE_RES = 128;
const PRESSURE_ITERATIONS = 3;
const DENSITY_DISSIPATION = 0.88;
const VELOCITY_DISSIPATION = 0.98;
const PRESSURE_DISSIPATION = 0.86;
/** `curlStrength: 0`: the vorticity pass still runs, it just adds nothing. */
const CURL_STRENGTH = 0;
const SPLAT_RADIUS = 0.22;
const SPLAT_FORCE = 35;

type Filter = typeof THREE.NearestFilter | typeof THREE.LinearFilter;

type PingPong = {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;
  swap: () => void;
};

/** `lp()` - bundle 31407: half-float RGBA pair, no depth buffer. */
function makePair(res: number, filter: Filter): PingPong {
  const opts: THREE.WebGLRenderTargetOptions = {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
  };
  const pair: PingPong = {
    read: new THREE.WebGLRenderTarget(res, res, opts),
    write: new THREE.WebGLRenderTarget(res, res, opts),
    swap: () => {
      const a = pair.read;
      pair.read = pair.write;
      pair.write = a;
    },
  };
  return pair;
}

export type FluidSplatPoint = {
  /** Pointer in 0..1 screen space, y up (their `position01`, bundle 26048). */
  position: THREE.Vector2;
  prevPosition: THREE.Vector2;
  lastUpdate: number;
  lastSplat: number;
  velocity: number;
};

export class FluidSim {
  readonly points: FluidSplatPoint[];
  /** `velUniform` / `dyeUniform` (31449): always the current read texture. */
  readonly dyeUniform: { value: THREE.Texture | null } = { value: null };
  readonly velUniform: { value: THREE.Texture | null } = { value: null };

  private readonly renderer: THREE.WebGLRenderer;
  private readonly quad: FullScreenQuad;
  private readonly simTexelSize: number;
  private readonly dyeTexelSize: number;
  private readonly density: PingPong;
  private readonly velocity: PingPong;
  private readonly pressure: PingPong;
  private readonly divergenceRT: THREE.WebGLRenderTarget;
  private readonly curlRT: THREE.WebGLRenderTarget;
  private readonly materialClear: THREE.RawShaderMaterial;
  private readonly materialSplat: THREE.RawShaderMaterial;
  private readonly materialCurl: THREE.RawShaderMaterial;
  private readonly materialVorticity: THREE.RawShaderMaterial;
  private readonly materialDivergence: THREE.RawShaderMaterial;
  private readonly materialPressure: THREE.RawShaderMaterial;
  private readonly materialGradient: THREE.RawShaderMaterial;
  private readonly materialAdvection: THREE.RawShaderMaterial;
  private readonly scratch = new THREE.Vector2();
  private disposed = false;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.simTexelSize = 1 / SIM_RES;
    this.dyeTexelSize = 1 / DYE_RES;

    // `capabilities.floatLinearFiltering` (31443). WebGL2 filters half-float
    // textures natively; WebGL1 has no sampler3D, so the scene never gets here.
    const linear = renderer.capabilities.isWebGL2;
    const filter: Filter = linear ? THREE.LinearFilter : THREE.NearestFilter;

    this.density = makePair(DYE_RES, filter);
    this.velocity = makePair(SIM_RES, filter);
    this.pressure = makePair(SIM_RES, THREE.NearestFilter);

    const scalarOpts: THREE.WebGLRenderTargetOptions = {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    };
    this.divergenceRT = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, scalarOpts);
    this.curlRT = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, scalarOpts);

    this.materialClear = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uTexture: { value: null },
        value: { value: PRESSURE_DISSIPATION },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: CLEAR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialSplat = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uTarget: { value: null },
        aspectRatio: { value: 1 },
        color: { value: new THREE.Vector3() },
        point: { value: new THREE.Vector2() },
        prevPoint: { value: new THREE.Vector2() },
        radius: { value: 1 },
        isDye: { value: false },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: SPLAT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialCurl = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uVelocity: { value: null },
      },
      vertexShader: CURL_VERTEX,
      fragmentShader: CURL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialVorticity = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uVelocity: { value: null },
        uCurl: { value: null },
        curl: { value: CURL_STRENGTH },
        dt: { value: 1 / 60 },
      },
      vertexShader: NEIGHBOUR_VERTEX,
      fragmentShader: VORTICITY_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialDivergence = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uVelocity: { value: null },
      },
      vertexShader: NEIGHBOUR_VERTEX,
      fragmentShader: DIVERGENCE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialPressure = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uPressure: { value: null },
        uDivergence: { value: null },
      },
      vertexShader: NEIGHBOUR_VERTEX,
      fragmentShader: PRESSURE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialGradient = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        uPressure: { value: null },
        uVelocity: { value: null },
      },
      vertexShader: NEIGHBOUR_VERTEX,
      fragmentShader: GRADIENT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.materialAdvection = new THREE.RawShaderMaterial({
      uniforms: {
        texelSize: { value: new THREE.Vector2() },
        dyeTexelSize: { value: new THREE.Vector2().setScalar(1 / DYE_RES) },
        uVelocity: { value: null },
        uSource: { value: null },
        dt: { value: 1 / 60 },
        dissipation: { value: 1 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: advectionFragment(!linear),
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new FullScreenQuad(this.materialClear);

    // `he.fingers` is 1 on their site (bundle 30595): one splat point.
    this.points = [
      {
        position: new THREE.Vector2(0.5, 0.5),
        prevPosition: new THREE.Vector2(0.5, 0.5),
        lastUpdate: 0,
        lastSplat: 0,
        velocity: 0,
      },
    ];

    this.dyeUniform.value = this.density.read.texture;
    this.velUniform.value = this.velocity.read.texture;
  }

  /**
   * `$U._update(e, t)` - bundle 31504-31521, in their order. `time` is seconds
   * and `deltaMs` is the frame delta in milliseconds, exactly their
   * `Fe.time` / `Fe.delta` pair (bundle 25591-25608).
   */
  update(time: number, deltaMs: number, aspect: number) {
    if (this.disposed) return;
    const renderer = this.renderer;

    const prevAutoClear = renderer.autoClear;
    const prevTarget = renderer.getRenderTarget();
    renderer.autoClear = false;

    this.points.forEach((point) => {
      if (time - point.lastUpdate < 0.016) return;
      this.scratch.subVectors(point.position, point.prevPosition);
      const moved = this.scratch.length();
      point.velocity += moved * 2;
      if (moved > 0) {
        const stale = time - point.lastSplat > 0.15;
        const u = this.materialSplat.uniforms;
        this.quad.material = this.materialSplat;
        u.isDye.value = false;
        u.uTarget.value = this.velocity.read.texture;
        u.aspectRatio.value = aspect;
        u.point.value.copy(point.position);
        u.prevPoint.value.copy(stale ? point.position : point.prevPosition);
        u.color.value
          .set(this.scratch.x * aspect, this.scratch.y, 0)
          .multiplyScalar(SPLAT_FORCE)
          .multiplyScalar(stale ? 0 : 1);
        // `splatRadiusVelocity: false` (40669), so the radius ignores speed.
        u.radius.value = SPLAT_RADIUS;
        renderer.setRenderTarget(this.velocity.write);
        this.quad.render(renderer);
        this.velocity.swap();

        u.isDye.value = true;
        u.uTarget.value = this.density.read.texture;
        u.color.value.setScalar(1);
        renderer.setRenderTarget(this.density.write);
        this.quad.render(renderer);
        this.density.swap();
        point.lastSplat = time;
      }
      point.lastUpdate = time;
      point.prevPosition.copy(point.position);
      point.velocity *= 0.9;
      point.velocity = Math.min(1, point.velocity);
    });

    const dt = dtRatio(deltaMs);

    this.quad.material = this.materialCurl;
    this.materialCurl.uniforms.texelSize.value.setScalar(this.simTexelSize);
    this.materialCurl.uniforms.uVelocity.value = this.velocity.read.texture;
    renderer.setRenderTarget(this.curlRT);
    this.quad.render(renderer);

    this.quad.material = this.materialVorticity;
    this.materialVorticity.uniforms.texelSize.value.setScalar(this.simTexelSize);
    this.materialVorticity.uniforms.uVelocity.value = this.velocity.read.texture;
    this.materialVorticity.uniforms.uCurl.value = this.curlRT.texture;
    this.materialVorticity.uniforms.curl.value = CURL_STRENGTH;
    this.materialVorticity.uniforms.dt.value = dt;
    renderer.setRenderTarget(this.velocity.write);
    this.quad.render(renderer);
    this.velocity.swap();

    this.quad.material = this.materialDivergence;
    this.materialDivergence.uniforms.texelSize.value.setScalar(this.simTexelSize);
    this.materialDivergence.uniforms.uVelocity.value = this.velocity.read.texture;
    renderer.setRenderTarget(this.divergenceRT);
    this.quad.render(renderer);

    this.quad.material = this.materialClear;
    this.materialClear.uniforms.uTexture.value = this.pressure.read.texture;
    this.materialClear.uniforms.value.value = frictionFPS(PRESSURE_DISSIPATION, dt);
    renderer.setRenderTarget(this.pressure.write);
    this.quad.render(renderer);
    this.pressure.swap();

    this.quad.material = this.materialPressure;
    this.materialPressure.uniforms.texelSize.value.setScalar(this.simTexelSize);
    this.materialPressure.uniforms.uDivergence.value = this.divergenceRT.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i += 1) {
      this.materialPressure.uniforms.uPressure.value = this.pressure.read.texture;
      renderer.setRenderTarget(this.pressure.write);
      this.quad.render(renderer);
      this.pressure.swap();
    }

    this.quad.material = this.materialGradient;
    this.materialGradient.uniforms.texelSize.value.setScalar(this.simTexelSize);
    this.materialGradient.uniforms.uPressure.value = this.pressure.read.texture;
    this.materialGradient.uniforms.uVelocity.value = this.velocity.read.texture;
    renderer.setRenderTarget(this.velocity.write);
    this.quad.render(renderer);
    this.velocity.swap();

    this.quad.material = this.materialAdvection;
    const adv = this.materialAdvection.uniforms;
    adv.texelSize.value.setScalar(this.simTexelSize);
    adv.dyeTexelSize.value.setScalar(this.simTexelSize);
    adv.uVelocity.value = this.velocity.read.texture;
    adv.uSource.value = this.velocity.read.texture;
    adv.dt.value = dt;
    adv.dissipation.value = frictionFPS(VELOCITY_DISSIPATION, dt);
    renderer.setRenderTarget(this.velocity.write);
    this.quad.render(renderer);
    this.velocity.swap();

    adv.dyeTexelSize.value.setScalar(this.dyeTexelSize);
    adv.uVelocity.value = this.velocity.read.texture;
    adv.uSource.value = this.density.read.texture;
    adv.dissipation.value = frictionFPS(DENSITY_DISSIPATION, dt);
    renderer.setRenderTarget(this.density.write);
    this.quad.render(renderer);
    this.density.swap();

    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);
    this.dyeUniform.value = this.density.read.texture;
    this.velUniform.value = this.velocity.read.texture;
  }

  /** Park the splat point so the next pointer move does not splat a long streak. */
  resetPointers() {
    for (const point of this.points) {
      point.position.set(0.5, 0.5);
      point.prevPosition.set(0.5, 0.5);
      point.velocity = 0;
      point.lastSplat = 0;
      point.lastUpdate = 0;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.quad.dispose();
    for (const material of [
      this.materialClear,
      this.materialSplat,
      this.materialCurl,
      this.materialVorticity,
      this.materialDivergence,
      this.materialPressure,
      this.materialGradient,
      this.materialAdvection,
    ]) {
      material.dispose();
    }
    for (const pair of [this.density, this.velocity, this.pressure]) {
      pair.read.dispose();
      pair.write.dispose();
    }
    this.divergenceRT.dispose();
    this.curlRT.dispose();
  }
}
