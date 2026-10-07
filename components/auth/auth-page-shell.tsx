import { Suspense } from "react";
import { Footer } from "@/components/footer/Footer";
import { Header } from "@/components/header/Header";
import styles from "./auth-page.module.css";

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <Footer />
    </>
  );
}
