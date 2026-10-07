declare module "three/webgpu" {
  export * from "three";
}

declare module "three/tsl" {
  export const Fn: unknown;
  export const abs: unknown;
  export const attribute: unknown;
  export const clamp: unknown;
  export const cos: unknown;
  export const dot: unknown;
  export const float: unknown;
  export const fract: unknown;
  export const instanceIndex: unknown;
  export const length: unknown;
  export const min: unknown;
  export const mix: unknown;
  export const mx_fractal_noise_vec3: unknown;
  export const mx_noise_float: unknown;
  export const mx_noise_vec3: unknown;
  export const normalize: unknown;
  export const normalLocal: unknown;
  export const oneMinus: unknown;
  export const pass: unknown;
  export const positionLocal: unknown;
  export const pow: unknown;
  export const rotate: unknown;
  export const sin: unknown;
  export const smoothstep: unknown;
  export const storage: unknown;
  export const time: unknown;
  export const uniform: unknown;
  export const vec3: unknown;
}

declare module "three/addons/tsl/display/BloomNode.js" {
  export function bloom(...args: unknown[]): unknown;
}

declare module "three/examples/jsm/Addons.js" {
  export class MeshSurfaceSampler {
    constructor(mesh: unknown);
    build(): this;
    sample(...args: unknown[]): unknown;
  }
  export class SVGLoader {
    loadAsync(url: string): Promise<{ paths: unknown[] }>;
    static createShapes(path: unknown): unknown[];
  }
  export class Font {
    constructor(json: unknown);
  }
  export class TextGeometry {
    constructor(
      text: string,
      options: {
        font: unknown;
        size: number;
        depth: number;
        curveSegments: number;
        bevelEnabled: boolean;
      },
    );
    computeBoundingBox(): void;
    boundingBox: { min: { x: number; y: number }; max: { x: number; y: number } } | null;
    translate(x: number, y: number, z: number): void;
    dispose(): void;
  }
  export class TTFLoader {
    loadAsync(url: string): Promise<unknown>;
  }
}

declare module "three/examples/jsm/utils/BufferGeometryUtils.js" {
  export function mergeGeometries(
    geos: unknown[],
    useGroups?: boolean,
  ): { computeVertexNormals(): void; scale(...args: number[]): void; computeBoundingBox(): void; boundingBox: unknown; translate(...args: number[]): void; dispose(): void } | null;
}
