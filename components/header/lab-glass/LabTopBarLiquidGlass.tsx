"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { LiquidGlass } from "@/components/liquid-glass-v2";
import { observeGlassBox } from "@/lib/glass/glassObservers";
import { ensureGlassScrollTracking } from "@/lib/glass/glassScrollActivity";
import { isAppleTouchDevice } from "@/lib/perf/deviceTier";
import {
  LAB_TOPBAR_GLASS_OPTICS,
  chromeForAppTheme,
  resolveLabTopBarBezel,
  rimFromChrome,
  tintFromChrome,
} from "./labTopBarGlassDefaults";
import styles from "./LabTopBarLiquidGlass.module.css";

type Props = {
  hostRef: RefObject<HTMLElement | null>;
  fillHost?: boolean;
  frozen?: boolean;
};

export function LabTopBarLiquidGlass({
  hostRef,
  fillHost = false,
  frozen = false,
}: Props) {
  const optics = LAB_TOPBAR_GLASS_OPTICS;
  const chrome = chromeForAppTheme("dark");
  const plateRef = useRef<HTMLDivElement>(null);
  const frozenReady = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [appleTouch, setAppleTouch] = useState(false);

  useLayoutEffect(() => {
    setAppleTouch(isAppleTouchDevice());
  }, []);

  useEffect(() => {
    ensureGlassScrollTracking();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const plate = plateRef.current;
    if (!host || !plate) return;

    const sync = (width: number, height: number) => {
      const h = Math.round(height);
      const w = Math.round(width);
      if (frozen && frozenReady.current) return;
      setSize((prev) => {
        const wasReady = prev.w >= 8 && prev.h >= 8;
        const ready = w >= 8 && h >= 8;
        if (frozen && ready) frozenReady.current = true;
        if (fillHost) {
          if (
            Math.abs(prev.w - w) < 8 &&
            prev.h === h &&
            wasReady === ready
          ) {
            return prev;
          }
          return { w, h };
        }
        if (frozen) {
          if (wasReady) return prev;
          return { w, h };
        }
        if (prev.h === h && wasReady === ready) return prev;
        return { w, h };
      });
    };

    const target = frozen || fillHost ? (fillHost ? host : plate) : host;
    const r = target.getBoundingClientRect();
    sync(r.width, r.height);
    if (frozen && r.width >= 8 && r.height >= 8) return;
    return observeGlassBox(target, (box) => {
      if (frozen && frozenReady.current) return;
      sync(box.width, box.height);
    });
  }, [fillHost, frozen, hostRef]);

  const plateClass = fillHost
    ? `${styles.topPlate} ${styles.topPlateFill}`
    : styles.topPlate;

  const ready = size.w >= 8 && size.h >= 8;

  const radius =
    optics.shape === "stadium"
      ? Math.max(1, Math.round(optics.radius || size.h / 2))
      : Math.max(0, Math.round(optics.radius));
  const clipRadius = optics.clipRadius || radius;
  const bezel = resolveLabTopBarBezel(optics, size.h);

  const rimVars = {
    ["--lg-rim-width" as string]: `${chrome.rimWidth}px`,
    ["--lg-inset-hi" as string]: String(chrome.insetHighlight),
    ["--lg-inset-lo" as string]: String(chrome.insetShadow),
    ["--lg-sheen" as string]: String(chrome.sheen),
  } satisfies CSSProperties;

  return (
    <div
      ref={plateRef}
      className={plateClass}
      data-frozen={frozen ? "true" : undefined}
      style={ready ? { borderRadius: clipRadius } : undefined}
      aria-hidden
    >
      {ready && appleTouch ? <div className={styles.frost} /> : null}
      {ready && !appleTouch ? (
        <LiquidGlass
          forceRefraction
          urgent
          hold={frozen}
          lockMapSize={frozen}
          mapSize={frozen ? { width: size.w, height: size.h } : undefined}
          shape={optics.shape}
          className={styles.topGlass}
          radius={radius}
          clipRadius={clipRadius}
          showRim={chrome.showRim}
          rimEdges="all"
          bezelWidth={bezel}
          glassThickness={optics.glassThickness}
          refractiveIndex={optics.refractiveIndex}
          surface={optics.surface}
          blur={optics.blur}
          saturation={optics.saturation}
          refraction={optics.refraction}
          specularAlpha={chrome.specularAlpha}
          tint={tintFromChrome(chrome)}
          rimColor={rimFromChrome(chrome)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            borderRadius: clipRadius,
            ...rimVars,
          }}
        />
      ) : null}
    </div>
  );
}
