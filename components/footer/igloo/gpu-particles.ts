import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import {
  GLSL_AASTEP,
  GLSL_FIT,
  GLSL_FPS,
  GLSL_GLOBAL,
  GLSL_LINEARSTEP,
  GLSL_NOISE,
  GLSL_ROT,
  textureSizeForParticles,
} from "./gpu-glsl";

/**
 * Port of igloo.inc's GPGPU particle system: `n3` geometry (bundle 31838),
 * `r3` texture ping-pong (31861), `gE` factory (31949) and the `wF` display +
 * compute materials (40687-40993). All four shader sources are verbatim apart
 * from their position clamp, which is deleted (see the note in the compute body).
 *
 * Mechanics that make the port exact, not approximate:
 *
 *  - State lives in a float RGBA MRT pair. The compute pass is a fullscreen
 *    triangle over a `size x size` target, so fragment (x, y) *is* particle
 *    `y * size + x`; each vertex carries `texuv` pointing at its own texel.
 *  - `onBeforeRender` in their `r3` is replaced by an explicit `compute()` call
 *    from the frame loop, before the composer renders. Same order (state written,
 *    then drawn in the same frame) without re-entering `renderer.render()`.
 *  - Their compute vertex shader reads `attribute vec4 rand` off the fullscreen
 *    triangle, which only has `position` and `uv` (bundle 30300). WebGL therefore
 *    feeds the default generic attribute (0, 0, 0, 1) to every fragment. We bind
 *    the same triangle, so `force1`, `force2` and the noise time offset resolve to
 *    exactly the numbers their site runs with. Adding a real per-particle `rand`
 *    here would change the look, not fix it.
 *
 * The only API difference from the finkey loading-scene copy: three dropped
 * `WebGLMultipleRenderTargets` in r171, so the two-attachment state is a
 * `WebGLRenderTarget` with `count: 2` and the attachments read back through
 * `.textures` (`.texture` is attachment 0 only from that version on).
 */

const DISPLAY_VERTEX = /* glsl */ `
${GLSL_GLOBAL}
${GLSL_ROT}

attribute vec4 rand;
attribute vec2 texuv;
uniform sampler2D tTexture1;
uniform sampler2D tTexture2;

uniform float uSize;

// Our addition: the glyph's own gradient, looked up with the same coordinate the
// compute pass uses for the SDF, so a colour sticks to the surface it belongs to
// and travels with the spin.
uniform sampler2D tGlyph;
uniform float uRotation;
uniform float uCubeSize;
uniform float uVolumeScale;

varying float vShadow;
varying float vVel;
varying float vY;
varying vec3 vTint;

void main() {
  vec4 posData = texture2D(tTexture1, texuv);
  vec4 velData = texture2D(tTexture2, texuv);

  vec3 pos = posData.xyz;
  vec4 vPos = modelViewMatrix * vec4(pos, 1.0);
  float size = uSize;

  vec3 volumePos = rotateY(uRotation) * (pos / uCubeSize) * uVolumeScale + 0.5;
  vTint = texture2D(tGlyph, volumePos.xy).rgb;

  vShadow = posData.w;
  vVel = velData.w;
  vY = posData.y;

  gl_Position = projectionMatrix * vPos;
  gl_PointSize = size / length(vPos.xyz) * (resolution.y / 1300.0);
}
`;

