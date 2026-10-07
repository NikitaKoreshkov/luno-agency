"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LunoLogo } from "@/components/brand/luno-logo";
import { prefersReducedMotion } from "@/lib/perf/deviceTier";
import { observeOnce, whenIdle } from "@/lib/perf/schedule";
import { glassScrollQuietFor } from "@/lib/glass/glassScrollActivity";
import styles from "./FooterWordmark.module.css";

export function FooterWordmark({ children }: { children?: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const logo = logoRef.current;
    const canvas = canvasRef.current;
    if (!stage || !logo || !canvas || prefersReducedMotion()) return;

    let cancelled = false;
    let began = false;
    let dispose: (() => void) | undefined;
    let retry: number | undefined;

    const start = () => {
      if (cancelled || began) return;
      began = true;
      void import("./hologram-wordmark-scene")
        .then(({ mountHologramWordmark }) => {
          if (
            cancelled ||
            !stageRef.current ||
            !logoRef.current ||
            !canvasRef.current
          ) {
            return;
          }
          return mountHologramWordmark({
            canvas: canvasRef.current,
            host: stageRef.current,
            logoHost: logoRef.current,
            isCancelled: () => cancelled,
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onLost: () => {
              // Драйвер забрал контекст: снимаем `.live`, чтобы поверх чёрного
              // канваса снова легла DOM-метка.
              if (!cancelled) setReady(false);
            },
          });
        })
        .then((cleanup) => {
          if (!cleanup) return;
          if (cancelled) cleanup();
          else dispose = cleanup;
        })
        .catch((error) => {
          console.error("Hologram wordmark failed", error);
        });
    };

    // Монтаж сцены = одноразовые ~100 мс (первый WebGPU-кадр компилирует
    // пайплайны). Поднимаем её в простое страницы, а не в кадре скролла к
    // футеру; если страница не затихает — подстрахует приближение стадии.
    const attempt = () => {
      if (cancelled || began) return;
      if (glassScrollQuietFor() < 500) {
        retry = window.setTimeout(attempt, 250);
        return;
      }
      start();
    };

    const stopObserving = observeOnce(stage, start, "800px 0px");
    const stopIdle = whenIdle(attempt, 2500);

    return () => {
      cancelled = true;
      stopObserving();
      stopIdle();
      if (retry !== undefined) window.clearTimeout(retry);
      dispose?.();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className={`${styles.stage}${ready ? ` ${styles.live}` : ""}`}
    >
      <canvas ref={canvasRef} className={styles.stageCanvas} aria-hidden />
      {children}
      <div ref={logoRef} className={styles.logoHost} aria-hidden>
        <LunoLogo className={styles.markBase} />
      </div>
    </div>
  );
}
