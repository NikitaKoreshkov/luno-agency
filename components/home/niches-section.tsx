"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import styles from "./niches-section.module.css";
import { ServicesPanelGlass } from "./services-panel-glass";
import { NicheIcon } from "./niche-icons";
import { NICHES, type NicheCompany } from "./niche-gallery-images";

const DomeGallery = dynamic(
  () => import("@/components/dome-gallery").then((mod) => mod.DomeGallery),
  { ssr: false },
);

const ease = [0.22, 1, 0.36, 1] as const;
const morphEase = [0.25, 0.1, 0.25, 1] as const;
const MORPH_MS = 0.28;

type CardOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PanelSize = {
  width: number;
  height: number;
};

function measureOpenTarget(card: HTMLElement, panel: HTMLElement) {
  const cardRect = card.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  return {
    origin: {
      left: cardRect.left - panelRect.left,
      top: cardRect.top - panelRect.top,
      width: cardRect.width,
      height: cardRect.height,
    } satisfies CardOrigin,
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    } satisfies PanelSize,
  };
}

function resolveLogoScale(company: NicheCompany, tabMultiplier = 1) {
  return (company.logoScale ?? 1) * tabMultiplier;
}

/** --logo-bright осветляет только знак; подложка карточки остаётся как есть. */
function logoVars(company: NicheCompany, logoScale: number): CSSProperties {
  return {
    "--logo-scale": String(logoScale),
    "--logo-bright": String(company.logoBright ?? 1),
  } as CSSProperties;
}

