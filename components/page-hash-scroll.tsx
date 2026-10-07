"use client";

import { useEffect } from "react";

export function PageHashScroll() {
  useEffect(() => {
    const toHash = () => {
      if (!window.location.hash) return;
      
      const element = document.querySelector(window.location.hash);
      if (element && (window as any).lenisSmoothScrollTo) {
        (window as any).lenisSmoothScrollTo(window.location.hash);
      }
    };

    const frame = window.requestAnimationFrame(toHash);
    window.addEventListener("hashchange", toHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", toHash);
    };
  }, []);

  return null;
}
