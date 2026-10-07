"use client";

import { useEffect } from "react";
import Lenis from "lenis";

declare global {
  interface Window {
    __lenisInstance?: Lenis | null;
    // Seam для ленивых ScrollTrigger-сцен: синхронизация со скроллом без импорта
    // gsap в бандл первого экрана.
    __lunoScrollHooks?: Set<() => void>;
    lenisSmoothScrollTo?: (target: string | number, options?: Parameters<Lenis["scrollTo"]>[1]) => void;
  }
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      gestureOrientation: "vertical",
      smoothWheel: true,
      infinite: false,
      // Один источник правды: lerp. duration/easing рядом с lerp игнорируются Lenis,
      // а связка lerp 0.08 + wheelMultiplier 0.75 давала «отстаёт, потом догоняет рывком».
      // Замер на флике из 10 скроллов (1200px): 0.08 -> хвост 313px/1056мс, 0.15 -> 153px/496мс.
      lerp: 0.15,
      wheelMultiplier: 1,
      autoRaf: true,
    });

    window.__lenisInstance = lenis;
    if (!window.__lunoScrollHooks) window.__lunoScrollHooks = new Set();
    lenis.on("scroll", () => {
      window.__lunoScrollHooks?.forEach((fn) => fn());
    });
    window.lenisSmoothScrollTo = (target, options) => {
      lenis.scrollTo(target, { offset: 0, ...options });
    };

    // Модалка/меню блокируют overflow на html, но Lenis скроллит программно — его надо останавливать явно.
    const root = document.documentElement;
    const syncLock = () => {
      const locked =
        "navOpen" in root.dataset || "contactModalOpen" in root.dataset;
      if (locked) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncLock);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-nav-open", "data-contact-modal-open"],
    });

    return () => {
      observer.disconnect();
      delete window.lenisSmoothScrollTo;
      window.__lenisInstance = null;
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
