"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DestructiveHeadline } from "./destructive-headline";
import { scrollPageToId } from "@/lib/page-scroll";
import styles from "./hero-section.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

function shouldStreamVideo(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
  if (connection?.saveData) return false;
  return !/(^|\s)2g$/.test(connection?.effectiveType ?? "");
}

function scrollToNextSection() {
  const hero = document.querySelector('[data-hero-section="true"]');
  const next = hero?.nextElementSibling;
  
  // Используем плавный скролл через Lenis если доступен
  if ((window as any).lenisSmoothScrollTo) {
    if (next instanceof HTMLElement && next.id) {
      (window as any).lenisSmoothScrollTo(`#${next.id}`);
      return;
    }
  }
  
  if (next instanceof HTMLElement && next.id) {
    scrollPageToId(next.id);
    return;
  }
  if (next instanceof HTMLElement) {
    const scroller = document.getElementById("page-content");
    if (!scroller) {
      next.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const top =
      next.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
}

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (reduce) return;
    if (shouldStreamVideo()) setStreaming(true);
  }, [reduce]);

  // Офф-экран останавливаем декодирование showreel, при возврате продолжаем.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streaming) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video.isConnected) return;
        if (entry.isIntersecting) {
          if (video.paused) void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [streaming]);

  return (
    <section className={styles.hero} aria-label="Главный экран" data-hero-section="true">
      <div className={styles.frame}>
        <div className={styles.media}>
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            muted
            loop
            playsInline
            preload={streaming ? "auto" : "none"}
            poster="/hero-loop-poster.jpg"
            aria-hidden
          >
            {streaming ? (
              <>
                <source src="/hero-loop.webm" type="video/webm; codecs=vp9" />
                <source src="/hero-loop.mp4" type="video/mp4" />
              </>
            ) : null}
          </video>

          <div className={styles.grade} aria-hidden />
          <div className={styles.bottomFade} aria-hidden />

          <div className={styles.content}>
            <motion.div
              className={styles.copy}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease }}
            >
              <p className={styles.pre}>LUNO digital-агентство полного цикла</p>

              <DestructiveHeadline />

              <p className={styles.lead}>
                От аккаунта до приложения одна команда.
              </p>

              <div className={styles.actions}>
                <a
                  href="#contact"
                  className={styles.btnPrimary}
                  onClick={(event) => {
                    event.preventDefault();
                    scrollPageToId("contact");
                  }}
                >
                  Обсудить проект
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.button
        type="button"
        className={styles.scrollCue}
        onClick={scrollToNextSection}
        aria-label="Листайте дальше"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease, delay: reduce ? 0 : 1.35 }}
      >
        <span className={styles.scrollText}>Листайте дальше</span>
        <span className={styles.scrollTrack} aria-hidden>
          <span className={styles.scrollPulse} />
        </span>
      </motion.button>
    </section>
  );
}
