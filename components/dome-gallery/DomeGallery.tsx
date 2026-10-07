"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useGesture } from '@use-gesture/react';
import './DomeGallery.css';

type ImageItem = string | { src: string; alt?: string };

type DomeGalleryProps = {
  images?: ImageItem[];
  fit?: number;
  fitBasis?: 'auto' | 'min' | 'max' | 'width' | 'height';
  minRadius?: number;
  maxRadius?: number;
  padFactor?: number;
  overlayBlurColor?: string;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  enlargeTransitionMs?: number;
  segments?: number;
  dragDampening?: number;
  openedImageWidth?: string;
  openedImageHeight?: string;
  imageBorderRadius?: string;
  openedImageBorderRadius?: string;
  grayscale?: boolean;
};

type ItemDef = {
  src: string;
  alt: string;
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
};

const DEFAULT_IMAGES: ImageItem[] = [];

const DEFAULTS = {
  maxVerticalRotationDeg: 5,
  dragSensitivity: 20,
  enlargeTransitionMs: 300,
  segments: 35
};

const AUTO_SPIN_DEG_PER_MS = -0.005;
const AUTO_SPIN_FADE_MS = 1600;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const normalizeAngle = (d: number) => ((d % 360) + 360) % 360;
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};
const getDataNumber = (el: HTMLElement, name: string, fallback: number) => {
  const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? NaN : parseFloat(attr);
  return Number.isFinite(n) ? n : fallback;
};

function buildItems(pool: ImageItem[], seg: number): ItemDef[] {
  const xCols = Array.from({ length: seg }, (_, i) => -seg + 1 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (pool.length === 0) {
    return coords.map(c => ({ ...c, src: '', alt: '' }));
  }
  if (pool.length > totalSlots) {
    console.warn(
      `[DomeGallery] Provided image count (${pool.length}) exceeds available tiles (${totalSlots}). Some images will not be shown.`
    );
  }

  const normalizedImages = pool.map(image => {
    if (typeof image === 'string') {
      return { src: image, alt: '' };
    }
    return { src: image.src || '', alt: image.alt || '' };
  });

  const usedImages = Array.from({ length: totalSlots }, (_, i) => normalizedImages[i % normalizedImages.length]);

  for (let i = 1; i < usedImages.length; i++) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j++) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i];
          usedImages[i] = usedImages[j];
          usedImages[j] = tmp;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({
    ...c,
    src: usedImages[i].src,
    alt: usedImages[i].alt
  }));
}

function pickTileAt(root: HTMLElement | null, x: number, y: number): HTMLElement | null {
  if (!root) return null;

  const tiles = root.querySelectorAll<HTMLElement>(
    '.dg-item__image:not(.dg-item__image--reference)',
  );
  let best: HTMLElement | null = null;
  let bestArea = 0;

  for (const el of tiles) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 28 || rect.height < 28) continue;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  }

  return best;
}

function pickTileByRotation(
  root: HTMLElement | null,
  clientX: number,
  clientY: number,
  rot: { x: number; y: number },
  segments: number,
): HTMLElement | null {
  if (!root) return null;
  const main = root.querySelector('.dg-main');
  if (!(main instanceof HTMLElement)) return null;
  const rect = main.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;

  const yawTap = ((clientX - rect.left) / rect.width * 2 - 1) * 28;
  const pitchTap = -((clientY - rect.top) / rect.height * 2 - 1) * 22;
  const tiles = root.querySelectorAll<HTMLElement>(
    '.dg-item__image:not(.dg-item__image--reference)',
  );
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of tiles) {
    const parent = el.parentElement;
    if (!parent) continue;
    const offsetX = getDataNumber(parent, 'offsetX', NaN);
    const offsetY = getDataNumber(parent, 'offsetY', NaN);
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) continue;
    const sizeX = getDataNumber(parent, 'sizeX', 2);
    const sizeY = getDataNumber(parent, 'sizeY', 2);
    const base = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments);
    const worldY = wrapAngleSigned(base.rotateY + rot.y);
    const worldX = wrapAngleSigned(base.rotateX + rot.x);
    if (Math.abs(worldY) > 72 || Math.abs(worldX) > 58) continue;
    const score = (worldY - yawTap) ** 2 + (worldX - pitchTap) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

