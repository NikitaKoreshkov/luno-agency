import * as THREE from "three";

/**
 * Port of igloo.inc's scene `_upload()` (bundle 26613-26636).
 *
 * A three.js scene pays for itself twice: once in the first frame's shader
 * compiles, and once when every texture is finally uploaded to the GPU. Both
 * land on the frame the reader first sees the surface, which is exactly the
 * hitch our corridor measurements kept catching. Their fix is to do it eagerly
 * and invisibly: force every object visible and unculled, compile the programs,
 * upload the textures, render one throwaway frame into an offscreen target, then
 * put the flags back.
 *
 * Their engine calls `renderer.compileAsync`; three 0.156.1 only has the
 * synchronous `compile()` (`three.module.js:28893`) plus `initTexture()`
 * (`:30352`), so the port is synchronous. That is fine for us because every
 * caller runs it while the canvas is still hidden behind a plate or an opacity 0
 * wrapper, never inside a scroll frame.
 */

/** Every texture a material references, uniform slots included (r156 `dispose()`
 *  misses those, theirs does not). */
function collectTextures(scene: THREE.Object3D, into: Set<THREE.Texture>): void {
  scene.traverse((node) => {
    const object = node as THREE.Mesh;
    const material = object.material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      const uniforms = (entry as THREE.ShaderMaterial).uniforms as
        | Record<string, { value?: unknown }>
        | undefined;
      if (uniforms) {
        for (const slot of Object.values(uniforms)) {
          const value = slot.value as { isTexture?: boolean } | null;
          if (value && value.isTexture) into.add(value as THREE.Texture);
        }
      }
      for (const value of Object.values(entry as unknown as Record<string, unknown>)) {
        const texture = value as { isTexture?: boolean } | null;
        if (texture && texture.isTexture) into.add(texture as THREE.Texture);
      }
    }
  });
}

type SavedState = {
  frustumCulled: boolean;
  visible: boolean;
  materialVisible: boolean;
  depthVisible?: boolean;
  distanceVisible?: boolean;
};

/**
 * Compile + upload everything the scene needs, into an offscreen target, without
 * letting the surface draw a half-built frame.
 */
export function prewarmScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { size?: number } = {},
): void {
  const textures = new Set<THREE.Texture>();
  collectTextures(scene, textures);

  const saved = new Map<THREE.Object3D, SavedState>();
  scene.traverse((node) => {
    const object = node as THREE.Mesh;
    const material = object.material as THREE.Material | undefined;
    if (!material || !(object as THREE.Mesh).geometry) return;
    saved.set(node, {
      frustumCulled: object.frustumCulled,
      visible: object.visible,
      materialVisible: material.visible,
      depthVisible: object.customDepthMaterial?.visible,
      distanceVisible: object.customDistanceMaterial?.visible,
    });
    object.frustumCulled = false;
    object.visible = true;
    material.visible = true;
    if (object.customDepthMaterial) object.customDepthMaterial.visible = true;
    if (object.customDistanceMaterial) {
      object.customDistanceMaterial.visible = true;
    }
  });

  const size = Math.max(1, Math.round(options.size ?? 1));
  const previousTarget = renderer.getRenderTarget();
  const throwaway = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: true,
  });

  try {
    renderer.compile(scene, camera);
    textures.forEach((texture) => {
      // A texture with no source yet cannot be uploaded; the real load path
      // uploads it when it arrives.
      if (texture.image) renderer.initTexture(texture);
    });
    renderer.setRenderTarget(throwaway);
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(previousTarget);
    throwaway.dispose();
    saved.forEach((state, node) => {
      const object = node as THREE.Mesh;
      const material = object.material as THREE.Material | undefined;
      object.frustumCulled = state.frustumCulled;
      object.visible = state.visible;
      if (material) material.visible = state.materialVisible;
      if (object.customDepthMaterial && state.depthVisible !== undefined) {
        object.customDepthMaterial.visible = state.depthVisible;
      }
      if (object.customDistanceMaterial && state.distanceVisible !== undefined) {
        object.customDistanceMaterial.visible = state.distanceVisible;
      }
    });
  }
}

/**
 * Postprocessing passes own their materials, so their programs are not in the
 * scene graph and `prewarmScene` cannot reach them. Call this with the composer
 * while the canvas is still invisible: it renders the whole chain once at its
 * real size, which is what actually links every pass shader.
 */
export function prewarmComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  composer: { render: (deltaMs?: number) => void },
  options: { size?: number } = {},
): void {
  prewarmScene(renderer, scene, camera, options);
  composer.render();
}
