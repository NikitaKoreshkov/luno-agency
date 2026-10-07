import { redirect } from "next/navigation";

export const metadata = {
  title: "Кейсы — LUNO",
  robots: { index: false, follow: false },
};

export default function CasesPage() {
  redirect("/");
}
