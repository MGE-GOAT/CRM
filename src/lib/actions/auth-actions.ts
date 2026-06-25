"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const PER_EMAIL_MAX = 8;
const PER_EMAIL_WINDOW = 5 * 60 * 1000; // 5 minutes
const PER_IP_MAX = 50;
const PER_IP_WINDOW = 10 * 60 * 1000; // 10 minutes

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();

  // Client IP: trust ONLY the proxy-appended last hop of X-Forwarded-For
  // (the leftmost value is attacker-controlled and must never be used).
  const hdrs = await headers();
  const xff = hdrs.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",").at(-1)?.trim() : null) ||
    hdrs.get("x-real-ip") ||
    "unknown";

  // Two buckets: stops both targeted brute force and broad password spraying.
  const ipOk = checkRateLimit(`login:ip:${ip}`, PER_IP_MAX, PER_IP_WINDOW);
  const emailOk = checkRateLimit(
    `login:${ip}:${email}`,
    PER_EMAIL_MAX,
    PER_EMAIL_WINDOW
  );
  if (!ipOk.allowed || !emailOk.allowed) {
    return "تلاش‌های بیش از حد. لطفاً چند دقیقه صبر کنید و دوباره امتحان کنید.";
  }

  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "ایمیل یا گذرواژه نادرست است.";
    }
    throw error; // re-throw redirects
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