const DISPLAY_FRAGMENT = /* glsl */ `
${GLSL_GLOBAL}
${GLSL_AASTEP}
${GLSL_FIT}
${GLSL_ROT}
${GLSL_LINEARSTEP}

uniform vec3 uColorLight;
uniform vec3 uColorDark;
uniform vec3 uColorInitial;
uniform vec3 uColorFast;

uniform vec3 uLightPos;

uniform float uVisible;
uniform float uAlpha;
uniform float uInitialGlow;

// Our additions on top of their shading chain: the SVG gradient as a hue, and a
// gain for the light. uTint 0 reproduces their palette exactly.
uniform float uTint;
uniform float uLightGain;
uniform float uRampFloor;

varying float vShadow;
varying float vVel;
varying float vY;
varying vec3 vTint;

void main() {
  float alpha = step(length(gl_PointCoord.xy - 0.5), 0.5) * uVisible;
  if (alpha < 0.001) discard;

  // calculate normal
  vec2 uv = 2.0 * gl_PointCoord.xy - 1.0;
  vec3 n = vec3(uv, sqrt(1.0 - clamp(dot(uv, uv), 0.0, 1.0)));
  n.y = 1.0 - n.y;

  // calculate light direction
  float lightShadow = max(0.0, dot(normalize(rotateY(3.1416) * uLightPos), normalize(n)));
  float ramp = max(lightShadow * vShadow, uRampFloor);

  // base color
  vec3 color = mix(uColorDark, uColorLight, ramp);

  // highlight color for velocity
  color = mix(color, uColorFast, pow(fit(vVel, 0.003, 0.005, 0.0, 1.0), 2.0));

  // Hue from the glyph at the reference's own luminance. Scaling the tint vector
  // to carry the same luma as the shaded colour is what keeps the field as bright
  // as it was: multiplying by a max-normalised hue instead costs ~25% of it, which
  // reads as "тускло". uLightGain is therefore pure brightness, not a correction.
  vec3 hue = vTint / max(max(vTint.r, max(vTint.g, vTint.b)), 1e-4);
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  float keep = dot(color, LUMA);
  float hueLuma = max(dot(hue, LUMA), 1e-4);
  color = mix(color, hue * (keep / hueLuma), uTint);
  color *= uLightGain;

  // poor's man motion blur
  alpha *= max(uInitialGlow, pow(fit(vVel, 0.002, 0.007, 1.0, 0.0), 2.0) * 0.5 + 0.5);

  // we do a blending trick here. the initial hidden state requires: alpha 0, uInitialGlow 1 and color white
  // alpha must be animated first and the color used will be
  vec3 fadeInColor = mix(vec3(1.0), uColorInitial, linearstep(0.0, 1.0, uAlpha));
  color = mix(color, fadeInColor, uInitialGlow);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha * uAlpha);
}
`;

const COMPUTE_VERTEX = /* glsl */ `
attribute vec4 rand;
varying vec4 vRand;
void main() {
  vRand = rand;
  gl_Position = vec4(position, 1.0);
}
`;

const COMPUTE_FRAGMENT = /* glsl */ `

varying vec4 vRand;

#define outPos pc_fragColor
uniform sampler2D tTexture1;

layout(location = 1) out highp vec4 outVel;
uniform sampler2D tTexture2;

uniform sampler2D tOrig;
uniform sampler2D tVel;

uniform mat4 uProjMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

uniform float uCubeSize;
uniform vec3 uLightPos;
uniform float uRotation;
uniform float uAdditionalNoise;
uniform float uShowNoise;
uniform float uInteractForce;

#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp sampler3D;
#else
  precision mediump sampler3D;
#endif
uniform sampler3D tVolume;
uniform float uVolumeScale;

${GLSL_GLOBAL}
${GLSL_FPS}
${GLSL_NOISE}
${GLSL_ROT}

void main() {
  ivec2 uv = ivec2(gl_FragCoord.xy);
  vec4 currentPos = texelFetch(tTexture1, uv, 0);
  vec4 currentVel = texelFetch(tTexture2, uv, 0);
  float positionLimit = uCubeSize * 0.5;

  // constant rotation
  mat3 rotMatrix = rotateY(uRotation);

  // sample volume
  vec3 samplePos = rotMatrix * (currentPos.xyz / uCubeSize) * uVolumeScale + 0.5;

  vec4 volData = texture(tVolume, samplePos);
  vec3 grad = normalize(volData.rgb * 2.0 - 1.0) * rotMatrix;
  float dist = (volData.a * 2.0 - 1.0) * 2.0;

  // velocity

  // fluid sim interaction
  float pushForce = 0.0005;
  vec4 wPos = uModelMatrix * vec4(currentPos.xyz, 1.0);
  vec4 vPos = uViewMatrix * wPos;
  vec4 posProjected = uProjMatrix * vPos;
  vec2 uvScreen = (posProjected.xy / posProjected.w + 1.0) * 0.5;
  vec3 vel = texture2D(tVel, uvScreen).xyz;
  vec3 up = vec3(uViewMatrix[0][1], uViewMatrix[1][1], uViewMatrix[2][1]);
  vec3 right = vec3(uViewMatrix[0][0], uViewMatrix[1][0], uViewMatrix[2][0]);
  vec3 disp = right * vel.x + up * vel.y;
  currentVel.xyz += disp * pushForce * dtRatio * uInteractForce;
  float invFluidStrength = 1.0 - length(vel) * 0.65 * uInteractForce;

  float additionalNoise = max(uAdditionalNoise, uShowNoise);

  // add curl noise
  float force1 = 0.0002 * (0.7 + 0.3 * vRand.z) + 0.0004 * additionalNoise;
  currentVel.xyz += BitangentNoise4D(vec4((currentPos.xyz) * 7.0, time * (1.0 + 0.7 * vRand.y))) * force1 * dtRatio;

  // towards origanl position
  vec4 origPos = texelFetch(tOrig, uv, 0);
  vec3 toOrig = origPos.xyz - currentPos.xyz;
  currentVel.xyz += (origPos.xyz - currentPos.xyz) * 0.001 * dtRatio * invFluidStrength;

  // towards the surface
  float force2 = 0.0015 * (0.7 + 0.3 * vRand.w);
  float signForce = mix(0.0, -0.3, sign(dist) + 1.0);
  currentVel.xyz += grad * force2 * signForce * dtRatio * invFluidStrength;

  // friction
  currentVel.xyz *= frictionFPS(0.9, dtRatio);

  // position

  // add vel to position
  currentPos.xyz += currentVel.xyz * dtRatio;

  // Their cylinder clamp (bundle 40968) is deleted on purpose: curl noise re-pins
  // every particle it drives outward onto that shell, and the shell's flat side is
  // the wall that stood beside the glyph. Spring + surface pull bound the field.

  // https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering
  vec3 lightPos = normalize(uLightPos);
  float wrap = 0.25;
  float dp = dot(lightPos, grad);
  float wrapDiffuse = max(0.0, (dp + wrap) / (1.0 + wrap));

  // bounce
  dp = -dp;
  wrapDiffuse += max(0.0, dp) * 0.1;

  // particles inside the volume are dark
  float targetShadow = mix(wrapDiffuse * 0.2, wrapDiffuse, smoothstep(-0.05, -0.001, dist));
  currentPos.a = mix(targetShadow, currentPos.a, additionalNoise);

  // save the length of the velocity interpolated for emissiviness
  currentVel.a = lerpFPS(currentVel.a, length(currentVel.xyz), 0.035, dtRatio);

  outVel = currentVel;
  outPos = currentPos;
}
`;

