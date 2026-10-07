import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL, OFFER_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Публичная оферта — LUNO",
  description: "Публичная оферта на оказание услуг digital-агентства LUNO.",
};

export default function OfferPage() {
  return (
    <LegalPage
      title="Публичная оферта"
      updated={LEGAL.updated}
      sections={OFFER_SECTIONS}
    />
  );
}