function computeItemBaseRotation(offsetX: number, offsetY: number, sizeX: number, sizeY: number, segments: number) {
  const unit = 360 / segments / 2;
  const rotateY = unit * (offsetX + (sizeX - 1) / 2);
  const rotateX = unit * (offsetY - (sizeY - 1) / 2);
  return { rotateX, rotateY };
}

export default function DomeGallery({
  images = DEFAULT_IMAGES,
  fit = 0.5,
  fitBasis = 'auto',
  minRadius = 600,
  maxRadius = Infinity,
  padFactor = 0.25,
  overlayBlurColor = '#120F17',
  maxVerticalRotationDeg = DEFAULTS.maxVerticalRotationDeg,
  dragSensitivity = DEFAULTS.dragSensitivity,
  enlargeTransitionMs = DEFAULTS.enlargeTransitionMs,
  segments = DEFAULTS.segments,
  dragDampening = 2,
  openedImageWidth = '400px',
  openedImageHeight = '400px',
  imageBorderRadius = '30px',
  openedImageBorderRadius = '30px',
  grayscale = true
}: DomeGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const focusedElRef = useRef<HTMLElement | null>(null);
  const originalTilePositionRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const userControlRef = useRef(false);
  const inViewRef = useRef(true);
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  const spinBlendRef = useRef(1);
  const inertiaRAF = useRef<number | null>(null);

  const openingRef = useRef(false);
  const openStartedAtRef = useRef(0);
  const lastDragEndAt = useRef(0);
  const lastTouchAt = useRef(0);
  const tileFromDragRef = useRef<HTMLElement | null>(null);
  const openItemRef = useRef<(el: HTMLElement) => void>(() => {});

  const scrollLockedRef = useRef(false);
  const lockScroll = useCallback(() => {
    if (scrollLockedRef.current) return;
    scrollLockedRef.current = true;
    document.body.classList.add('dg-scroll-lock');
    const scroller = document.getElementById('page-content');
    if (scroller) scroller.style.overflow = 'hidden';
  }, []);
  const unlockScroll = useCallback(() => {
    if (!scrollLockedRef.current) return;
    if (rootRef.current?.getAttribute('data-enlarging') === 'true') return;
    scrollLockedRef.current = false;
    document.body.classList.remove('dg-scroll-lock');
    const scroller = document.getElementById('page-content');
    if (scroller) scroller.style.overflow = '';
  }, []);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);

  const applyTransform = (xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) {
      el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    }
  };

  const lockedRadiusRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width),
        h = Math.max(1, cr.height);
      const minDim = Math.min(w, h),
        maxDim = Math.max(w, h),
        aspect = w / h;
      let basis: number;
      switch (fitBasis) {
        case 'min':
          basis = minDim;
          break;
        case 'max':
          basis = maxDim;
          break;
        case 'width':
          basis = w;
          break;
        case 'height':
          basis = h;
          break;
        default:
          basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      const heightGuard = h * 1.2;
      radius = Math.min(radius, heightGuard);
      radius = clamp(radius, minRadius, maxRadius);
      const nextRadius = Math.round(radius);
      const prev = lockedRadiusRef.current;
      if (prev != null && Math.abs(prev - nextRadius) < 6) {
        return;
      }
      lockedRadiusRef.current = nextRadius;

      const viewerPad = Math.max(8, Math.round(minDim * padFactor));
      root.style.setProperty('--radius', `${lockedRadiusRef.current}px`);
      root.style.setProperty('--viewer-pad', `${viewerPad}px`);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');
      applyTransform(rotationRef.current.x, rotationRef.current.y);

      const enlargedOverlay = viewerRef.current?.querySelector('.dg-enlarge') as HTMLElement;
      if (enlargedOverlay && frameRef.current && mainRef.current) {
        const frameR = frameRef.current.getBoundingClientRect();
        const mainR = mainRef.current.getBoundingClientRect();

        const hasCustomSize = openedImageWidth && openedImageHeight;
        if (hasCustomSize) {
          const tempDiv = document.createElement('div');
          tempDiv.style.cssText = `position: absolute; width: ${openedImageWidth}; height: ${openedImageHeight}; visibility: hidden;`;
          document.body.appendChild(tempDiv);
          const tempRect = tempDiv.getBoundingClientRect();
          document.body.removeChild(tempDiv);

          const centeredLeft = frameR.left - mainR.left + (frameR.width - tempRect.width) / 2;
          const centeredTop = frameR.top - mainR.top + (frameR.height - tempRect.height) / 2;

          enlargedOverlay.style.left = `${centeredLeft}px`;
          enlargedOverlay.style.top = `${centeredTop}px`;
        } else {
          enlargedOverlay.style.left = `${frameR.left - mainR.left}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top}px`;
          enlargedOverlay.style.width = `${frameR.width}px`;
          enlargedOverlay.style.height = `${frameR.height}px`;
        }
      }
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [
    fit,
    fitBasis,
    minRadius,
    maxRadius,
    padFactor,
    overlayBlurColor,
    grayscale,
    imageBorderRadius,
    openedImageBorderRadius,
    openedImageWidth,
    openedImageHeight
  ]);

  useEffect(() => {
    applyTransform(rotationRef.current.x, rotationRef.current.y);
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  const startInertia = useCallback(
    (vx: number, vy: number) => {
      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;

      let frames = 0;
      const d = clamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);

      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
          inertiaRAF.current = null;
          return;
        }
        if (++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }
        const nextX = clamp(rotationRef.current.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF.current = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [dragDampening, maxVerticalRotationDeg, stopInertia]
  );

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouch(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting && entry.intersectionRatio > 0.08;
      },
      { threshold: [0, 0.08, 0.2] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, 48);
      last = now;
      const paused =
        !inViewRef.current ||
        document.hidden ||
        userControlRef.current ||
        Boolean(inertiaRAF.current) ||
        Boolean(focusedElRef.current) ||
        openingRef.current;

      if (paused) {
        spinBlendRef.current = 0;
      } else {
        const blend = Math.min(1, spinBlendRef.current + dt / AUTO_SPIN_FADE_MS);
        spinBlendRef.current = blend;
        const eased = blend * blend * (3 - 2 * blend);
        const nextY = wrapAngleSigned(
          rotationRef.current.y + AUTO_SPIN_DEG_PER_MS * dt * eased,
        );
        rotationRef.current = { x: rotationRef.current.x, y: nextY };
        applyTransform(rotationRef.current.x, nextY);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (focusedElRef.current) return;
        userControlRef.current = true;
        stopInertia();
        const evt = event as PointerEvent;
        draggingRef.current = false;
        movedRef.current = false;
        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: evt.clientX, y: evt.clientY };
        tileFromDragRef.current = pickTileAt(rootRef.current, evt.clientX, evt.clientY);
      },
      onDrag: ({ event, last, tap, velocity = [0, 0], direction = [0, 0], movement }) => {
        if (last && tap) {
          userControlRef.current = false;
          const tile =
            tileFromDragRef.current ||
            pickTileAt(rootRef.current, (event as PointerEvent).clientX, (event as PointerEvent).clientY);
          tileFromDragRef.current = null;
          if (tile) openItemRef.current(tile);
          return;
        }

        if (focusedElRef.current || !startPosRef.current) return;

        const evt = event as PointerEvent;
        const dxTotal = evt.clientX - startPosRef.current.x;
        const dyTotal = evt.clientY - startPosRef.current.y;

        if (!movedRef.current) {
          const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
          if (dist2 > 256) {
            movedRef.current = true;
            draggingRef.current = true;
            lockScroll();
          } else {
            return;
          }
        }

        if (evt.cancelable) evt.preventDefault();

        const nextX = clamp(
          startRotRef.current.x - dyTotal / dragSensitivity,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg
        );
        const nextY = wrapAngleSigned(startRotRef.current.y + dxTotal / dragSensitivity);

        if (rotationRef.current.x !== nextX || rotationRef.current.y !== nextY) {
          rotationRef.current = { x: nextX, y: nextY };
          applyTransform(nextX, nextY);
        }

        if (last) {
          draggingRef.current = false;
          if (movedRef.current) lastDragEndAt.current = performance.now();

          let [vMagX, vMagY] = velocity;
          const [dirX, dirY] = direction;
          let vx = vMagX * dirX;
          let vy = vMagY * dirY;

          if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && Array.isArray(movement)) {
            const [mx, my] = movement;
            vx = clamp((mx / dragSensitivity) * 0.02, -1.2, 1.2);
            vy = clamp((my / dragSensitivity) * 0.02, -1.2, 1.2);
          }

          if (movedRef.current && (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005)) {
            startInertia(vx, vy);
          }

          movedRef.current = false;
          userControlRef.current = false;
          unlockScroll();
          tileFromDragRef.current = null;
        }
      }
    },
    {
      target: mainRef,
      eventOptions: { passive: isTouch },
      drag: {
        enabled: !isTouch,
        filterTaps: true,
        tapsThreshold: 16,
        pointer: { touch: false },
      },
    }
  );

  const openItemFromElement = (el: HTMLElement) => {
    if (openingRef.current) return;
    openingRef.current = true;
    openStartedAtRef.current = performance.now();
    lockScroll();

    const parent = el.parentElement as HTMLElement;
    focusedElRef.current = el;
    el.setAttribute('data-focused', 'true');

    const offsetX = getDataNumber(parent, 'offsetX', 0);
    const offsetY = getDataNumber(parent, 'offsetY', 0);
    const sizeX = getDataNumber(parent, 'sizeX', 2);
    const sizeY = getDataNumber(parent, 'sizeY', 2);

    const parentRot = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments);
    const parentY = normalizeAngle(parentRot.rotateY);
    const globalY = normalizeAngle(rotationRef.current.y);
    let rotY = -(parentY + globalY) % 360;
    if (rotY < -180) rotY += 360;
    const rotX = -parentRot.rotateX - rotationRef.current.x;
    parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
    parent.style.setProperty('--rot-x-delta', `${rotX}deg`);

    const refDiv = document.createElement('div');
    refDiv.className = 'dg-item__image dg-item__image--reference';
    refDiv.style.opacity = '0';
    refDiv.style.transform = `rotateX(${-parentRot.rotateX}deg) rotateY(${-parentRot.rotateY}deg)`;
    parent.appendChild(refDiv);

    void refDiv.offsetHeight;

    const tileR = refDiv.getBoundingClientRect();
    const mainR = mainRef.current?.getBoundingClientRect();
    const frameR = frameRef.current?.getBoundingClientRect();

    if (!mainR || !frameR) {
      openingRef.current = false;
      focusedElRef.current = null;
      parent.removeChild(refDiv);
      unlockScroll();
      return;
    }

    const fromRect =
      tileR.width > 1 && tileR.height > 1
        ? tileR
        : el.getBoundingClientRect().width > 1
          ? el.getBoundingClientRect()
          : {
              left: frameR.left + frameR.width * 0.25,
              top: frameR.top + frameR.height * 0.25,
              width: frameR.width * 0.5,
              height: frameR.height * 0.5,
            };

    originalTilePositionRef.current = {
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height
    };

    el.style.visibility = 'hidden';
    (el.style as any).zIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'dg-enlarge';
    overlay.style.position = 'absolute';
    overlay.style.left = frameR.left - mainR.left + 'px';
    overlay.style.top = frameR.top - mainR.top + 'px';
    overlay.style.width = frameR.width + 'px';
    overlay.style.height = frameR.height + 'px';
    overlay.style.opacity = '0';
    overlay.style.zIndex = '30';
    overlay.style.willChange = 'transform, opacity';
    overlay.style.transformOrigin = 'top left';
    overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;

    const rawSrc = parent.dataset.src || (el.querySelector('img') as HTMLImageElement)?.src || '';
    const img = document.createElement('img');
    img.src = rawSrc;
    overlay.appendChild(img);
    viewerRef.current!.appendChild(overlay);

    const tx0 = fromRect.left - frameR.left;
    const ty0 = fromRect.top - frameR.top;
    const sx0 = fromRect.width / frameR.width;
    const sy0 = fromRect.height / frameR.height;

    const validSx0 = isFinite(sx0) && sx0 > 0 ? sx0 : 1;
    const validSy0 = isFinite(sy0) && sy0 > 0 ? sy0 : 1;

    overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${validSx0}, ${validSy0})`;

    setTimeout(() => {
      if (!overlay.parentElement) return;
      overlay.style.opacity = '1';
      overlay.style.transform = 'translate(0px, 0px) scale(1, 1)';
      rootRef.current?.setAttribute('data-enlarging', 'true');
    }, 16);

    const wantsResize = openedImageWidth || openedImageHeight;
    if (wantsResize) {
      const onFirstEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== 'transform') return;
        overlay.removeEventListener('transitionend', onFirstEnd);
        const prevTransition = overlay.style.transition;
        overlay.style.transition = 'none';
        const tempWidth = openedImageWidth || `${frameR.width}px`;
        const tempHeight = openedImageHeight || `${frameR.height}px`;
        overlay.style.width = tempWidth;
        overlay.style.height = tempHeight;
        const newRect = overlay.getBoundingClientRect();
        overlay.style.width = frameR.width + 'px';
        overlay.style.height = frameR.height + 'px';
        void overlay.offsetWidth;
        overlay.style.transition = `left ${enlargeTransitionMs}ms ease, top ${enlargeTransitionMs}ms ease, width ${enlargeTransitionMs}ms ease, height ${enlargeTransitionMs}ms ease`;
        const centeredLeft = frameR.left - mainR.left + (frameR.width - newRect.width) / 2;
        const centeredTop = frameR.top - mainR.top + (frameR.height - newRect.height) / 2;
        requestAnimationFrame(() => {
          overlay.style.left = `${centeredLeft}px`;
          overlay.style.top = `${centeredTop}px`;
          overlay.style.width = tempWidth;
          overlay.style.height = tempHeight;
        });
        const cleanupSecond = () => {
          overlay.removeEventListener('transitionend', cleanupSecond);
          overlay.style.transition = prevTransition;
        };
        overlay.addEventListener('transitionend', cleanupSecond, {
          once: true
        });
      };
      overlay.addEventListener('transitionend', onFirstEnd);
    }
  };

  openItemRef.current = openItemFromElement;

  const tryOpenTile = useCallback((el: HTMLElement) => {
    if (movedRef.current) return;
    if (draggingRef.current) return;
    if (performance.now() - lastDragEndAt.current < 180) return;
    if (openingRef.current) return;
    openItemFromElement(el);
  }, [openItemFromElement]);

  const onTileClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isTouch || performance.now() - lastTouchAt.current < 700) return;
      e.stopPropagation();
      tryOpenTile(e.currentTarget);
    },
    [isTouch, tryOpenTile]
  );

  const onTilePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isTouch) return;
      e.stopPropagation();
      tryOpenTile(e.currentTarget);
    },
    [isTouch, tryOpenTile]
  );

  useEffect(() => {
    const scrim = scrimRef.current;
    if (!scrim) return;

    const close = () => {
      if (performance.now() - openStartedAtRef.current < 250) return;

      const el = focusedElRef.current;
      if (!el) return;
      const parent = el.parentElement as HTMLElement;
      const overlay = viewerRef.current?.querySelector('.dg-enlarge') as HTMLElement | null;
      if (!overlay) {
        const refDiv = parent.querySelector('.dg-item__image--reference') as HTMLElement | null;
        if (refDiv) refDiv.remove();
        parent.style.setProperty('--rot-y-delta', `0deg`);
        parent.style.setProperty('--rot-x-delta', `0deg`);
        el.style.visibility = '';
        el.style.opacity = '';
        el.removeAttribute('data-focused');
        (el.style as any).zIndex = 0;
        focusedElRef.current = null;
        originalTilePositionRef.current = null;
        rootRef.current?.removeAttribute('data-enlarging');
        openingRef.current = false;
        unlockScroll();
        return;
      }

      const refDiv = parent.querySelector('.dg-item__image--reference') as HTMLElement | null;

      const originalPos = originalTilePositionRef.current;
      if (!originalPos) {
        overlay.remove();
        if (refDiv) refDiv.remove();
        parent.style.setProperty('--rot-y-delta', `0deg`);
        parent.style.setProperty('--rot-x-delta', `0deg`);
        el.style.visibility = '';
        (el.style as any).zIndex = 0;
        focusedElRef.current = null;
        rootRef.current?.removeAttribute('data-enlarging');
        openingRef.current = false;
        unlockScroll();
        return;
      }

      const currentRect = overlay.getBoundingClientRect();
      const rootRect = rootRef.current!.getBoundingClientRect();

      const originalPosRelativeToRoot = {
        left: originalPos.left - rootRect.left,
        top: originalPos.top - rootRect.top,
        width: originalPos.width,
        height: originalPos.height
      };

      const overlayRelativeToRoot = {
        left: currentRect.left - rootRect.left,
        top: currentRect.top - rootRect.top,
        width: currentRect.width,
        height: currentRect.height
      };

      const animatingOverlay = document.createElement('div');
      animatingOverlay.className = 'dg-enlarge-closing';
      animatingOverlay.style.cssText = `
        position: absolute;
        left: ${overlayRelativeToRoot.left}px;
        top: ${overlayRelativeToRoot.top}px;
        width: ${overlayRelativeToRoot.width}px;
        height: ${overlayRelativeToRoot.height}px;
        z-index: 9999;
        border-radius: var(--enlarge-radius, 32px);
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        transition: all ${enlargeTransitionMs}ms ease-out;
        pointer-events: none;
        margin: 0;
        transform: none;
      `;

      const originalImg = overlay.querySelector('img');
      if (originalImg) {
        const img = originalImg.cloneNode() as HTMLImageElement;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        animatingOverlay.appendChild(img);
      }

      overlay.remove();
      rootRef.current!.appendChild(animatingOverlay);

      void animatingOverlay.getBoundingClientRect();

      requestAnimationFrame(() => {
        animatingOverlay.style.left = originalPosRelativeToRoot.left + 'px';
        animatingOverlay.style.top = originalPosRelativeToRoot.top + 'px';
        animatingOverlay.style.width = originalPosRelativeToRoot.width + 'px';
        animatingOverlay.style.height = originalPosRelativeToRoot.height + 'px';
        animatingOverlay.style.opacity = '0';
      });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        animatingOverlay.remove();
        originalTilePositionRef.current = null;

        if (refDiv) refDiv.remove();
        parent.style.transition = 'none';
        el.style.transition = 'none';

        parent.style.setProperty('--rot-y-delta', `0deg`);
        parent.style.setProperty('--rot-x-delta', `0deg`);

        requestAnimationFrame(() => {
          el.style.visibility = '';
          el.style.opacity = '0';
          el.removeAttribute('data-focused');
          (el.style as any).zIndex = 0;
          focusedElRef.current = null;
          rootRef.current?.removeAttribute('data-enlarging');

          requestAnimationFrame(() => {
            parent.style.transition = '';
            el.style.transition = 'opacity 300ms ease-out';

            requestAnimationFrame(() => {
              el.style.opacity = '1';
              setTimeout(() => {
                el.style.transition = '';
                el.style.opacity = '';
                openingRef.current = false;
                if (!draggingRef.current && rootRef.current?.getAttribute('data-enlarging') !== 'true') {
                  document.body.classList.remove('dg-scroll-lock');
                }
              }, 300);
            });
          });
        });
      };

      animatingOverlay.addEventListener('transitionend', cleanup, {
        once: true
      });
      window.setTimeout(cleanup, enlargeTransitionMs + 120);
    };

    scrim.addEventListener('click', close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      scrim.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [enlargeTransitionMs, unlockScroll]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('dg-scroll-lock');
      const scroller = document.getElementById('page-content');
      if (scroller) scroller.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!isTouch) return;
    userControlRef.current = false;
    draggingRef.current = false;
    movedRef.current = false;
  }, [isTouch]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !isTouch) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let velX = 0;
    let velY = 0;

    const finishGesture = () => {
      draggingRef.current = false;
      movedRef.current = false;
      userControlRef.current = false;
      if (focusedElRef.current) return;
      if (rootRef.current?.getAttribute('data-enlarging') === 'true') return;
      unlockScroll();
    };

    const onStart = (event: TouchEvent) => {
      if (focusedElRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      tracking = true;
      movedRef.current = false;
      draggingRef.current = false;
      startX = lastX = touch.clientX;
      startY = lastY = touch.clientY;
      lastT = performance.now();
      velX = 0;
      velY = 0;
      startRotRef.current = { ...rotationRef.current };
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking || focusedElRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const now = performance.now();
      const dt = Math.max(now - lastT, 1);
      velX = (touch.clientX - lastX) / dt;
      velY = (touch.clientY - lastY) / dt;
      lastX = touch.clientX;
      lastY = touch.clientY;
      lastT = now;

      if (!movedRef.current) {
        if (dx * dx + dy * dy < 64) return;
        movedRef.current = true;
        draggingRef.current = true;
        userControlRef.current = true;
        stopInertia();
      }

      const nextX = clamp(
        startRotRef.current.x - dy / dragSensitivity,
        -maxVerticalRotationDeg,
        maxVerticalRotationDeg,
      );
      const nextY = wrapAngleSigned(startRotRef.current.y + dx / dragSensitivity);
      rotationRef.current = { x: nextX, y: nextY };
      applyTransform(nextX, nextY);
    };

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      lastTouchAt.current = performance.now();
      const touch = event.changedTouches[0];
      if (!movedRef.current && touch) {
        const tile = pickTileByRotation(
          rootRef.current,
          touch.clientX,
          touch.clientY,
          rotationRef.current,
          segments,
        );
        if (tile) openItemRef.current(tile);
      } else if (movedRef.current) {
        lastDragEndAt.current = performance.now();
        const vx = clamp(velX * 18, -1.4, 1.4);
        const vy = clamp(velY * 18, -1.4, 1.4);
        if (Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02) {
          startInertia(vx, vy);
        }
      }
      finishGesture();
    };

    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      finishGesture();
      main.removeEventListener('touchstart', onStart);
      main.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [dragSensitivity, isTouch, maxVerticalRotationDeg, segments, startInertia, stopInertia, unlockScroll]);

  return (
    <div
      ref={rootRef}
      className={`dg-root${isTouch ? ' dg-root--touch' : ''}`}
      style={
        {
          ['--segments-x' as any]: segments,
          ['--segments-y' as any]: segments,
          ['--overlay-blur-color' as any]: overlayBlurColor,
          ['--tile-radius' as any]: imageBorderRadius,
          ['--enlarge-radius' as any]: openedImageBorderRadius,
          ['--image-filter' as any]: grayscale ? 'grayscale(1)' : 'none'
        } as CSSProperties
      }
    >
      <main
        ref={mainRef}
        className="dg-main"
        onPointerMove={(event) => {
          if (isTouch || focusedElRef.current) return;
          const tile = pickTileAt(rootRef.current, event.clientX, event.clientY);
          event.currentTarget.style.cursor = tile ? 'pointer' : '';
        }}
        onClick={(event) => {
          if (isTouch || performance.now() - lastTouchAt.current < 700) return;
          const tile = pickTileAt(rootRef.current, event.clientX, event.clientY);
          if (tile) openItemRef.current(tile);
        }}
      >
        <div className="dg-stage">
          <div ref={sphereRef} className="dg-sphere">
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className="dg-item"
                data-src={it.src}
                data-offset-x={it.x}
                data-offset-y={it.y}
                data-size-x={it.sizeX}
                data-size-y={it.sizeY}
                style={
                  {
                    ['--offset-x' as any]: it.x,
                    ['--offset-y' as any]: it.y,
                    ['--item-size-x' as any]: it.sizeX,
                    ['--item-size-y' as any]: it.sizeY
                  } as CSSProperties
                }
              >
                <div
                  className="dg-item__image"
                  role="button"
                  tabIndex={0}
                  aria-label={it.alt || 'Open image'}
                  onClick={onTileClick}
                  onPointerUp={onTilePointerUp}
                >
                  <img
                    src={it.src}
                    draggable={false}
                    alt={it.alt}
                    loading="eager"
                    decoding="async"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dg-overlay" />
        <div className="dg-overlay dg-overlay--blur" />
        <div className="dg-edge-fade dg-edge-fade--top" />
        <div className="dg-edge-fade dg-edge-fade--bottom" />

        <div className="dg-viewer" ref={viewerRef}>
          <div ref={scrimRef} className="dg-scrim" />
          <div ref={frameRef} className="dg-frame" />
        </div>
      </main>
    </div>
  );
}