const COPY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * `r3`'s generated blit (bundle 31884-31897): first output reuses
 * `pc_fragColor`, the rest get explicit locations. Kept as a generator so the
 * MRT layout stays whatever their code produces.
 */
function copyFragment(names: string[]) {
  let src = "varying vec2 vUv;\n";
  names.forEach((name, index) => {
    src +=
      index === 0
        ? "#define outTex1 pc_fragColor\n"
        : `layout(location = ${index}) out highp vec4 outTex${index + 1};\n`;
    src += `uniform sampler2D ${name};\n`;
  });
  src += "void main() {\n";
  names.forEach((_name, index) => {
    src += `outTex${index + 1} = texture2D(${_name}, vUv);\n`;
  });
  src += "}";
  return src;
}

export type ParticleWorldUniforms = {
  /** `ae` / `Global`: seconds, 60 fps-normalised delta, drawing-buffer size. */
  time: { value: number };
  dtRatio: { value: number };
  resolution: { value: THREE.Vector2 };
};

export type GpuParticlesOptions = {
  renderer: THREE.WebGLRenderer;
  count: number;
  cubeSize: number;
  volume: THREE.Data3DTexture;
  volumeScale: number;
  /** Our glyph gradient, sampled by the display pass to tint the field. */
  colorMap: THREE.DataTexture;
  /** 0 reproduces their palette exactly, 1 is the full SVG hue. */
  tint: number;
  lightGain: number;
  rampFloor: number;
  /** `fluidSim.velUniform`: the shared object, read live every frame. */
  fluidVelocity: { value: THREE.Texture | null };
  globals: ParticleWorldUniforms;
};

/** `new Z(hex)` without ColorManagement's sRGB -> linear conversion. */
function rawColor(hex: string) {
  return new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
}

