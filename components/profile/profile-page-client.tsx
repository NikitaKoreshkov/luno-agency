"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { ProfileCabinet } from "@/components/profile/profile-cabinet";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import type { PublicUser } from "@/lib/auth/types";
import styles from "@/components/auth/auth-forms.module.css";

export function ProfilePageClient({ initialUser }: { initialUser: PublicUser }) {
  const { setUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser, setUser]);

  const handleLogout = () => {
    setUser(null);
    router.push(AUTH_ROUTES.login);
  };

  return (
    <div className={styles.cabinetWrap}>
      <ProfileCabinet user={initialUser} onLogout={handleLogout} />
    </div>
  );
}
