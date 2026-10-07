"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Pointer-anchored illumination for a glass surface, with inertia.
 *
 * Apple's material "illuminates from within, starting under your fingertips" —
 * the highlight is a body of light inside a thick pane, so it has mass. It lags
 * the finger, keeps moving for a moment after the finger stops, and settles.
 *
 * Writing the pointer position straight into a CSS variable on every
 * `pointermove` produces the opposite: a highlight welded to the cursor with
 * zero latency, which reads as a flashlight held against a sheet of plastic
 * rather than as light inside glass. This hook puts a critically-damped follow
 * between the two.
 *
 * The position is written to custom properties, never to React state: a
 * re-render per `pointermove` would re-run the whole control subtree at input
 * frequency for something only the compositor needs.
 */

/**
 * Time constant of the follow, in ms — how long the highlight takes to cover
 * ~63% of the remaining distance. Tuned by eye against the iOS 26 controls:
 * below ~60ms the lag stops being legible, above ~140ms the highlight visibly
 * swims behind the cursor.
 */
const TAU_MS = 95;

/** Stop the loop once the highlight is this close, in % of the box. */
const SETTLE_EPSILON = 0.15;

type Point = { x: number; y: number };

export type PointerSheenOptions = {
  /** Custom property for the horizontal anchor, e.g. `--glass-pointer-x`. */
  xVar: string;
  /** Custom property for the vertical anchor. */
  yVar: string;
  /** Skip the inertia and snap. Set from `prefers-reduced-motion`. */
  reduced?: boolean;
};

export function usePointerSheen<T extends HTMLElement>(
  nodeRef: React.RefObject<T | null>,
  { xVar, yVar, reduced = false }: PointerSheenOptions,
) {
  const target = useRef<Point | null>(null);
  const current = useRef<Point | null>(null);
  const frame = useRef(0);
  const lastTime = useRef(0);

  const write = useCallback(
    (point: Point) => {
      const node = nodeRef.current;
      if (!node) return;
      node.style.setProperty(xVar, `${point.x.toFixed(2)}%`);
      node.style.setProperty(yVar, `${point.y.toFixed(2)}%`);
    },
    [nodeRef, xVar, yVar],
  );

  const stop = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  const tick = useCallback(
    (now: number) => {
      frame.current = 0;
      const to = target.current;
      const from = current.current;
      if (!to || !from) return;

      // Frame-rate independent: the same follow on a 60Hz panel and a 165Hz one.
      // A fixed per-frame fraction would make the highlight almost three times
      // snappier on the high-refresh display.
      const dt = Math.min(64, Math.max(1, now - lastTime.current));
      lastTime.current = now;
      const k = 1 - Math.exp(-dt / TAU_MS);

      const dx = to.x - from.x;
      const dy = to.y - from.y;

      if (Math.abs(dx) < SETTLE_EPSILON && Math.abs(dy) < SETTLE_EPSILON) {
        current.current = { ...to };
        write(to);
        return;
      }

      const next = { x: from.x + dx * k, y: from.y + dy * k };
      current.current = next;
      write(next);
      frame.current = requestAnimationFrame(tick);
    },
    [write],
  );

  const start = useCallback(() => {
    if (frame.current) return;
    lastTime.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  /**
   * Point the highlight at an event.
   *
   * `instant` is for the moment the pointer arrives: without it the highlight
   * would sweep in from wherever it was left by the previous hover, which looks
   * like a stray reflection crossing the control.
   */
  const anchor = useCallback(
    (event: ReactPointerEvent<HTMLElement> | PointerEvent, instant = false) => {
      const node = nodeRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const next: Point = {
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100,
        y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100,
      };
      target.current = next;

      if (instant || reduced || !current.current) {
        stop();
        current.current = next;
        write(next);
        return;
      }
      start();
    },
    [nodeRef, reduced, start, stop, write],
  );

  /** Drop the follow so the next hover starts fresh rather than mid-glide. */
  const release = useCallback(() => {
    stop();
    target.current = null;
    current.current = null;
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { anchor, release };
}
