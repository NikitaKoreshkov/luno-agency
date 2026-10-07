export type VerificationPurpose = "register" | "reset_password";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: string;
};

export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  email_verified: boolean;
  google_id: string | null;
  avatar_url: string | null;
  created_at: Date;
};
