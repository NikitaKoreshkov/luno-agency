import Link from "next/link";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/footer/Footer";
import type { LegalSection } from "@/lib/legal";
import styles from "./legal-page.module.css";

type Props = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

export function LegalPage({ title, updated, sections }: Props) {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <article className={styles.article}>
          <p className={styles.kicker}>
            <Link href="/">LUNO</Link>
          </p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>Дата последнего обновления: {updated}</p>
          {sections.map((section) => (
            <section key={section.title} className={styles.section}>
              <h2 className={styles.heading}>{section.title}</h2>
              {section.paragraphs.map((text) => (
                <p key={text} className={styles.p}>
                  {text}
                </p>
              ))}
              {section.items ? (
                <ul className={styles.list}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </main>
      <Footer />
    </>
  );
}
