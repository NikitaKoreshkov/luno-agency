import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL, PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — LUNO",
  description: "Порядок обработки персональных данных посетителей сайта LUNO.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Политика конфиденциальности"
      updated={LEGAL.updated}
      sections={PRIVACY_SECTIONS}
    />
  );
}