export class GpuParticles {
  readonly mesh: THREE.Points;
  readonly renderUniforms: {
    tTexture1: { value: THREE.Texture | null };
    tTexture2: { value: THREE.Texture | null };
    uColorInitial: { value: THREE.Color };
    uColorLight: { value: THREE.Color };
    uColorDark: { value: THREE.Color };
    uColorFast: { value: THREE.Color };
    uSize: { value: number };
    uLightPos: { value: THREE.Vector3 };
    uVisible: { value: number };
    uAlpha: { value: number };
    uInitialGlow: { value: number };
    tGlyph: { value: THREE.DataTexture };
    uTint: { value: number };
    uLightGain: { value: number };
    uRampFloor: { value: number };
    /** Shared with the compute pass so the tint turns with the shape. */
    uRotation: { value: number };
    uCubeSize: { value: number };
    uVolumeScale: { value: number };
  };
  readonly computeUniforms: {
    tTexture1: { value: THREE.Texture | null };
    tTexture2: { value: THREE.Texture | null };
    tOrig: { value: THREE.DataTexture };
    tVel: { value: THREE.Texture | null };
    uViewMatrix: { value: THREE.Matrix4 };
    uModelMatrix: { value: THREE.Matrix4 };
    uProjMatrix: { value: THREE.Matrix4 };
    uRotation: { value: number };
    uCubeSize: { value: number };
    tVolume: { value: THREE.Data3DTexture };
    uVolumeScale: { value: number };
    uLightPos: { value: THREE.Vector3 };
    uInteractForce: { value: number };
    uAdditionalNoise: { value: number };
    uShowNoise: { value: number };
  };

  private readonly rt1: THREE.WebGLRenderTarget;
  private readonly rt2: THREE.WebGLRenderTarget;
  private readonly quad: FullScreenQuad;
  private readonly renderMaterial: THREE.ShaderMaterial;
  private readonly computeMaterial: THREE.ShaderMaterial;
  private rtCurrent = 0;
  private disposed = false;

  constructor(options: GpuParticlesOptions) {
    const {
      renderer,
      count,
      cubeSize,
      volume,
      volumeScale,
      colorMap,
      tint,
      lightGain,
      rampFloor,
      fluidVelocity,
      globals,
    } = options;
    const size = textureSizeForParticles(count);
    const type = THREE.FloatType;

    // `n3` (31838): zero positions, four randoms per particle, and the texel
    // centre of its own slot.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const rand = new Float32Array(count * 4);
    const texuv = new Float32Array(count * 2);
    const half = (1 / size) * 0.5;
    for (let i = 0; i < count; i += 1) {
      rand[i * 4] = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = Math.random();
      rand[i * 4 + 3] = Math.random();
      texuv[i * 2] = ((i % size) / size + half);
      texuv[i * 2 + 1] = (Math.floor(i / size) / size + half);
    }
    geometry.setAttribute("rand", new THREE.BufferAttribute(rand, 4));
    geometry.setAttribute("texuv", new THREE.BufferAttribute(texuv, 2));

    // Initial state (40677-40685): w = the particle's own shadow seed, velocity
    // zeroed, orig a copy of the start positions. Their spread is a cube of
    // ±cubeSize/2 on every axis.
    const initial = new Float32Array(size * size * 4);
    const spread = cubeSize * 0.5;
    for (let i = 0; i < count; i += 1) {
      initial[i * 4] = Math.random() * 2 * spread - spread;
      initial[i * 4 + 1] = Math.random() * 2 * spread - spread;
      initial[i * 4 + 2] = Math.random() * 2 * spread - spread;
      initial[i * 4 + 3] = Math.random();
    }
    const makeData = (data: Float32Array) => {
      const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, type);
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    };
    const posTex = makeData(initial);
    const velTex = makeData(new Float32Array(size * size * 4));
    const origTex = makeData(initial.slice());

    const rtOpts: THREE.WebGLRenderTargetOptions = {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type,
      depthBuffer: false,
    };
    this.rt1 = new THREE.WebGLRenderTarget(size, size, { ...rtOpts, count: 2 });
    this.rt2 = new THREE.WebGLRenderTarget(size, size, { ...rtOpts, count: 2 });

