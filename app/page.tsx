import dynamic from "next/dynamic";
import { Header } from "@/components/header/Header";
import { HeroSection } from "@/components/home/hero-section";
import { ContactSection } from "@/components/home/contact-section";
import { FooterWordmark } from "@/components/footer/FooterWordmark";
import { Footer } from "@/components/footer/Footer";

const ServicesSection = dynamic(
  () =>
    import("@/components/home/services-section").then((mod) => mod.ServicesSection),
  { loading: () => <section id="services" aria-label="Услуги" /> },
);

const NichesSection = dynamic(
  () =>
    import("@/components/home/niches-section").then((mod) => mod.NichesSection),
  { loading: () => <section id="niches" aria-label="Ниши" /> },
);

const ResultsSection = dynamic(
  () =>
    import("@/components/home/results-section").then((mod) => mod.ResultsSection),
  { loading: () => <section id="results" aria-label="Результаты" /> },
);

const ProcessSection = dynamic(
  () => import("@/components/home/process-section").then((mod) => mod.default),
  { loading: () => <section aria-label="Как мы работаем" /> },
);

const ManifestoSection = dynamic(
  () => import("@/components/home/manifesto-section").then((mod) => mod.default),
  { loading: () => <section aria-label="Манифест" /> },
);

const ReviewsSection = dynamic(
  () =>
    import("@/components/home/reviews-section").then((mod) => mod.ReviewsSection),
  { loading: () => <section id="reviews" aria-label="Отзывы" /> },
);

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ServicesSection />
        <ProcessSection />
        <NichesSection />
        <ManifestoSection />
        <ResultsSection />
        <ReviewsSection />
        <FooterWordmark>
          <ContactSection />
        </FooterWordmark>
      </main>
      <Footer />
    </>
  );
}
