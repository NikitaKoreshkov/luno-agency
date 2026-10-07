import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = {
  title: "Регистрация — LUNO",
  description: "Создайте аккаунт LUNO.",
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(AUTH_ROUTES.profile);

  return (
    <AuthPageShell>
      <AuthForm mode="register" />
    </AuthPageShell>
  );
}