    // Seed both ping-pong halves from the initial textures, exactly as `r3`.
    const names = ["tTexture1", "tTexture2"];
    const seedUniforms: Record<string, { value: THREE.Texture | null }> = {
      tTexture1: { value: posTex },
      tTexture2: { value: velTex },
    };
    const seedMaterial = new THREE.ShaderMaterial({
      uniforms: seedUniforms,
      vertexShader: COPY_VERTEX,
      fragmentShader: copyFragment(names),
    });
    const seedQuad = new FullScreenQuad(seedMaterial);
    const prevAutoClear = renderer.autoClear;
    const prevTarget = renderer.getRenderTarget();
    renderer.autoClear = false;
    renderer.setRenderTarget(this.rt1);
    seedQuad.render(renderer);
    renderer.setRenderTarget(this.rt2);
    seedQuad.render(renderer);
    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);
    seedQuad.dispose();
    seedMaterial.dispose();
    posTex.dispose();
    velTex.dispose();

    // One object each, bound into both materials: the display pass has to sample
    // the colour map with the same rotated coordinate the compute pass uses for
    // the SDF, or the hue would slide across the shape while it spins.
    const rotation = { value: 0 };
    const cubeSizeU = { value: cubeSize };
    const volumeScaleU = { value: volumeScale };

    this.renderUniforms = {
      tTexture1: { value: null },
      tTexture2: { value: null },
      uColorInitial: { value: rawColor("#b5d5ff") },
      uColorLight: { value: rawColor("#bdc6d4") },
      uColorDark: { value: rawColor("#222b42") },
      uColorFast: { value: rawColor("#d7ebfa") },
      uSize: { value: 10 },
      uLightPos: { value: new THREE.Vector3(-0.75, 1, -0.1) },
      uVisible: { value: 0 },
      uAlpha: { value: 1 },
      uInitialGlow: { value: 0 },
      tGlyph: { value: colorMap },
      uTint: { value: tint },
      uLightGain: { value: lightGain },
      uRampFloor: { value: rampFloor },
      uRotation: rotation,
      uCubeSize: cubeSizeU,
      uVolumeScale: volumeScaleU,
    };
    this.computeUniforms = {
      tTexture1: { value: null },
      tTexture2: { value: null },
      tOrig: { value: origTex },
      tVel: fluidVelocity,
      uViewMatrix: { value: new THREE.Matrix4() },
      uModelMatrix: { value: new THREE.Matrix4() },
      uProjMatrix: { value: new THREE.Matrix4() },
      uRotation: rotation,
      uCubeSize: cubeSizeU,
      tVolume: { value: volume },
      uVolumeScale: volumeScaleU,
      uLightPos: this.renderUniforms.uLightPos,
      uInteractForce: { value: 1 },
      uAdditionalNoise: { value: 0 },
      uShowNoise: { value: 0 },
    };

    this.renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...this.renderUniforms,
        resolution: globals.resolution,
        time: globals.time,
        dtRatio: globals.dtRatio,
      },
      vertexShader: DISPLAY_VERTEX,
      fragmentShader: DISPLAY_FRAGMENT,
      depthTest: true,
      depthWrite: true,
      transparent: true,
      // bundle 40809-40815: CustomBlending, AddEquation,
      // src = SrcAlpha, dst = SrcColor.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.SrcColorFactor,
    });

    this.computeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...this.computeUniforms,
        resolution: globals.resolution,
        time: globals.time,
        dtRatio: globals.dtRatio,
      },
      vertexShader: COMPUTE_VERTEX,
      fragmentShader: COMPUTE_FRAGMENT,
    });

    this.quad = new FullScreenQuad(this.computeMaterial);

    this.mesh = new THREE.Points(geometry, this.renderMaterial);
    this.mesh.frustumCulled = false;
    this.mesh.name = "volume particles";
    this.mesh.visible = false;
  }

  /** `r3.compute()` (31916-31941), called explicitly once per frame. */
  compute(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    if (this.disposed) return;
    this.computeUniforms.uModelMatrix.value.copy(this.mesh.matrixWorld);
    this.computeUniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
    this.computeUniforms.uProjMatrix.value.copy(camera.projectionMatrix);

    const write = this.rtCurrent === 0 ? this.rt1 : this.rt2;
    const read = this.rtCurrent === 0 ? this.rt2 : this.rt1;
    this.rtCurrent = (this.rtCurrent + 1) % 2;

    const readTextures = read.textures;
    this.computeUniforms.tTexture1.value = readTextures[0];
    this.computeUniforms.tTexture2.value = readTextures[1];

    const prevAutoClear = renderer.autoClear;
    const prevTarget = renderer.getRenderTarget();
    const prevClearColor = new THREE.Color();
    renderer.getClearColor(prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();

    renderer.autoClear = false;
    renderer.setRenderTarget(write);
    renderer.setClearColor(new THREE.Color("#000000"), 0);
    renderer.clear(true, false, false);
    this.quad.render(renderer);

    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);

    const writeTextures = write.textures;
    this.renderUniforms.tTexture1.value = writeTextures[0];
    this.renderUniforms.tTexture2.value = writeTextures[1];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.quad.dispose();
    this.computeMaterial.dispose();
    this.renderMaterial.dispose();
    this.rt1.dispose();
    this.rt2.dispose();
    this.computeUniforms.tOrig.value.dispose();
    this.mesh.geometry.dispose();
  }
}
