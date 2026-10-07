import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { gsap } from "gsap";
import { getPerfBudget } from "@/lib/perf/deviceTier";
import { probeFloatRenderTarget } from "@/lib/gl/float-capability";
import { prewarmComposer } from "@/lib/three/scenePrewarm";
import { dtRatio } from "./igloo/gpu-glsl";
import { getGlyphVolume } from "./igloo/glyph-volume";
import { FluidSim } from "./igloo/fluid-sim";
import { GpuParticles } from "./igloo/gpu-particles";

/**
 * The bottom-of-page mark: igloo.inc's particle hologram, ported shader-for-shader
 * and constant-for-constant (the `./igloo/` directory is the same transcription
 * the finkey loading-scene ships, with the bundle line numbers it came from).
 *
 * What the mark is made of:
 *
 *  - the `luno` wordmark is rasterized and baked into their SDF volume format
 *    (`./igloo/glyph-volume`), not extruded into geometry, so the compute shader
 *    that pulls particles onto a surface stays byte-identical;
 *  - 150 000 points live in a float MRT ping-pong and are advanced by a
 *    fullscreen compute pass (`./igloo/gpu-particles`);
 *  - pointer travel is handed to their fluid solver (`./igloo/fluid-sim`) and the
 *    particles read velocity back from it, which is the whole interaction.
 *
 * This replaces the old WebGPU instanced-sphere wordmark, which needed
 * `navigator.gpu`, cost a bloom chain per frame, and lost the letter shapes at
 * the low tiers.
 */

type MountOptions = {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  logoHost: HTMLElement;
  /** Пока сцена печёт объём, монтаж может отменить unmount. */
  isCancelled?: () => boolean;
  onReady?: () => void;
  /** Драйвер забрал контекст: поверхность обязана вернуться к DOM-метке. */
  onLost?: () => void;
};

export type HologramWordmarkHandle = () => void;

/** `wF.cubeSize` (bundle 40658). */
const CUBE_SIZE = 0.65;
/** `Be.links[0].scale` for their flat extruded mark (bundle 32182). */
const VOLUME_SCALE = 1.3;
/** `_F` collider sphere radius, in cube units (bundle 40630). */
const CURSOR_RADIUS = 0.27;
/** `wF.initializeShape` (40996): settle the field invisibly for one second. */
const SETTLE_MS = 1000;

/**
 * Палитра взята та, что в вотермарке была до этого порта, а не дефолты igloo:
 * `#b7c6d6` = корпус букв, `#9dd8ff` = свечение, которое появлялось на сдвинутых
 * частицах, `#b8e2f5` = холодный подсвет. `uColorFast` в их шейдере включается по
 * скорости, то есть ровно там, где раньше срабатывал glow, поэтому цвета
 * переезжают один-в-один, а не «похожи».
 *
 * `COLOR_DARK` не брался ниоткуда: в прежней сцене теневая сторона = корпус
 * `#b7c6d6`, умноженный на их ambient 0.1 плюс две подсветки, то есть нейтральный
 * сталь. Их собственный `#222b42` уходит в индиго и окрасил бы всё поле в синий.
 */
const COLOR_LIGHT = "#b7c6d6";
const COLOR_DARK = "#2a2e33";
const COLOR_FAST = "#9dd8ff";
const COLOR_INITIAL = "#b8e2f5";

/**
 * GLYPH_TINT = 0: the `luno` SVG is flat white (`fill="#ffffff"`), so sampling a
 * hue off it would tint the field white and simply wash out the palette. The
 * reference shading chain runs untouched.
 *
 * `RAMP_FLOOR` и `LIGHT_GAIN` = те два дайала, которыми порт подгоняется под
 * чужую палитру. Прежняя вотермарка светилась двумя лампами и bloom-цепочкой,
 * поэтому её средняя яркость по lit-пикселям была luma 144 против 87 у поля на
 * их же косом свете. Пол (0.04 -> 0.18) поднимает именно теневую сторону букв,
 * не трогая блики, а усиляющий множитель добирает остальное.
 */
