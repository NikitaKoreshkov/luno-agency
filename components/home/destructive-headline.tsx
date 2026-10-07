"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HERO_HEADLINE_LINES } from "./hero-headline";
import styles from "./hero-section.module.css";

const HEADLINE = HERO_HEADLINE_LINES.join("\n");

/**
 * `pending` стоит и на сервере, поэтому до гидрации обычный шрифт не успевает
 * ни на один кадр проявиться: `plain` включает текст только там, где шейдера не
 * будет никогда (нет WebGPU, reduced motion, сбой сцены).
 */
type HeadlineMode = "plain" | "pending" | "shader";

// Если сцена смаунтилась, но канвас так и не показался (иниц WebGPU зависла,
// хост нулевой), текст обязан вернуться, а не остаться пустой дырой.
// Порог заведомо больше холодного dev-компиля three/webgpu, чтобы не показывать
// текст на полпути к шейдеру.
const REVEAL_DEADLINE_MS = 6000;

export function DestructiveHeadline() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<HeadlineMode>("pending");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (reduceMotion || !("gpu" in navigator)) {
      setMode("plain");
      return;
    }

    let cancelled = false;
    let dispose: (() => void) | undefined;

    const revealTimer = window.setTimeout(() => {
      if (!cancelled) setMode((current) => (current === "shader" ? current : "plain"));
    }, REVEAL_DEADLINE_MS);

    // Импорт стартует сразу: сеть и компайл чанка перекрывают первый пейнт,
    // тяжёлую инициализацию GPU всё равно делает then().
    import("./destructive-headline-scene")
      .then(({ mountDestructiveHeadline }) => {
        if (cancelled || !hostRef.current || !canvasRef.current) return;
        return mountDestructiveHeadline({
          canvas: canvasRef.current,
          host: hostRef.current,
          onReady: () => {
            if (cancelled) return;
            window.clearTimeout(revealTimer);
            setMode("shader");
          },
        });
      })
      .then((cleanup) => {
        if (!cleanup) return;
        if (cancelled) cleanup();
        else dispose = cleanup;
      })
      .catch((error) => {
        console.error("Headline destruction failed", error);
        if (!cancelled) setMode("plain");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(revealTimer);
      dispose?.();
    };
  }, [reduceMotion]);

  return (
    <h1 className={styles.title} data-hero-headline>
      <noscript>
        <style>{`[data-hero-headline] span{opacity:1}`}</style>
      </noscript>
      <span
        className={
          mode === "plain" ? styles.titleMeasure : styles.titleMeasureShader
        }
      >
        {HEADLINE}
      </span>
      <div
        ref={hostRef}
        className={styles.titleShader}
        aria-hidden
        style={{ opacity: mode === "shader" ? 1 : 0 }}
      >
        <canvas ref={canvasRef} className={styles.titleCanvas} />
      </div>
    </h1>
  );
}
