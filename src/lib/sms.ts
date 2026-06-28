// SMS sending via Melipayamak (ملی‌پیامک) classic REST web service.
// Uses panel username + password (no console API key needed).
// Credentials come from env: MELIPAYAMAK_USERNAME, MELIPAYAMAK_PASSWORD, MELIPAYAMAK_SENDER.
// Sending custom free text requires a DEDICATED sender line (خط اختصاصی).

import { toLocalIranPhone } from "@/lib/format";

const ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/SendSMS";

export type SmsResult = { ok: true; id: string } | { ok: false; error: string };

/** Send a single SMS. Returns a result instead of throwing. */
export async function sendSms(toPhone: string, text: string): Promise<SmsResult> {
  const username = process.env.MELIPAYAMAK_USERNAME;
  const password = process.env.MELIPAYAMAK_PASSWORD;
  const from = process.env.MELIPAYAMAK_SENDER;
  if (!username || !password || !from) {
    return { ok: false, error: "سرویس پیامک پیکربندی نشده است." };
  }

  const to = toLocalIranPhone(toPhone);
  if (to.replace(/\D/g, "").length < 10) {
    return { ok: false, error: "شماره موبایل نامعتبر است." };
  }

  try {
    const body = new URLSearchParams({ username, password, to, from, text, isflash: "false" });
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data: unknown = await res.json().catch(() => null);
    // Classic API returns { Value, RetStatus, StrRetStatus }.
    // RetStatus === 1 => success, Value = message recId (a long number).
    const retStatus = Number(readField(data, ["RetStatus", "retStatus"]));
    const value = readField(data, ["Value", "value"]);
    const strStatus = readField(data, ["StrRetStatus", "strRetStatus"]);
    if (res.ok && retStatus === 1 && value && Number(value) > 0) {
      return { ok: true, id: String(value) };
    }
    return { ok: false, error: strStatus ? String(strStatus) : `خطای سرویس پیامک (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ارسال پیامک ناموفق بود." };
  }
}

function readField(data: unknown, keys: string[]): unknown {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}
