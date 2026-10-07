# Vendored effect: igloo.inc particle hologram

The end-of-page mark is a port of the particle element at the end of
[igloo.inc](https://www.igloo.inc/), read out of their production bundle
(`App3D-f554a111.js`, a custom WebGL framework by abeto.co over an older
three.js). Nothing of theirs is imported at runtime: the shaders were
transcribed and the JS rewritten against our three r156.

| Our file | Their code (beautified bundle line) |
| --- | --- |
| `igloo/gpu-glsl.ts` | `ae` 22981, `Ht` 32307, `Zo` 33745, `yd` 39441, `pF` 40133, `mF` 40134, `AF` 40135 |
| `igloo/fluid-sim.ts` | `FLUID_*` materials 30823-31383, `$U` 31426-31538 |
| `igloo/gpu-particles.ts` | `n3` 31838, `r3` 31861, `gE` 31949, `wF` materials 40687-40993, `initializeShape`/`update` 40996-41010 |
| `hologram-mark-scene.ts` | `_F` cursor 40625-40652, entrance timeline 42205-42226, `Fe` ticker 25581-25624 |

Verbatim: all eight fluid shaders, the particle compute and display shaders
(including their comments and typos), every force constant, the fluid config,
the ping-pong MRT layout, the settle, the spin rate, the cursor energy chain,
the blend mode, and the entrance choreography.

One exception: their position clamp to a cylinder (bundle 40968, `y` -0.34/0.35
and xz radius 0.275) is deleted from our compute shader. It is the visible wall
beside the glyph, and their own logo hides it because their mark fills the volume
face.

Ours:

- **Shape.** Their volumes are streamed `.ktx2` SDFs of their own logos. We bake
  `/finkey-glyph.svg` into the identical format at runtime
  (`igloo/glyph-volume.ts`): 64³ RGBA8, `A = clamp(dist/4 + 0.5) * 255` with the
  distance in volume-extent units and negative inside, `RGB = 127.5 * (1 + grad)`
  from a Felzenszwalb 2D Euclidean distance transform extruded to a slab as thick
  as their `x_64` (~9 voxels).
- **Colour.** Their palette is flat steel. `tGlyph` samples the SVG's own
  gradient with the same rotated coordinate the compute pass uses for the SDF, so
  the hue travels with the spin, and it is applied at the reference's own
  luminance (`uTint`, `uLightGain`, `uRampFloor` in
  `hologram-mark-scene.ts`). At `0 / 1 / 0` the shading is byte-identical to
  theirs.
- **Framing.** Their camera is fixed and their mark has a fixed world size; we
  solve the camera distance from the measured DOM logo box and keep the group at
  scale 1, so the simulation stays in their cube units and the dot-to-mark ratio
  is the one their lens produces.
- **Scope.** Their fluid pointer is the whole window and their interaction force
  is gated by a scroll-progress window; ours is the block's own rect and its
  on-screen window. The link-morph UI (`yF`, the volume-to-volume morph) is not
  ported - there is one shape, so `uAdditionalNoise` stays 0.
- **Cost gates.** 150k particles (their number) on medium and high, 60k on low;
  WebGL2 with `EXT_color_buffer_float` is required, otherwise the mount returns
  null and the static mark shows.

The previous implementation (instanced icosahedron field with a CPU pusher,
adapted from `cortiz2894/hologram-particles`) is archived at
`_archive/2026-10-06-igloo-port/hologram-mark-scene.instanced-mark.ts`.
