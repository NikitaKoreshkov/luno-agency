# Vendored: liquid-glass-sandbox

`surfaceEquations.ts` and `refractionMaps.ts` in this folder are derived from
[ricardious/liquid-glass-sandbox](https://github.com/ricardious/liquid-glass-sandbox)
(demo: <https://ricardious.github.io/liquid-glass-sandbox/>), which in turn credits
the original refraction article by @kube.

Local changes:

- Pixel loops restricted to the bezel band instead of the full pane area.
- Asset generation moved behind a memoising cache with size quantisation.
- Applied via `backdrop-filter` on a single shared `<defs>` host instead of
  cloning the background DOM per instance.

## Upstream licence

```
MIT License

Copyright (c) 2026 ricardious

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
