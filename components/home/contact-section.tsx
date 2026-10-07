"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ContactForm } from "@/components/contact/contact-form";
import { ServicesPanelGlass } from "@/components/home/services-panel-glass";
import styles from "./contact-section.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

export function ContactSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section id="contact" className={styles.section} ref={ref}>
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease }}
        >
          <p className={styles.label}>Заявка</p>
          <h2 className={styles.heading}>
            <span>Коротко опишите задачу</span>
            <span>ответим в течение часа</span>
          </h2>
        </motion.div>

        <div className={styles.layout}>
          <motion.div
            className={styles.panelWrap}
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease, delay: 0.1 }}
          >
            <ServicesPanelGlass id="contact-panel">
              <div className={styles.panelPad}>
                <ContactForm idPrefix="cf" />
              </div>
            </ServicesPanelGlass>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