function CompanyLogo({
  company,
  logoScale,
}: {
  company: NicheCompany;
  logoScale: number;
}) {
  if (!company.imageSrc) {
    return <span className={styles.companyPlaceholder} aria-hidden />;
  }

  if (company.logo && company.logoScaleTransform) {
    return (
      <span
        className={styles.companyLogoTransformFrame}
        style={logoVars(company, logoScale)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={company.imageSrc}
          alt=""
          className={`${styles.companyLogo} ${styles.companyLogoTransformMedia}`}
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    // Real stills/logos are dropped in later via imageSrc — never stock.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={company.imageSrc}
      alt=""
      className={
        company.logo
          ? `${styles.companyLogo} ${styles.companyLogoFlex}${
              company.logoScaleGrow ? ` ${styles.companyLogoFlexGrow}` : ""
            }`
          : styles.companyImage
      }
      style={company.logo ? logoVars(company, logoScale) : undefined}
      loading="lazy"
      decoding="async"
    />
  );
}

function CompanyCard({
  company,
  index = 0,
  logoScaleMultiplier = 1,
  coverVisual = false,
  registerVisual,
  onOpen,
}: {
  company: NicheCompany;
  index?: number;
  logoScaleMultiplier?: number;
  coverVisual?: boolean;
  registerVisual?: (el: HTMLElement | null) => void;
  onOpen: (company: NicheCompany, originEl: HTMLElement) => void;
}) {
  const logoScale = resolveLogoScale(company, logoScaleMultiplier);
  const visualRef = useRef<HTMLSpanElement>(null);
  const visualClassName = [
    styles.companyVisual,
    company.logo ? styles.companyVisualLogo : "",
    company.logo && company.logoLight ? styles.companyVisualLogoLight : "",
    coverVisual ? styles.companyVisualHidden : "",
  ]
    .filter(Boolean)
    .join(" ");

  const setVisualRef = (el: HTMLSpanElement | null) => {
    visualRef.current = el;
    registerVisual?.(el);
  };

  return (
    <button
      type="button"
      className={styles.companyCard}
      style={{ "--card-i": index } as CSSProperties}
      aria-label={`Открыть работы ${company.name}`}
      onClick={() => {
        if (visualRef.current) onOpen(company, visualRef.current);
      }}
    >
      <span ref={setVisualRef} className={visualClassName}>
        <CompanyLogo company={company} logoScale={logoScale} />
      </span>
      <span className={styles.companyName}>{company.name}</span>
    </button>
  );
}

type WinRect = CardOrigin & { radius: number };

function cardWin(origin: CardOrigin): WinRect {
  return {
    left: origin.left,
    top: origin.top,
    width: origin.width,
    height: origin.height,
    radius: 18,
  };
}

function panelWin(panel: PanelSize): WinRect {
  return {
    left: 0,
    top: 0,
    width: panel.width,
    height: panel.height,
    radius: 0,
  };
}

const MORPH_EASE_CSS = "cubic-bezier(0.25, 0.1, 0.25, 1)";

function morphTransition(duration: number, ready: boolean) {
  if (!ready) return "none";
  const t = `${duration}s ${MORPH_EASE_CSS}`;
  return `left ${t}, top ${t}, width ${t}, height ${t}, border-radius ${t}`;
}

function CompanyGallery({
  company,
  origin,
  panelSize,
  reducedMotion,
  logoScaleMultiplier = 1,
  getOrigin,
  onClosing,
  onClosed,
}: {
  company: NicheCompany;
  origin: CardOrigin | null;
  panelSize: PanelSize | null;
  reducedMotion: boolean;
  logoScaleMultiplier?: number;
  getOrigin: () => { origin: CardOrigin; panelSize: PanelSize } | null;
  onClosing: () => void;
  onClosed: () => void;
}) {
  const closingRef = useRef(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef<HTMLDivElement>(null);
  const canMorph = Boolean(origin && panelSize && !reducedMotion);
  const startWin = origin ? cardWin(origin) : null;
  const openWin = panelSize ? panelWin(panelSize) : null;
  const [win, setWin] = useState<WinRect | null>(canMorph ? startWin : openWin);
  const [winReady, setWinReady] = useState(!canMorph);
  const [domeReady, setDomeReady] = useState(!canMorph);
  const images = company.gallery.map((src) => ({ src, alt: company.name }));
  const logoScale = resolveLogoScale(company, logoScaleMultiplier);
  const duration = reducedMotion ? 0.12 : MORPH_MS;
  const durationMs = duration * 1000;

  const content = useMotionValue(canMorph ? 0 : 1);
  const backOpacity = useMotionValue(0);
  const logoOpacity = useTransform(content, [0, 1], [1, 0]);

  useEffect(() => {
    if (!canMorph) {
      content.set(1);
      backOpacity.set(1);
      setDomeReady(true);
      return;
    }

    const openFrame = window.requestAnimationFrame(() => {
      if (!openWin) return;
      setWinReady(true);
      setWin(openWin);
    });
    const showDome = window.setTimeout(() => setDomeReady(true), durationMs * 0.12);
    const fadeIn = window.setTimeout(() => {
      animate(content, 1, { duration: duration * 0.5, ease: morphEase });
      animate(backOpacity, 1, { duration: 0.14, ease: morphEase });
    }, durationMs * 0.18);

    return () => {
      window.cancelAnimationFrame(openFrame);
      window.clearTimeout(showDome);
      window.clearTimeout(fadeIn);
    };
    // Open once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    backOpacity.set(0);
    if (layerRef.current) layerRef.current.style.pointerEvents = "none";

    const measured = getOrigin();
    const targetOrigin = measured?.origin ?? origin;
    const targetPanel = measured?.panelSize ?? panelSize;
    const finish = () => onClosed();

    if (!targetOrigin || !targetPanel || reducedMotion) {
      onClosing();
      window.setTimeout(finish, reducedMotion ? 90 : 140);
      return;
    }

    animate(content, 0, { duration: duration * 0.18, ease: morphEase });
    setWinReady(true);
    setWin(cardWin(targetOrigin));
    onClosing();

    const node = openedRef.current;
    const fallback = window.setTimeout(finish, durationMs + 50);
    if (!node) return;

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== node) return;
      if (event.propertyName !== "width" && event.propertyName !== "left") return;
      window.clearTimeout(fallback);
      node.removeEventListener("transitionend", onEnd);
      finish();
    };
    node.addEventListener("transitionend", onEnd);
  }, [
    backOpacity,
    content,
    duration,
    durationMs,
    getOrigin,
    onClosed,
    onClosing,
    origin,
    panelSize,
    reducedMotion,
  ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div ref={layerRef} className={styles.openedLayer}>
      <div
        ref={openedRef}
        className={styles.opened}
        style={
          win
            ? {
                left: win.left,
                top: win.top,
                width: win.width,
                height: win.height,
                borderRadius: win.radius,
                transition: morphTransition(duration, winReady),
              }
            : undefined
        }
      >
        <div
          className={styles.openedStage}
          style={
            win && panelSize
              ? {
                  left: -win.left,
                  top: -win.top,
                  width: panelSize.width,
                  height: panelSize.height,
                  transition: winReady
                    ? `left ${duration}s ${MORPH_EASE_CSS}, top ${duration}s ${MORPH_EASE_CSS}`
                    : "none",
                }
              : undefined
          }
        >
          {origin ? (
            <motion.div
              className={styles.openedLogoWrap}
              style={{
                opacity: logoOpacity,
                left: origin.left,
                top: origin.top,
                width: origin.width,
                height: origin.height,
              }}
              aria-hidden
            >
              <CompanyLogo company={company} logoScale={logoScale} />
            </motion.div>
          ) : null}

          <motion.div className={styles.openedDome} style={{ opacity: content }}>
            {domeReady ? (
              <DomeGallery
                images={images}
                grayscale={false}
                overlayBlurColor="#08080a"
                minRadius={720}
                maxRadius={2000}
                fit={1.2}
                fitBasis="min"
                padFactor={0.01}
                imageBorderRadius="18px"
                openedImageBorderRadius="24px"
                openedImageWidth="min(78vw, 420px)"
                openedImageHeight="min(78vw, 420px)"
              />
            ) : null}
          </motion.div>
        </div>
      </div>

      <motion.button
        type="button"
        className={styles.openedBack}
        onClick={close}
        style={{ opacity: backOpacity }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M8.6 3.2 4.8 7l3.8 3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Назад
      </motion.button>
    </div>
  );
}

export function NichesSection() {
  const [active, setActive] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [opened, setOpened] = useState<NicheCompany | null>(null);
  const [origin, setOrigin] = useState<CardOrigin | null>(null);
  const [panelSize, setPanelSize] = useState<PanelSize | null>(null);
  const [coverReleased, setCoverReleased] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const galleryPanelRef = useRef<HTMLDivElement>(null);
  const visualRefs = useRef(new Map<string, HTMLElement>());
  const headerInView = useInView(sectionRef, { once: true, margin: "-12%" });
  const panelInView = useInView(panelRef, { once: true, margin: "-12%" });

  useEffect(() => {
    if (!panelInView) return;
    void import("@/components/dome-gallery");
  }, [panelInView]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => {
      if (!media.matches) setPickerOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const niche = NICHES[active];

  const closeCompany = useCallback(() => {
    setOpened(null);
    setOrigin(null);
    setPanelSize(null);
    setCoverReleased(false);
  }, []);

  const getOpenOrigin = useCallback(() => {
    if (!opened) return null;
    const panel = galleryPanelRef.current;
    const visual = visualRefs.current.get(opened.name);
    if (!panel || !visual) return null;
    return measureOpenTarget(visual, panel);
  }, [opened]);

  const selectNiche = (index: number) => {
    setOpened(null);
    setOrigin(null);
    setPanelSize(null);
    setCoverReleased(false);
    setActive(index);
    setPickerOpen(false);
  };

  const openCompany = (company: NicheCompany, originEl: HTMLElement) => {
    const panel = galleryPanelRef.current;
    if (panel) {
      const next = measureOpenTarget(originEl, panel);
      setOrigin(next.origin);
      setPanelSize(next.panelSize);
    } else {
      setOrigin(null);
      setPanelSize(null);
    }
    setOpened(company);
    setCoverReleased(false);
  };

  return (
    <section id="niches" className={styles.section} ref={sectionRef}>
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease }}
        >
          <p className={styles.label}>Наши ниши</p>
          <h2 className={styles.heading}>
            <span>Работаем в нишах</span>
            <span>которые знаем</span>
          </h2>
        </motion.div>

        <div className={styles.mobilePicker}>
          <button
            type="button"
            className={`${styles.mobileTrigger}${pickerOpen ? ` ${styles.mobileTriggerOpen}` : ""}`}
            aria-expanded={pickerOpen}
            aria-controls="niche-picker"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <NicheIcon id={niche.icon} size={18} className={styles.mobileTriggerIcon} />
            <span className={styles.mobileTriggerLabel}>{niche.label}</span>
            <span className={styles.mobileChevron} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 5.2 7 9l4-3.8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          <div
            id="niche-picker"
            className={`${styles.mobilePickerSheet}${pickerOpen ? ` ${styles.mobilePickerSheetOpen}` : ""}`}
            aria-hidden={!pickerOpen}
          >
            <div className={styles.mobilePickerList} role="listbox" aria-label="Ниши">
              {NICHES.map((n, i) =>
                i === active ? null : (
                  <button
                    key={n.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={styles.mobileOption}
                    onClick={() => selectNiche(i)}
                  >
                    <NicheIcon id={n.icon} size={18} className={styles.mobileOptionIcon} />
                    <span>{n.label}</span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        <motion.div
          ref={panelRef}
          className={styles.panelWrap}
          initial={{ opacity: 0 }}
          animate={panelInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.05 }}
        >
          <ServicesPanelGlass id="niches-panel" magnetic={false}>
            <div className={styles.layout}>
              <div className={styles.tabs} role="tablist">
                {NICHES.map((n, i) => (
                  <button
                    key={n.id}
                    role="tab"
                    aria-selected={active === i}
                    aria-label={n.label}
                    className={`${styles.tab}${active === i ? ` ${styles.tabActive}` : ""}`}
                    onClick={() => selectNiche(i)}
                  >
                    <span className={styles.tabInner}>
                      <span className={styles.tabIconWrap}>
                        <NicheIcon id={n.icon} size={28} className={styles.tabIcon} />
                      </span>
                      <span className={styles.tabLabel}>{n.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div
                ref={galleryPanelRef}
                className={styles.panel}
                role="tabpanel"
                aria-label={opened ? `${opened.name}: работы` : niche.label}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={niche.id}
                    className={styles.panelStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease }}
                  >
                    <div
                      className={styles.companies}
                      data-count={niche.companies.length}
                      data-dense={niche.companies.length > 8 ? "1" : undefined}
                      style={{ pointerEvents: opened ? "none" : "auto" }}
                      aria-hidden={Boolean(opened)}
                    >
                      {niche.companies.map((company, i) => (
                        <CompanyCard
                          key={company.name}
                          company={company}
                          index={i}
                          logoScaleMultiplier={niche.logoScaleMultiplier}
                          coverVisual={opened?.name === company.name && !coverReleased}
                          registerVisual={(el) => {
                            if (el) visualRefs.current.set(company.name, el);
                            else visualRefs.current.delete(company.name);
                          }}
                          onOpen={openCompany}
                        />
                      ))}
                    </div>

                    {opened ? (
                      <CompanyGallery
                        key={opened.name}
                        company={opened}
                        origin={origin}
                        panelSize={panelSize}
                        reducedMotion={reducedMotion}
                        logoScaleMultiplier={niche.logoScaleMultiplier}
                        getOrigin={getOpenOrigin}
                        onClosing={() => setCoverReleased(true)}
                        onClosed={closeCompany}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </ServicesPanelGlass>
        </motion.div>
      </div>
    </section>
  );
}
