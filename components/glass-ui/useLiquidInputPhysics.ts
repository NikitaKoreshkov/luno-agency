"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Spring } from "@/lib/glass/spring";
import { prefersReducedMotion } from "@/lib/perf/deviceTier";

const PULSE_X = 0.95;
const PULSE_Y = -0.62;
const PRESS_SQUASH = -0.48;

export function useLiquidInputPhysics(
  hostRef: RefObject<HTMLElement | null>,
  intensity = 1,
) {
  const reducedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const springsRef = useRef({
    scaleX: new Spring(1, 300, 22),
    scaleY: new Spring(1, 300, 22),
  });

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const applyRest = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.transform = "";
    host.removeAttribute("data-liquid-live");
  }, [hostRef]);

  const tick = useCallback(() => {
    const host = hostRef.current;
    const springs = springsRef.current;
    if (!host) {
      frameRef.current = null;
      return;
    }

    const dt = Math.min(0.032, 1 / 60);
    springs.scaleX.setTarget(1);
    springs.scaleY.setTarget(1);

    const sx = springs.scaleX.update(dt);
    const sy = springs.scaleY.update(dt);
    host.style.transform = `scale(${sx}, ${sy})`;

    if (springs.scaleX.isSettled() && springs.scaleY.isSettled()) {
      applyRest();
      frameRef.current = null;
      return;
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [applyRest, hostRef]);

  const startLoop = useCallback(() => {
    const host = hostRef.current;
    if (host) host.setAttribute("data-liquid-live", "true");
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [hostRef, tick]);

  const focus = useCallback(
    (extra = 1) => {
      if (reducedRef.current) return;
      const springs = springsRef.current;
      const k = intensity * extra;
      springs.scaleX.velocity += PULSE_X * 0.7 * k;
      springs.scaleY.velocity += PULSE_Y * 0.7 * k;
      startLoop();
    },
    [intensity, startLoop],
  );

  const blur = useCallback(() => {
    if (reducedRef.current) {
      applyRest();
      return;
    }
    startLoop();
  }, [applyRest, startLoop]);

  const pulse = useCallback(
    (length: number, extra = 1) => {
      if (reducedRef.current) return;
      const springs = springsRef.current;
      const k = intensity * extra;
      springs.scaleX.velocity += PULSE_X * k;
      springs.scaleY.velocity += PULSE_Y * k;
      const sign = length % 2 === 0 ? 1 : -1;
      springs.scaleX.velocity += 0.16 * sign * k;
      springs.scaleY.velocity += -0.1 * sign * k;
      startLoop();
    },
    [intensity, startLoop],
  );

  const press = useCallback(() => {
    if (reducedRef.current) return;
    const springs = springsRef.current;
    springs.scaleX.velocity += PRESS_SQUASH;
    springs.scaleY.velocity += PRESS_SQUASH;
    startLoop();
  }, [startLoop]);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedRef.current = media.matches;
      if (media.matches) {
        stopLoop();
        applyRest();
      }
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      stopLoop();
    };
  }, [applyRest, stopLoop]);

  return { focus, blur, pulse, press };
}
