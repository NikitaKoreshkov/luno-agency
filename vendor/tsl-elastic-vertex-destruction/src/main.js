import * as THREE from 'three/webgpu';
import { FontLoader, RoomEnvironment, TextGeometry } from 'three/examples/jsm/Addons.js';
import {
  instancedBufferAttribute,
  float,
  color,
  uv,
  metalness,
  hue,
  length,
  step,
  mix,
  vec3,
  positionLocal,
  roughness,
  storage,
  attribute,
  Fn,
  instanceIndex,
  mx_noise_vec3,
  time,
  uniform,
  rotate,
  mx_noise_float,
  transmission,
  dispersion,
  ior,
  instancedArray,
  thickness,
  sheen,
  iridescence,
  smoothstep,
  blur,
  oneMinus,
  sub,
  pass,
  mrt,
  output,
  normalView,
} from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js';
import * as dat from 'dat.gui';

const Resources = {
  font: undefined,
};

function preload() {
  const _font_loader = new FontLoader();
  _font_loader.load('./assets/Times New Roman_Regular.json', (font) => {
    Resources.font = font;
    init();
  });
}

function init() {
  document.body.classList.remove('loading');
  //  Scene setup
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
  const renderer = new THREE.WebGPURenderer({ antialias: true, canvas: document.getElementById('canvas') });
  renderer.toneMapping = THREE.CineonToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  renderer.setSize(sizes.width, sizes.height);
  camera.position.z = 5.0;

  scene.add(camera);

  //  & Environment

  scene.fog = new THREE.Fog(new THREE.Color('#41444c'), 0.0, 8.5);
  scene.background = scene.fog.color;

  const environment = new RoomEnvironment();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromSceneAsync(environment).texture;

  scene.environmentIntensity = 0.8;

  const light = new THREE.DirectionalLight('#e7e2ca', 5);
  light.position.x = 0.0;
  (light.position.y = 1.2), (light.position.z = 3.86);

  scene.add(light);

  //

  const text_geo = new TextGeometry('NUEVOS', {
    font: Resources.font,
    size: 1.0,
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.01,
    bevelOffset: 0,
    bevelSegments: 1,
  });

  //  TextGeometry & Centering it

  text_geo.computeBoundingBox();
  const centerOffset = -0.5 * (text_geo.boundingBox.max.x - text_geo.boundingBox.min.x);
  const centerOffsety = -0.5 * (text_geo.boundingBox.max.y - text_geo.boundingBox.min.y);
  text_geo.translate(centerOffset, centerOffsety, 0);

  const mesh = new THREE.Mesh(
    text_geo,
    new THREE.MeshStandardMaterial({
      color: '#656565',
      metalness: 0.4,
      roughness: 0.3,
    })
  );

  scene.add(mesh);

  //  To interact with our piece, we're gonna capture the pointer events

  const u_input_pos = uniform(new THREE.Vector3(0, 0, 0));
  const u_input_pos_press = uniform(0.0);

  //   During pointer move, we're gonna raycast to see what part of the mesh we're hitting

  const ray_cast = new THREE.Raycaster();

  window.addEventListener(
    'pointerup',
    (event) => {
      u_input_pos_press.value = 0.0;
    },
    { passive: false }
  );

  window.addEventListener(
    'pointermove',
    (event) => {
      const x = event.clientX / sizes.width - 0.5;
      const y = event.clientY / sizes.height - 0.5;

      const _p = new THREE.Vector2(x, -y).multiplyScalar(2.0);
      ray_cast.setFromCamera(_p, camera);
      const intersect = ray_cast.intersectObject(mesh, true);
      if (intersect.length) {
        u_input_pos_press.value = 1.0;
        u_input_pos.value.copy(intersect[0].point);
      }
    },
    { passive: false }
  );

  const parameters = {
    noise_amp: 1.6,
    text_color: '#212121',
    emissive_color: '#0000ff',
    spring: 0.05,
    friction: 0.9,
    emissive_bust: 5.0,
    explode_amp: 1.5,
  };

  const gui = new dat.GUI();
  gui.addColor(parameters, 'text_color').onChange((value) => {
    mesh.material.color = new THREE.Color(value);
  });
  gui.addColor(parameters, 'emissive_color').onChange((value) => {
    emissive_color.value = new THREE.Color(value);
  });
  gui
    .add(parameters, 'emissive_bust', 1.0, 10.0, 0.1)
    .name('Emissive Boost')
    .onChange((value) => {
      emissive_bust.value = value;
    });

  gui
    .add(parameters, 'noise_amp', 0.0, 3.0, 0.01)
    .name('Noise Amplitude')
    .onChange((value) => {
      u_noise_amp.value = value;
    });

  gui
    .add(parameters, 'explode_amp', 0.1, 2.5, 0.01)
    .name('Explode Amplitude')
    .onChange((value) => {
      u_explode_amp.value = value;
    });

  gui
    .add(parameters, 'spring', 0.0, 0.1, 0.01)
    .name('Spring')
    .onChange((value) => {
      u_spring.value = value;
    });
  gui
    .add(parameters, 'friction', 0.0, 0.99, 0.001)
    .name('Friction')
    .onChange((value) => {
      u_friction.value = value;
    });

  //  Uniforms

  const u_noise_amp = uniform(parameters.noise_amp);
  const u_spring = uniform(parameters.spring);
  const u_friction = uniform(parameters.friction);
  const u_explode_amp = uniform(parameters.explode_amp);

  const count = text_geo.attributes.position.count;
  const initial_position = storage(text_geo.attributes.position, 'vec3', count);
  const normal_at = storage(text_geo.attributes.normal, 'vec3', count);

  const position_storage_at = storage(new THREE.StorageBufferAttribute(count, 3), 'vec3', count);
  const velocity_storage_at = storage(new THREE.StorageBufferAttribute(count, 3), 'vec3', count);

  const compute_init = Fn(() => {
    position_storage_at.element(instanceIndex).assign(initial_position.element(instanceIndex));
    velocity_storage_at.element(instanceIndex).assign(vec3(0.0, 0.0, 0.0));
  })().compute(count);

  renderer.computeAsync(compute_init);

  const compute_update = Fn(() => {
    // Original position of the vertex — also its resting position
    const base_position = initial_position.element(instanceIndex);
    // Current position of the vertex — we’ll update this every frame
    const current_position = position_storage_at.element(instanceIndex);
    // Get current velocity
    const current_velocity = velocity_storage_at.element(instanceIndex);

    // The vertex normal tells us which direction to push
    const normal = normal_at.element(instanceIndex);

    //  Add noise so the direction in which the vertices "explode" isn’t too perfectly aligned with the normal
    const noise = mx_noise_vec3(current_position.mul(0.5).add(vec3(0.0, time, 0.0)), 1.0).mul(u_noise_amp);

    // Calculate distance between the pointer and the base position of the vertex
    const distance = length(u_input_pos.sub(base_position));
    // Limit the effect's range: it only applies if distance is less than 0.5
    const pointer_influence = step(distance, 0.5).mul(u_explode_amp);

    // Compute the new displaced position along the normal.
    // Where pointer_influence is 0, there’ll be no deformation.
    const disorted_pos = base_position.add(noise.mul(normal.mul(pointer_influence)));

    //  Rotate the vertices to give the animation a more chaotic feel
    disorted_pos.assign(rotate(disorted_pos, vec3(normal.mul(distance)).mul(pointer_influence)));
    disorted_pos.assign(mix(base_position, disorted_pos, u_input_pos_press));

    //  Spring
    current_velocity.addAssign(disorted_pos.sub(current_position).mul(u_spring));
    current_position.addAssign(current_velocity);
    current_velocity.assign(current_velocity.mul(u_friction));
  })().compute(count);

  mesh.material.positionNode = position_storage_at.toAttribute();

  const emissive_color = color(parameters.emissive_color);
  const emissive_bust = uniform(parameters.emissive_bust);
  const vel_at = velocity_storage_at.toAttribute();
  const hue_rotated = vel_at.mul(Math.PI * 10.0);
  // Multiply by the length of the velocity buffer — this means the more movement,
  // the more the vertex color will shift
  const emission_factor = length(vel_at).mul(10.0);

  // Assign the color to the emissive node and boost it as much as you want
  mesh.material.emissiveNode = hue(emissive_color, hue_rotated).mul(emission_factor).mul(emissive_bust);

  // Post Processing

  const composer = new THREE.PostProcessing(renderer);
  const scene_pass = pass(scene, camera);

  scene_pass.setMRT(
    mrt({
      output: output,
      normal: normalView,
    })
  );

  const scene_color = scene_pass.getTextureNode('output');
  const scene_depth = scene_pass.getTextureNode('depth');
  const scene_normal = scene_pass.getTextureNode('normal');

  const ao_pass = ao(scene_depth, scene_normal, camera);
  ao_pass.resolutionScale = 1.0;

  const ao_denoise = denoise(ao_pass.getTextureNode(), scene_depth, scene_normal, camera).mul(scene_color);
  const bloom_pass = bloom(ao_denoise, 0.5, 0.2, 0.1);
  const post_noise = mx_noise_float(vec3(uv(), time.mul(0.1)).mul(sizes.width), 0.03).mul(1.0);

  composer.outputNode = ao_denoise.add(bloom_pass).add(post_noise);

  //  Renderer loop

  renderer.setAnimationLoop(animate);
  function animate() {
    renderer.computeAsync(compute_update);
    composer.renderAsync();
  }

  window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
  });
}

window.onload = preload;
