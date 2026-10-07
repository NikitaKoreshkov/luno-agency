import * as THREE from "three";

/**
 * Port of igloo.inc's `checkFloatRenderTarget` (bundle 26436-26451).
 *
 * `gl.getExtension("EXT_color_buffer_float")` only says the driver will not
 * reject the *format*. A surprising number of drivers accept it and then write
 * zeros, clamp to half-float, or hand back garbage on read. Our hologram gate
 * trusted the name, so such a machine got a 150 000-particle field of nothing
 * instead of the static mark.
 *
 * Their test is a round trip: render known values into a 1x1 float target and
 * read them back. Cheap (one pixel, one program) and it cannot lie.
 */

const TRIANGLE = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
const EXPECTED = { r: 0, g: 0.1, b: 0.05, a: 1 };

let cached: boolean | null = null;

/** True when float render targets actually round-trip on this GPU. */
export function probeFloatRenderTarget(
  renderer: THREE.WebGLRenderer,
): boolean {
  if (cached !== null) return cached;
  const gl = renderer.getContext();
  if (!gl.getExtension("EXT_color_buffer_float")) {
    cached = false;
    return cached;
  }

  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    depthBuffer: false,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(TRIANGLE, 3));
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
    fragmentShader:
      "void main() { gl_FragColor.rgb = vec3(0.0, 0.1, 0.05); gl_FragColor.a = 1.0; }",
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previousTarget = renderer.getRenderTarget();
  const read = new Float32Array(4);
  let ok = false;
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, read);
    ok =
      read[0] === EXPECTED.r &&
      read[1] >= EXPECTED.g &&
      read[2] >= EXPECTED.b &&
      read[3] >= EXPECTED.a;
  } catch {
    ok = false;
  } finally {
    renderer.setRenderTarget(previousTarget);
    target.dispose();
    geometry.dispose();
    material.dispose();
  }
  cached = ok;
  return ok;
}

/**
 * Their second flag (bundle 26434): linear filtering of *float* textures is a
 * separate capability. Without it, sampling a float state texture with LINEAR
 * is not blurry, it is an incomplete-texture read that returns zeros.
 */
export function hasFloatLinearFiltering(
  renderer: THREE.WebGLRenderer,
): boolean {
  return Boolean(renderer.getContext().getExtension("OES_texture_float_linear"));
}
