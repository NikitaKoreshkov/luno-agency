import { redirect } from "next/navigation";
import { ProfilePageClient } from "@/components/profile/profile-page-client";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "@/components/auth/auth-page.module.css";

export const metadata = {
  title: "Личный кабинет — LUNO",
  description: "Личный кабинет LUNO.",
};

export default async function ProfilePage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  if (!user) redirect(AUTH_ROUTES.login);

  return (
    <main className={`${styles.main} ${styles.profileMain}`}>
      <ProfilePageClient initialUser={user} />
    </main>
  );
}
