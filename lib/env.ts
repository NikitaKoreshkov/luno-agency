function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function getAppUrl(): string {
  return optional("APP_URL", optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"));
}

export function getAuthSecret(): string {
  return required("AUTH_SECRET");
}

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getGoogleClientId(): string {
  return required("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret(): string {
  return required("GOOGLE_CLIENT_SECRET");
}

export function getSmtpConfig() {
  return {
    host: required("SMTP_HOST"),
    port: Number(optional("SMTP_PORT", "587")),
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
  };
}
