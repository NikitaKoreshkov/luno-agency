"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ContactModalProvider } from "@/components/contact/contact-modal-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ContactModalProvider>{children}</ContactModalProvider>
    </AuthProvider>
  );
}