const GLYPH_TINT = 0;
const LIGHT_GAIN = 1.32;
const RAMP_FLOOR = 0.18;

/** `wF.particles = 150 * 1e3` (40658) on any device that can hold float MRTs. */
function particleCountForTier(tier: "low" | "medium" | "high") {
  return tier === "low" ? 60_000 : 150_000;
}

const yieldFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const GL_ATTRS: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: true,
  stencil: false,
  powerPreference: "default",
  failIfMajorPerformanceCaveat: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
};

/**
 * WebGL2 only: the reference compute shader samples a `sampler3D`, which has no
 * WebGL1 equivalent, and writes a two-target float MRT. A device that cannot do
 * either gets the static mark instead (the mount returns null).
 */
function tryCreateRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  if (!canvas.isConnected) return null;
  try {
    const context = canvas.getContext("webgl2", GL_ATTRS);
    if (!context || context.isContextLost()) return null;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: false,
      alpha: false,
      powerPreference: "default",
      stencil: false,
      depth: true,
      failIfMajorPerformanceCaveat: false,
    });
    const gl = renderer.getContext();
    if (!gl || gl.isContextLost()) {
      renderer.dispose();
      return null;
    }
    if (!gl.getExtension("EXT_color_buffer_float")) {
      renderer.dispose();
      return null;
    }
    // The extension's *name* is not the capability: some drivers accept the
    // float format and hand back zeros. Their 1x1 round trip (bundle
    // 26436-26451) is the gate, and it has to run before 150 000 particles are
    // built on top of a state texture that cannot be written.
    if (!probeFloatRenderTarget(renderer)) {
      renderer.dispose();
      return null;
    }
    return renderer;
  } catch {
    return null;
  }
}

