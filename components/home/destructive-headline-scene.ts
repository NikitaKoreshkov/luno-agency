import * as THREE from "three/webgpu";
import {
  Font,
  TextGeometry,
  TTFLoader,
} from "three/examples/jsm/Addons.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  Fn,
  instanceIndex,
  length,
  mix,
  mx_noise_vec3,
  oneMinus,
  rotate,
  smoothstep,
  storage,
  time,
  uniform,
  vec3,
} from "three/tsl";

import { HERO_HEADLINE_LINES } from "./hero-headline";
import { getPerfBudget } from "@/lib/perf/deviceTier";

type MountOptions = {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  onReady?: () => void;
};

function makeLineGeometry(font: ConstructorParameters<typeof TextGeometry>[1]["font"], text: string, y: number) {
  const geometry = new TextGeometry(text, {
    font,
    size: 1,
    depth: 0.018,
    curveSegments: 6,
    bevelEnabled: false,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;
  geometry.translate(-width / 2 - box.min.x, y - box.min.y - height / 2, 0);
  return geometry;
}

export async function mountDestructiveHeadline({
  canvas,
  host,
  onReady,
}: MountOptions) {
  const budget = getPerfBudget();
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: budget.tier !== "low",
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  // Устройство поднимается параллельно со шрифтом и геометрией: и то и другое
  // нужно только к первому compute/render, а по отдельности это два последовательных
  // раунда ожидания перед появлением заголовка.
  const initPromise = renderer.init();

  const json = await new TTFLoader().loadAsync("/fonts/Unbounded-Headline.ttf");
  const font = new Font(json);
  const lineHeight = 1.28;
  const geos = HERO_HEADLINE_LINES.map((line, index) => {
    const y =
      (HERO_HEADLINE_LINES.length - 1) * 0.5 * lineHeight -
      index * lineHeight;
    return makeLineGeometry(font, line, y);
  });
  const textGeo = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  if (!textGeo) {
    throw new Error("Failed to build headline geometry");
  }

  textGeo.computeBoundingBox();
  const bounds = textGeo.boundingBox;
  const size = new THREE.Vector3();
  if (bounds) {
    bounds.getSize(size);
    textGeo.translate(
      -(bounds.min.x + bounds.max.x) / 2,
      -(bounds.min.y + bounds.max.y) / 2,
      -(bounds.min.z + bounds.max.z) / 2,
    );
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);

  scene.add(new THREE.AmbientLight("#ffffff", 1));

  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
  });
  const mesh = new THREE.Mesh(textGeo, material);
  scene.add(mesh);

  const uInputPos = uniform(new THREE.Vector3());
  const uInputPress = uniform(0);
  const uNoiseAmp = uniform(0.48);
  const uSpring = uniform(0.1);
  const uFriction = uniform(0.86);
  const uExplodeAmp = uniform(0.62);
  const uInfluence = uniform(0.95);

  const count = textGeo.attributes.position.count;
  const initialPosition = storage(textGeo.attributes.position, "vec3", count);
  const positionStorage = storage(
    new THREE.StorageBufferAttribute(count, 3),
    "vec3",
    count,
  );
  const velocityStorage = storage(
    new THREE.StorageBufferAttribute(count, 3),
    "vec3",
    count,
  );

  const computeInit = Fn(() => {
    positionStorage.element(instanceIndex).assign(initialPosition.element(instanceIndex));
    velocityStorage.element(instanceIndex).assign(vec3(0, 0, 0));
  })().compute(count);
  await initPromise;
  await renderer.computeAsync(computeInit);

  const computeUpdate = Fn(() => {
    const basePosition = initialPosition.element(instanceIndex);
    const currentPosition = positionStorage.element(instanceIndex);
    const currentVelocity = velocityStorage.element(instanceIndex);
    const noise = mx_noise_vec3(
      currentPosition.mul(0.7).add(vec3(0, time.mul(0.45), 0)),
      1,
    ).mul(uNoiseAmp);
    const distance = length(uInputPos.sub(basePosition));
    const falloff = oneMinus(smoothstep(0.0, uInfluence, distance));
    const pointerInfluence = falloff.mul(uExplodeAmp);
    const planar = vec3(noise.x, noise.y, noise.z.mul(0.06));
    const distorted = basePosition.add(planar.mul(pointerInfluence));
    distorted.assign(
      rotate(
        distorted,
        vec3(0.0, 0.0, falloff.mul(distance).mul(0.32)),
      ),
    );
    distorted.assign(mix(basePosition, distorted, uInputPress));
    currentVelocity.addAssign(distorted.sub(currentPosition).mul(uSpring));
    currentPosition.addAssign(currentVelocity);
    currentVelocity.assign(currentVelocity.mul(uFriction));
  })().compute(count);

  material.positionNode = positionStorage.toAttribute();

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();
  const hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  const fitCamera = (width: number, height: number) => {
    const aspect = Math.max(width / Math.max(height, 1), 0.01);
    const margin = 1.08;
    const halfW = (size.x * margin) / 2;
    const halfH = (size.y * margin) / 2;
    const contentAspect = halfW / Math.max(halfH, 0.001);
    if (aspect > contentAspect) {
      camera.left = -halfH * aspect;
      camera.right = halfH * aspect;
      camera.top = halfH;
      camera.bottom = -halfH;
    } else {
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfW / aspect;
      camera.bottom = -halfW / aspect;
    }
    camera.position.set(0, 0, 8);
    camera.updateProjectionMatrix();
  };

  let alive = true;
  let revealed = false;
  let resizeScheduled = false;
  const setSize = () => {
    if (!alive) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, budget.heroMaxPixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    fitCamera(width, height);
    if (!revealed && width > 32 && height > 32) {
      revealed = true;
      onReady?.();
    }
  };
  setSize();
  requestAnimationFrame(() => {
    requestAnimationFrame(setSize);
  });

  const readPointer = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.ray.intersectPlane(hitPlane, hitPoint);
    if (!hit) {
      uInputPress.value = 0;
      return false;
    }
    uInputPress.value = 1;
    uInputPos.value.copy(hitPoint);
    return true;
  };

  let capturedId: number | null = null;

  const onPointerDown = (event: PointerEvent) => {
    capturedId = event.pointerId;
    readPointer(event.clientX, event.clientY);
    try {
      host.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" && capturedId !== event.pointerId) return;
    readPointer(event.clientX, event.clientY);
  };

  const endPointer = (event: PointerEvent) => {
    if (capturedId !== null && event.pointerId !== capturedId) return;
    capturedId = null;
    uInputPress.value = 0;
    try {
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (capturedId === null) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    readPointer(touch.clientX, touch.clientY);
  };

  const onLostCapture = () => {
    capturedId = null;
    uInputPress.value = 0;
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (capturedId !== null) return;
    if (event.pointerType === "touch") return;
    uInputPress.value = 0;
  };

  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", endPointer);
  host.addEventListener("pointercancel", endPointer);
  host.addEventListener("lostpointercapture", onLostCapture);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("touchmove", onTouchMove, { passive: false });

  const resizeObserver = new ResizeObserver(() => {
    // ResizeObserver сыпется на каждый кадр Lenis-скролла и на resize окна;
    // setSize пересчитывает пиксель-ратию и матрицу камеры, поэтому один вызов
    // на кадр.
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      setSize();
    });
  });
  resizeObserver.observe(host);

  let visible = true;
  // Без бэкпрешера два неоплавленных промира копятся в очереди GPU, и на слабых
  // машинах петля уходит в бесконечный догон. 4 тика — защита от залипшего флага
  // (промир может не резолвнуться в скрытой вкладке) = чёрный канвас навсегда.
  const minFrameMs = budget.maxFps > 0 ? 1000 / budget.maxFps - 1 : 0;
  let lastFrame = 0;
  let gpuBusy = false;
  let gpuBusyTicks = 0;

  const animate = () => {
    if (!alive) return;
    const now = performance.now();
    if (now - lastFrame < minFrameMs) return;
    lastFrame = now;
    if (gpuBusy) {
      gpuBusyTicks += 1;
      if (gpuBusyTicks < 4) return;
    }
    gpuBusyTicks = 0;
    gpuBusy = true;
    renderer.computeAsync(computeUpdate);
    const frame = renderer.renderAsync(scene, camera);
    const release = () => {
      gpuBusy = false;
      gpuBusyTicks = 0;
    };
    void Promise.resolve(frame).then(release, release);
  };

  // Вне вьюпорта цикл снимается с rAF совсем: ранний return из animate оставлял
  // в каждом кадре лишний колбэк (и на 120 Гц — два), а их суммарное число и
  // решало, успеет ли страница отдать кадр.
  let looping = false;
  const startLoop = () => {
    if (!alive || looping) return;
    looping = true;
    gpuBusy = false;
    gpuBusyTicks = 0;
    lastFrame = 0;
    renderer.setAnimationLoop(animate);
  };
  const stopLoop = () => {
    if (!looping) return;
    looping = false;
    renderer.setAnimationLoop(null);
  };
  startLoop();

  const visibility = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) startLoop();
      else stopLoop();
    },
    { rootMargin: "120px 0px" },
  );
  visibility.observe(host);

  return () => {
    alive = false;
    looping = false;
    renderer.setAnimationLoop(null);
    visibility.disconnect();
    host.removeEventListener("pointerdown", onPointerDown);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerup", endPointer);
    host.removeEventListener("pointercancel", endPointer);
    host.removeEventListener("lostpointercapture", onLostCapture);
    host.removeEventListener("pointerleave", onPointerLeave);
    host.removeEventListener("touchmove", onTouchMove);
    resizeObserver.disconnect();
    textGeo.dispose();
    material.dispose();
    renderer.dispose();
  };
}
