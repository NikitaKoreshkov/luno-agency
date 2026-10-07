# Vendored physics: hologram-particles

Cursor-pusher compute in `hologram-wordmark-scene.ts` is adapted from
[cortiz2894/hologram-particles](https://github.com/cortiz2894/hologram-particles)
(demo: <https://hologram-particles.vercel.app/>), itself a replica of the
[igloo.inc](https://www.igloo.inc/) hologram particle playground.

Local changes:

- GLB surface sampling replaced with extruded SVG (`/luno-logo.svg`).
- Cylinder, rings, grid, morph, bloom, and auto-rotate removed.
- Orthographic wordmark camera; particles idle until the pointer is over the mark.
