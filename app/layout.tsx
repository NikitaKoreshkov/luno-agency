import type { Metadata } from "next";
import { Onest, Unbounded } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { PageHashScroll } from "@/components/page-hash-scroll";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["600"],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "LUNO digital-агентство полного цикла",
  description:
    "Снимаем. Придумываем. Разрабатываем. SMM, таргет, съёмка, дизайн, сайты и приложения. Алматы.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${onest.variable} ${unbounded.variable}`}>
      <body>
        <div id="background-container" />

        <div id="page-content">
          <SmoothScrollProvider>
            <AppProviders>
              <PageHashScroll />
              {children}
            </AppProviders>
          </SmoothScrollProvider>
        </div>
      </body>
    </html>
  );
}