export async function mountHologramWordmark({
  canvas,
  host,
  logoHost,
  isCancelled,
  onReady,
  onLost,
}: MountOptions): Promise<HologramWordmarkHandle | null> {
  const cancelled = () => Boolean(isCancelled?.());
  const budget = getPerfBudget();
  const glyph = await getGlyphVolume();
  if (cancelled() || !canvas.isConnected) return null;
  await yieldFrame();
  if (cancelled() || !canvas.isConnected) return null;

  const renderer = tryCreateRenderer(canvas);
  if (!renderer) return null;

  const scene = new THREE.Scene();
  // Their end-scene lens (bundle 42176-42181: fov 22 tweening to 30 over the
  // entrance). The lens is what sets the dot-to-mark ratio, so it is not free.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  renderer.debug.checkShaderErrors = false;
  // Their display fragment writes device values straight to the buffer: no
  // tonemapping or colourspace include. Turning either on here would shift the
  // palette away from the reference.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The page behind this stage is `--color-bg: #000000`, so an opaque canvas
  // composites exactly like the transparent one the old scene used, and the
  // reference's additive blending keeps its meaning (it assumes a black dst).
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = true;

  // Silhouette half-extents in cube units: the shader samples at
  // `pos / cubeSize * volumeScale + 0.5`, so a volume fraction `f` occupies
  // `f * cubeSize / volumeScale` of cube space.
  const cubePerFraction = CUBE_SIZE / VOLUME_SCALE;
  const halfX = ((glyph.bounds.x1 - glyph.bounds.x0) * cubePerFraction) / 2;
  const halfY = ((glyph.bounds.y1 - glyph.bounds.y0) * cubePerFraction) / 2;

  const globals = {
    time: { value: 0 },
    dtRatio: { value: 1 },
    resolution: { value: new THREE.Vector2(1, 1) },
  };

  const fluid = new FluidSim(renderer);
  let particles: GpuParticles;
  try {
    particles = new GpuParticles({
      renderer,
      count: particleCountForTier(budget.tier),
      cubeSize: CUBE_SIZE,
      volume: glyph.texture,
      volumeScale: VOLUME_SCALE,
      colorMap: glyph.colorTexture,
      tint: GLYPH_TINT,
      lightGain: LIGHT_GAIN,
      rampFloor: RAMP_FLOOR,
      fluidVelocity: fluid.velUniform,
      globals,
    });
  } catch (error) {
    console.error("Hologram wordmark particles failed to build:", error);
    fluid.dispose();
    renderer.dispose();
    return null;
  }
  particles.renderUniforms.uColorLight.value.set(COLOR_LIGHT);
  particles.renderUniforms.uColorDark.value.set(COLOR_DARK);
  particles.renderUniforms.uColorFast.value.set(COLOR_FAST);
  particles.renderUniforms.uColorInitial.value.set(COLOR_INITIAL);
  if (cancelled()) {
    particles.dispose();
    fluid.dispose();
    renderer.dispose();
    return null;
  }

  const logoGroup = new THREE.Group();
  logoGroup.add(particles.mesh);
  scene.add(logoGroup);

  // `_F`: the invisible raycast proxy that turns pointer travel into energy.
  const collider = new THREE.Mesh(
    new THREE.SphereGeometry(CURSOR_RADIUS, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  logoGroup.add(collider);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const smaaPass = new SMAAPass(
    Math.max(1, Math.round(host.clientWidth)),
    Math.max(1, Math.round(host.clientHeight)),
  );
  composer.addPass(smaaPass);

  const pointerNdc = new THREE.Vector2();
  const bakeNdc = new THREE.Vector2();
  const screenPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const worldCenter = new THREE.Vector3();
  const localHit = new THREE.Vector3();
  const splatPosition = new THREE.Vector3();
  const splatLastPosition = new THREE.Vector3();

  let splatLastMoveTime = 0;
  let splatLastRenderTime = 0;
  let splatTargetVelocity = 0;
  let splatVelocity = 0;
  let splatHovered = false;
  let hovering = false;
  let interactForce = 0;
  let elapsed = 0;
  let settleAccum = 0;
  let settled = false;
  let entrance: gsap.core.Timeline | null = null;
  let visible = false;
  let looping = false;
  let disposed = false;
  let readyNotified = false;
  let rafId = 0;
  let lastTime = performance.now();
  let lastFrame = 0;
  let restCamZ = 6;
  let lastDrawW = 0;
  let lastDrawH = 0;
  let lastRatio = 0;

  const unprojectToWorld = (
    clientX: number,
    clientY: number,
    target: THREE.Vector3,
  ) => {
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    bakeNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(bakeNdc, camera);
    return Boolean(raycaster.ray.intersectPlane(screenPlane, target));
  };

  /**
   * Fit the mark to the DOM logo box by moving the camera - never by scaling the
   * group. Their display vertex sizes a dot as `uSize / distance * (resolution.y
   * / 1300)`, while the mark's on-screen height is
   * `2 * halfY / distance * (resolution.y / (2 * tan(fov / 2)))`, so the
   * dot-to-mark ratio collapses to `uSize * tan(fov / 2) / (1300 * halfY)`:
   * distance and pixel ratio cancel out and only the lens plus the cube-unit
   * half-height set it. Scaling the group up grows `halfY` in world units and
   * shrinks every particle to a fraction of a pixel, which is exactly the
   * "частицы очень маленькие" look.
   */
  const MARK_FILL = 0.88;

  const fitDistance = () => {
    const logoRect = logoHost.getBoundingClientRect();
    if (logoRect.width < 2 || logoRect.height < 2) return 0;
    const dpr = renderer.getPixelRatio();
    const resY = Math.max(1, globals.resolution.value.y);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const byWidth = (halfX * resY) / (logoRect.width * dpr * tan) / MARK_FILL;
    const byHeight = (halfY * resY) / (logoRect.height * dpr * tan) / MARK_FILL;
    return Math.max(byWidth, byHeight);
  };

  const bakeLogoToDom = () => {
    const logoRect = logoHost.getBoundingClientRect();
    if (logoRect.width < 2) return false;
    const midY = logoRect.top + logoRect.height / 2;
    const midX = logoRect.left + logoRect.width / 2;
    if (!unprojectToWorld(midX, midY, worldCenter)) return false;
    logoGroup.position.copy(worldCenter);
    logoGroup.scale.setScalar(1);
    logoGroup.updateMatrixWorld(true);
    return true;
  };

  const fitCamera = (width: number, height: number) => {
    const aspect = Math.max(width / Math.max(height, 1), 0.01);
    camera.aspect = aspect;
    const d = fitDistance();
    restCamZ = d > 0 ? d : 6;
    camera.position.set(0, 0, restCamZ);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    bakeLogoToDom();
  };

  /**
   * Бюджет по площади кадра, как в прежней сцене этого блока: на 1440px стадия
   * с контактным блоком внутри даёт ~2 Mpix CSS, и без капитала частицы писались
   * в 1.5 DPR. Point-спрайт растёт вместе с разрешением (`uSize / dist *
   * resolution.y / 1300`), поэтому площадь кадра и есть настоящая цена.
   */
  const MAX_STAGE_PIXELS = 2_200_000;

  const setSize = (force = false) => {
    const width = Math.max(1, Math.round(host.clientWidth));
    const height = Math.max(1, Math.round(host.clientHeight));
    const ratioByArea = Math.sqrt(MAX_STAGE_PIXELS / (width * height));
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      budget.maxPixelRatio,
      Math.max(1, ratioByArea),
    );
    if (!force && width === lastDrawW && height === lastDrawH && ratio === lastRatio) {
      // The canvas did not change but the logo box may have (a media query can
      // move it), and the fit is solved from that box.
      fitCamera(width, height);
      return;
    }
    lastDrawW = width;
    lastDrawH = height;
    lastRatio = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    // The composer caches the ratio from construction; a change has to be pushed
    // into it or the SMAA chain keeps the old drawing-buffer size.
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    smaaPass.setSize(width * ratio, height * ratio);
    // The fit solves a distance from the drawing-buffer height, so it has to run
    // after the new size is committed.
    renderer.getDrawingBufferSize(globals.resolution.value);
    fitCamera(width, height);
  };
  setSize();

  // Compile the particle programs and the SMAA chain while the canvas is still
  // at opacity 0: their `_upload` order (bundle 26613-26636) - force the objects
  // visible, link every program, push every texture to the GPU, render once.
  try {
    prewarmComposer(renderer, scene, camera, composer);
  } catch {
    /* context may be lost on a hidden tab */
  }

  /**
   * `_F.onMove` + `onHover` (bundle 40639-40645). The pointer becomes the fluid
   * splat point in 0..1 stage space, and the hit on the proxy sphere becomes the
   * energy source - in cube-local units, so their thresholds stay meaningful.
   */
  const trackPointer = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x01 = (clientX - rect.left) / rect.width;
    const y01 = 1 - (clientY - rect.top) / rect.height;
    fluid.points[0].position.set(x01, y01);
    pointerNdc.set(x01 * 2 - 1, y01 * 2 - 1);

    logoGroup.updateMatrixWorld();
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObject(collider, false)[0];
    if (hit) {
      localHit.copy(hit.point);
      logoGroup.worldToLocal(localHit);
      splatPosition.copy(localHit);
      if (!hovering) {
        splatHovered = true;
        hovering = true;
      }
    } else {
      hovering = false;
    }
  };

  // Форма заявки живёт внутри стадии: курсор над полями не должен тревожить поле.
  const isChromeTarget = (event: Event) => {
    const node = event.target;
    return (
      node instanceof Element &&
      Boolean(node.closest("button, a, input, textarea, select, [role='button']"))
    );
  };

  const onPointerMove = (event: PointerEvent) => {
    if (isChromeTarget(event)) return;
    trackPointer(event.clientX, event.clientY);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (isChromeTarget(event)) return;
    trackPointer(event.clientX, event.clientY);
  };

  const onPointerLeave = () => {
    hovering = false;
  };

  host.addEventListener("pointerdown", onPointerDown, true);
  host.addEventListener("pointermove", onPointerMove, {
    capture: true,
    passive: true,
  });
  host.addEventListener("pointerleave", onPointerLeave);

  /**
   * `_F.update(interactForce)` (bundle 40646-40652), verbatim: the 0.015 s
   * render throttle, the 0.15 s idle reset, `+t * 4`, `* 0.97`, the `0.05`
   * follow, and both clamps to the interaction force.
   */
  const stepCursor = (e: number) => {
    if (elapsed - splatLastRenderTime < 0.015) return;
    splatLastRenderTime = elapsed;
    let t = splatPosition.distanceTo(splatLastPosition);
    const s = elapsed - splatLastMoveTime;
    if (t > 0) splatLastMoveTime = elapsed;
    if (s > 0.15 || splatHovered || t > 0.3) {
      splatLastPosition.copy(splatPosition);
      t = 0;
    }
    splatHovered = false;
    splatTargetVelocity += t * 4;
    splatTargetVelocity *= 0.97;
    splatTargetVelocity = Math.max(0, Math.min(e, splatTargetVelocity));
    splatVelocity += (splatTargetVelocity - splatVelocity) * 0.05;
    splatVelocity = Math.max(0, Math.min(e, splatVelocity));
    splatLastPosition.copy(splatPosition);
  };

  /**
   * Bundle 42205-42226, re-anchored so t = 0 is the moment the mark appears
   * (their timeline reveals at 1.5 s and starts the noise/glow tweens 2.0 s and
   * 2.4 s after that). The `from` values are also set up front, because the
   * reference relies on `fromTo` immediateRender for the hidden-noisy state.
   */
  const startEntrance = () => {
    particles.mesh.visible = true;
    particles.renderUniforms.uAlpha.value = 0;
    particles.renderUniforms.uInitialGlow.value = 1;
    particles.computeUniforms.uShowNoise.value = 1;
    entrance = gsap.timeline({
      onComplete: () => {
        entrance = null;
      },
    });
    entrance.fromTo(
      particles.renderUniforms.uAlpha,
      { value: 0 },
      { value: 1, duration: 2.5, ease: "power2.inOut" },
      0,
    );
    entrance.fromTo(
      particles.computeUniforms.uShowNoise,
      { value: 1 },
      { value: 0, duration: 1.5, ease: "power1.inOut" },
      2,
    );
    entrance.fromTo(
      particles.renderUniforms.uInitialGlow,
      { value: 1 },
      { value: 0, duration: 1, ease: "power1.inOut" },
      2.4,
    );
  };

  // Кап по бюджету: на 120 Гц панели без него сцена сжигала вдвое больше кадров,
  // чем ей положено, и отбирала время у скролла.
  const minFrameMs = budget.maxFps > 0 ? 1000 / budget.maxFps - 1 : 0;

  const tick = () => {
    // The settle runs off screen (the block is booted early, and the reference
    // arrives pre-formed for exactly that reason). Once the field is formed,
    // drawing stops when the reader is not looking at it.
    if (disposed || (settled && !visible)) {
      looping = false;
      return;
    }
    looping = true;
    rafId = requestAnimationFrame(tick);

    const now = performance.now();
    if (document.hidden) {
      lastTime = now;
      return;
    }
    if (now - lastFrame < minFrameMs) return;
    const deltaMs = Math.max(1, Math.round(now - lastTime));
    const delta = Math.min(0.033, deltaMs / 1000);
    lastTime = now;
    lastFrame = now;
    elapsed += delta;

    globals.time.value = elapsed;
    globals.dtRatio.value = dtRatio(deltaMs);
    renderer.getDrawingBufferSize(globals.resolution.value);

    // `wF.update` (41003-41010): fluid first, then the constant spin.
    // `-deltaMs * 75e-5` is 0.72 rad/s at 60 fps.
    const aspect = globals.resolution.value.x / Math.max(1, globals.resolution.value.y);
    fluid.update(elapsed, deltaMs, aspect);
    particles.computeUniforms.uRotation.value -= deltaMs * 75e-5;

    // `initializeShape`: run the compute pass for one second of frames before
    // anything is allowed to draw, so the shell is already formed on reveal.
    // Their scroll gate is closed while this happens, so the interaction force
    // is 0 for the whole settle - the field forms from spring + surface pull +
    // curl noise alone.
    if (!settled) {
      settleAccum += deltaMs;
      particles.compute(renderer, camera);
      if (settleAccum > SETTLE_MS) {
        settled = true;
        particles.renderUniforms.uVisible.value = 1;
        startEntrance();
        if (!readyNotified) {
          readyNotified = true;
          onReady?.();
        }
      }
      return;
    }

    // Their `uInteractForce = s * n` (41006) is a scroll-progress window; the
    // equivalent here is the block's own on-screen window, eased so the fluid
    // push cannot pop when the reader arrives or leaves.
    const ease = 1 - Math.exp(-2.2 * delta);
    interactForce += (1 - interactForce) * ease;
    particles.computeUniforms.uInteractForce.value = interactForce;

    stepCursor(interactForce);

    particles.compute(renderer, camera);
    composer.render();

    if (!readyNotified) {
      readyNotified = true;
      onReady?.();
    }
  };

  // Start the settle loop immediately. `visible` still controls whether frames
  // keep being drawn once the field is formed.
  tick();

  /*
   * Драйвер может забрать контекст посреди сессии, и three после этого рисует
   * ничего. Разбираем сцену и возвращаем поверхность DOM-метке.
   */
  const onContextLost = (event: Event) => {
    event.preventDefault();
    if (disposed) return;
    disposed = true;
    looping = false;
    cancelAnimationFrame(rafId);
    teardown();
    onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost, { once: true });

  /*
   * Цикл живёт только пока вотермарка в вьюпорте: 150 000 частиц + compute-проход
   * + SMAA на буфере ~2.2 Mpix - самый дорогой слой страницы, платить им в каждом
   * блоке нельзя.
   */
  const visibility = new IntersectionObserver(
    (entries) => {
      const on = entries.some((entry) => entry.isIntersecting) && !document.hidden;
      visible = on;
      if (on && !disposed && !looping) {
        lastTime = performance.now();
        lastFrame = 0;
        tick();
      }
      // Выключение не останавливает цикл напрямую: следующий tick видит
      // `settled && !visible` и выходит из rAF сам.
    },
    { rootMargin: "80px" },
  );
  visibility.observe(host);

  const onVisibility = () => {
    if (document.hidden) {
      visible = false;
      return;
    }
    visible = true;
    if (!disposed && !looping) {
      lastTime = performance.now();
      lastFrame = 0;
      tick();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // RO сыпется на каждый кадр Lenis-скролла, а setSize читает layout и пересобирает
  // SMAA-цепочку — один вызов на кадр.
  let resizeScheduled = false;
  const resizeObserver = new ResizeObserver(() => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      setSize();
    });
  });
  resizeObserver.observe(host);
  resizeObserver.observe(logoHost);

  return () => {
    if (disposed) return;
    disposed = true;
    looping = false;
    cancelAnimationFrame(rafId);
    teardown();
  };

  /** Shared by the returned cleanup and `webglcontextlost`: every GPU + listener release. */
  function teardown(): void {
    entrance?.kill();
    entrance = null;
    resizeObserver.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    host.removeEventListener("pointerdown", onPointerDown, true);
    host.removeEventListener("pointermove", onPointerMove, true);
    host.removeEventListener("pointerleave", onPointerLeave);
    collider.geometry.dispose();
    (collider.material as THREE.Material).dispose();
    particles.dispose();
    fluid.dispose();
    smaaPass.dispose();
    composer.dispose();
    renderer.dispose();
    // Three's `dispose()` releases its own bookkeeping but leaves the driver
    // context alive; the live-context cap is per process, so a mark that mounts
    // and unmounts across route changes would otherwise burn contexts forever.
    renderer.forceContextLoss();
  }
}
