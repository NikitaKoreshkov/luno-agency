"use client";

import { LiquidMetal } from "@paper-design/shaders-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import styles from "./hero-section.module.css";

import { HERO_HEADLINE_LINES } from "./hero-headline";

const HEADLINE = HERO_HEADLINE_LINES.join("\n");

function supportsWebGl2() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

function canvasToBlobUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not rasterize headline"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

async function rasterizeHeadline(el: HTMLElement, lines: readonly string[]) {
  await document.fonts.ready;

  const style = getComputedStyle(el);
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  try {
    await document.fonts.load(font);
  } catch {
    /* keep going with fallback metrics */
  }

  const rect = el.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.ceil(rect.width));
  const cssHeight = Math.max(1, Math.ceil(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(cssWidth * dpr);
  canvas.height = Math.ceil(cssHeight * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = style.letterSpacing;
  }

  const fontSize = Number.parseFloat(style.fontSize) || 64;
  const lineHeightValue = style.lineHeight;
  const lineHeight =
    lineHeightValue === "normal" || !Number.parseFloat(lineHeightValue)
      ? fontSize * 1.08
      : Number.parseFloat(lineHeightValue);

  const blockHeight = lineHeight * lines.length;
  const startY = (cssHeight - blockHeight) / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], cssWidth / 2, startY + i * lineHeight);
  }

  return canvasToBlobUrl(canvas);
}

export function LiquidMetalHeadline() {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [shaderReady, setShaderReady] = useState(false);
  const [canUseShader, setCanUseShader] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setCanUseShader(supportsWebGl2());
  }, []);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || !canUseShader) return;

    let cancelled = false;
    let timer = 0;
    let currentUrl: string | null = null;

    const paint = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        try {
          const url = await rasterizeHeadline(el, HERO_HEADLINE_LINES);
          if (cancelled || !url) return;
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          currentUrl = url;
          setMaskUrl(url);
        } catch (error) {
          console.error("Liquid metal headline failed to rasterize", error);
        }
      }, 120);
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(el);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [canUseShader]);

  useEffect(() => {
    if (!maskUrl) {
      setShaderReady(false);
      return;
    }
    const id = window.setTimeout(() => setShaderReady(true), 450);
    return () => window.clearTimeout(id);
  }, [maskUrl]);

  return (
    <h1 className={styles.title}>
      <span
        ref={measureRef}
        className={
          shaderReady ? styles.titleMeasureShader : styles.titleMeasure
        }
      >
        {HEADLINE}
      </span>

      {maskUrl && canUseShader ? (
        <LiquidMetal
          className={styles.titleShader}
          aria-hidden
          image={maskUrl}
          shape="none"
          fit="contain"
          scale={1}
          speed={reduceMotion ? 0 : 1.05}
          colorBack="rgba(0,0,0,0)"
          colorTint="#ffffff"
          distortion={0.14}
          repetition={2.2}
          shiftRed={0.38}
          shiftBlue={0.42}
          contour={0.82}
          softness={0.08}
          angle={72}
          webGlContextAttributes={{
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
          }}
        />
      ) : null}
    </h1>
  );
}
