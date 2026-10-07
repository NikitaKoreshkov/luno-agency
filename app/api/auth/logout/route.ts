import { deleteSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/routes";
import { jsonOk } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  await deleteSession(token);
  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return jsonOk({ message: "Вы вышли из аккаунта" });
}
