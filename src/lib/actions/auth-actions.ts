"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import {
  checkRateLimit,
  peekCounter,
  bumpCounter,
  resetCounter,
} from "@/lib/rate-limit";
import { generateCaptcha, verifyCaptcha } from "@/lib/captcha";

const PER_EMAIL_MAX = 8;
const PER_EMAIL_WINDOW = 5 * 60 * 1000; // 5 minutes
const PER_IP_MAX = 50;
const PER_IP_WINDOW = 10 * 60 * 1000; // 10 minutes
// After this many recent failures from one IP+email, every further attempt must
// solve a CAPTCHA. Kept low so brute force is throttled fast; invisible to honest
// users who normally log in on the first try.
const CAPTCHA_AFTER = 2;
// After this many recent failures for an EMAIL across ALL IPs, also require a
// CAPTCHA — this throttles IP-rotation brute force against one account WITHOUT
// hard-locking the real owner out (a hard per-email block would be a remote
// lockout DoS; the owner can always recover by solving one CAPTCHA).
const CAPTCHA_AFTER_EMAIL = 5;
const FAIL_WINDOW = 15 * 60 * 1000; // failures decay after 15 minutes

export type AuthState = {
  error?: string;
  captchaRequired?: boolean;
  captchaImage?: string;
  captchaToken?: string;
};

/** Resolve the real client IP: trust ONLY the proxy-appended last hop of XFF. */
async function clientIp(): Promise<string> {
  const hdrs = await headers();
  const xff = hdrs.get("x-forwarded-for");
  return (
    (xff ? xff.split(",").at(-1)?.trim() : null) ||
    hdrs.get("x-real-ip") ||
    "unknown"
  );
}

function challenge(extra: Omit<AuthState, "captchaRequired" | "captchaImage" | "captchaToken">): AuthState {
  const c = generateCaptcha();
  return { ...extra, captchaRequired: true, captchaImage: c.image, captchaToken: c.token };
}

export async function authenticate(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const ip = await clientIp();
  // Scoped per (IP, email): a successful login for the attacker's OWN account
  // can no longer clear the CAPTCHA gate that's accumulating for a victim email.
  const failKey = `login:fail:${ip}:${email}`;
  // Per-email failure tally across all IPs — escalates to CAPTCHA on IP rotation.
  const emailFailKey = `login:failmail:${email}`;

  // Two HARD ceilings FIRST, both per-IP so they can never lock out a remote
  // user AND so a flood from one IP is rejected here before it can bump the
  // adaptive counters (protects the honeypot path from unbounded counter growth):
  // targeted brute force (per IP+email) and password spraying (per IP).
  const ipOk = checkRateLimit(`login:ip:${ip}`, PER_IP_MAX, PER_IP_WINDOW);
  const emailOk = checkRateLimit(`login:${ip}:${email}`, PER_EMAIL_MAX, PER_EMAIL_WINDOW);
  if (!ipOk.allowed || !emailOk.allowed) {
    console.warn(`[security] login rate-limited ip=${ip}`);
    return challenge({
      error: "تلاش‌های بیش از حد. لطفاً چند دقیقه صبر کنید و دوباره امتحان کنید.",
    });
  }

  // Honeypot: a hidden field no human fills. If populated, it's a bot — fail
  // generically without touching the auth path or leaking that it was detected.
  if (String(formData.get("company_website") ?? "").length > 0) {
    bumpCounter(failKey, FAIL_WINDOW);
    if (email) bumpCounter(emailFailKey, FAIL_WINDOW);
    console.warn(`[security] login honeypot tripped ip=${ip}`);
    return challenge({ error: "ایمیل یا گذرواژه نادرست است." });
  }

  // Adaptive CAPTCHA gate: required once this IP+email — or the email across all
  // IPs (anti IP-rotation) — has enough recent failures.
  const captchaRequired =
    peekCounter(failKey) >= CAPTCHA_AFTER ||
    peekCounter(emailFailKey) >= CAPTCHA_AFTER_EMAIL;
  if (captchaRequired) {
    const token = String(formData.get("captchaToken") ?? "");
    const answer = String(formData.get("captcha") ?? "");
    if (!verifyCaptcha(token, answer)) {
      bumpCounter(failKey, FAIL_WINDOW);
      console.warn(`[security] login captcha failed ip=${ip}`);
      return challenge({ error: "کد امنیتی نادرست است. لطفاً دوباره وارد کنید." });
    }
  }

  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const fails = bumpCounter(failKey, FAIL_WINDOW);
      const emailFails = email ? bumpCounter(emailFailKey, FAIL_WINDOW) : 0;
      console.warn(`[security] login failed ip=${ip} fails=${fails}`);
      const base = { error: "ایمیل یا گذرواژه نادرست است." };
      const needsCaptcha = fails >= CAPTCHA_AFTER || emailFails >= CAPTCHA_AFTER_EMAIL;
      return needsCaptcha ? challenge(base) : base;
    }
    // signIn throws a redirect on success — let it propagate, and clear THIS
    // account's failure counters (the owner just proved their identity, so this
    // both un-gates them and prevents any lingering CAPTCHA escalation).
    resetCounter(failKey);
    if (email) resetCounter(emailFailKey);
    throw error;
  }
  return {};
}

export async function logout() {
  // Record the member's clock-out (latest logout of the day) before ending
  // the session. Owner/admin aren't tracked.
  try {
    const { getSessionUser } = await import("@/lib/rbac");
    const u = await getSessionUser();
    if (u && u.role === "MEMBER") {
      const { recordClockOut } = await import("@/lib/attendance");
      await recordClockOut(u.id);
    }
  } catch {
    /* non-fatal — never block logout */
  }
  await signOut({ redirectTo: "/login" });
}

// 1x1 transparent image returned when a client hammers the refresh endpoint,
// so CAPTCHA token-farming / scrypt CPU abuse is bounded.
const BLANK_IMAGE =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString("base64");

/** Issue a fresh CAPTCHA challenge for the "refresh" button on the login form. */
export async function refreshCaptcha(): Promise<{ image: string; token: string }> {
  const ip = await clientIp();
  if (!checkRateLimit(`captcha:refresh:${ip}`, 20, 60 * 1000).allowed) {
    return { image: BLANK_IMAGE, token: "" };
  }
  const c = generateCaptcha();
  return { image: c.image, token: c.token };
}
