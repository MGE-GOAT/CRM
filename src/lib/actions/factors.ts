"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, isOwner, canManageUsers } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";
import {
  jalaliMonthKey,
  claimFactorNumber,
  ensureSourceOptions,
  enabledSources,
  isPreFactor,
  PAYMENT_KIND_LABEL,
  STATE_LABEL,
  OWNER_ONLY_STATES,
} from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import { formatNumber } from "@/lib/format";
import { PaymentKind, SourceKind, Prisma } from "@prisma/client";

// A single line item as submitted from the create/edit form.
const itemSchema = z.object({
  name: z.string().min(1, "نام کالا الزامی است").max(300),
  quantity: z.coerce.number().min(0, "تعداد نامعتبر است"),
  unitPrice: z.coerce.number().min(0, "بهای واحد نامعتبر است"),
  description: z.string().max(500).optional(),
});

const factorSchema = z.object({
  contactId: z.string().optional(),
  buyerName: z.string().min(1, "نام خریدار الزامی است").max(300),
  buyerPhone: z.string().max(50).optional(),
  buyerAddress: z.string().max(1000).optional(),
  buyerEconomicCode: z.string().max(50).optional(),
  buyerNationalId: z.string().max(50).optional(),
  buyerRegistrationNumber: z.string().max(50).optional(),
  buyerPostalCode: z.string().max(50).optional(),
  paymentKind: z.enum(["CASH", "CHEQUE", "HALF_HALF"]),
  discount: z.coerce.number().min(0).default(0),
  vat: z.coerce.number().min(0).default(0),
  notes: z.string().max(2000).optional(),
  sellerName: z.string().max(300).optional(),
  sellerAddress: z.string().max(500).optional(),
  sellerPhone: z.string().max(50).optional(),
  sellerMobile: z.string().max(50).optional(),
  sellerInstagram: z.string().max(100).optional(),
  sellerWebsite: z.string().max(200).optional(),
  items: z.array(itemSchema).min(1, "حداقل یک ردیف کالا لازم است"),
});

/** Parse the shared factor fields (plus items JSON) out of a FormData. */
function parseFactorForm(formData: FormData) {
  const rawItems = formData.get("items");
  let items: unknown = [];
  if (typeof rawItems === "string" && rawItems.trim()) {
    items = JSON.parse(rawItems);
  }
  // Payment type is required — reject an unset one with a clear Farsi message
  // (rather than the generic zod enum error).
  if (!formData.get("paymentKind")) throw new Error("نوع پرداخت را انتخاب کنید.");
  return factorSchema.parse({
    contactId: formData.get("contactId") || undefined,
    buyerName: formData.get("buyerName"),
    buyerPhone: formData.get("buyerPhone") || undefined,
    buyerAddress: formData.get("buyerAddress") || undefined,
    buyerEconomicCode: formData.get("buyerEconomicCode") || undefined,
    buyerNationalId: formData.get("buyerNationalId") || undefined,
    buyerRegistrationNumber: formData.get("buyerRegistrationNumber") || undefined,
    buyerPostalCode: formData.get("buyerPostalCode") || undefined,
    paymentKind: formData.get("paymentKind") || undefined,
    discount: formData.get("discount") || 0,
    vat: formData.get("vat") || 0,
    notes: formData.get("notes") || undefined,
    sellerName: formData.get("sellerName") || undefined,
    sellerAddress: formData.get("sellerAddress") || undefined,
    sellerPhone: formData.get("sellerPhone") || undefined,
    sellerMobile: formData.get("sellerMobile") || undefined,
    sellerInstagram: formData.get("sellerInstagram") || undefined,
    sellerWebsite: formData.get("sellerWebsite") || undefined,
    items,
  });
}

function sellerOverrides(d: z.infer<typeof factorSchema>) {
  // Only include seller fields the user actually edited; undefined keeps the
  // schema default (create) or the existing value (update).
  const out: Record<string, string> = {};
  if (d.sellerName) out.sellerName = d.sellerName;
  if (d.sellerAddress) out.sellerAddress = d.sellerAddress;
  if (d.sellerPhone) out.sellerPhone = d.sellerPhone;
  if (d.sellerMobile) out.sellerMobile = d.sellerMobile;
  if (d.sellerInstagram) out.sellerInstagram = d.sellerInstagram;
  if (d.sellerWebsite) out.sellerWebsite = d.sellerWebsite;
  return out;
}

/**
 * createFactor — any logged-in user. Creates a pre-factor (INITIAL) with its
 * line items, then notifies every OWNER so one of them can confirm it.
 */
export async function createFactor(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const d = parseFactorForm(formData);

    const monthKey = jalaliMonthKey();
    const itemsData = d.items.map((it, idx) => ({
      row: idx + 1,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      description: it.description || null,
    }));

    // Factor numbers come from the owner-settable running counter (continuous,
    // no monthly reset). claimFactorNumber() atomically advances the counter and
    // persists even if the create fails, so a P2002 collision (e.g. the owner
    // set the counter onto an existing number) just retries with the next value.
    let factor: Awaited<ReturnType<typeof prisma.factor.create>> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const number = await claimFactorNumber();
      try {
        factor = await prisma.factor.create({
          data: {
            number,
            monthKey,
            state: "INITIAL",
            paymentKind: d.paymentKind as PaymentKind,
            contactId: d.contactId || null,
            buyerName: d.buyerName,
            buyerPhone: d.buyerPhone || null,
            buyerAddress: d.buyerAddress || null,
            buyerEconomicCode: d.buyerEconomicCode || null,
            buyerNationalId: d.buyerNationalId || null,
            buyerRegistrationNumber: d.buyerRegistrationNumber || null,
            buyerPostalCode: d.buyerPostalCode || null,
            discount: d.discount,
            vat: d.vat,
            notes: d.notes ?? undefined,
            creatorId: user.id,
            ...sellerOverrides(d),
            items: { create: itemsData },
          },
        });
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue; // number taken — retry
        throw err;
      }
    }
    if (!factor) throw new Error("ثبت فاکتور ناموفق بود. دوباره تلاش کنید.");

    // Notify every owner — best-effort. The factor is already committed above,
    // so a notification failure must NOT fail the whole action (which would make
    // the user retry and create a duplicate). Same pattern as the chat/task
    // notification emits.
    try {
      const owners = await prisma.user.findMany({
        where: { role: "OWNER", isActive: true },
        select: { id: true },
      });
      if (owners.length) {
        await prisma.notification.createMany({
          data: owners.map((o) => ({
            userId: o.id,
            type: "TASK" as const,
            title: "پیش‌فاکتور جدید",
            body: `${d.buyerName} — شماره ${factor!.number}`,
            href: `/factors/${factor.id}`,
          })),
        });
      }
    } catch (err) {
      console.error("factor owner-notification failed", err);
    }

    revalidatePath("/factors");
  } catch (e) {
    return formError(e);
  }
}

/** confirmFactor — OWNER only. INITIAL → FOLLOWING_UP. Notifies the creator. */
export async function confirmFactor(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!isOwner(user.role)) throw new Error("فقط مالک می‌تواند پیش‌فاکتور را تأیید کند.");
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id },
      select: { state: true, creatorId: true, number: true },
    });
    if (factor.state !== "INITIAL") throw new Error("این پیش‌فاکتور قابل تأیید نیست.");

    // Conditional transition so a double-submit can't double-notify / clobber.
    const moved = await prisma.factor.updateMany({
      where: { id, state: "INITIAL" },
      data: {
        state: "FOLLOWING_UP",
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
    });
    if (moved.count === 0) throw new Error("این پیش‌فاکتور قابل تأیید نیست.");
    await prisma.notification.create({
      data: {
        userId: factor.creatorId,
        type: "TASK",
        title: "پیش‌فاکتور تأیید شد",
        body: `شماره ${factor.number}`,
        href: `/factors/${id}`,
      },
    });

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
  } catch (e) {
    return formError(e);
  }
}

/** markFactorPaid — creator or OWNER. FOLLOWING_UP → PAID. Notifies owners. */
export async function markFactorPaid(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id },
      select: { state: true, creatorId: true, number: true, buyerName: true },
    });
    if (factor.creatorId !== user.id && !isOwner(user.role)) {
      throw new Error("اجازهٔ ثبت پرداخت این فاکتور را ندارید.");
    }
    if (factor.state !== "FOLLOWING_UP") throw new Error("این فاکتور در وضعیت پیگیری نیست.");

    // Conditional transition so concurrent submits can't double-notify owners.
    const moved = await prisma.factor.updateMany({
      where: { id, state: "FOLLOWING_UP" },
      data: { state: "PAID", paidAt: new Date() },
    });
    if (moved.count === 0) throw new Error("این فاکتور در وضعیت پیگیری نیست.");

    const owners = await prisma.user.findMany({
      where: { role: "OWNER", isActive: true },
      select: { id: true },
    });
    if (owners.length) {
      await prisma.notification.createMany({
        data: owners.map((o) => ({
          userId: o.id,
          type: "TASK" as const,
          title: "فاکتور پرداخت شد — آماده ارسال",
          body: `${factor.buyerName} — شماره ${factor.number}`,
          href: `/factors/${id}`,
        })),
      });
    }

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
    revalidatePath("/factors/sent");
  } catch (e) {
    return formError(e);
  }
}

/**
 * setNextFactorNumber — OWNER only. Sets the running factor-number counter so
 * the NEXT factor gets `value` and numbering continues from there. Lets the team
 * align the app's codes with their real invoice sequence at any time.
 */
export async function setNextFactorNumber(value: number): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!isOwner(user.role)) throw new Error("فقط مالک می‌تواند شمارهٔ فاکتور را تنظیم کند.");
    if (!Number.isInteger(value) || value < 1 || value > 1_000_000_000) {
      throw new Error("شمارهٔ نامعتبر است.");
    }
    await prisma.factorCounter.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", next: value },
      update: { next: value },
    });
    revalidatePath("/factors");
  } catch (e) {
    return formError(e);
  }
}

/**
 * cancelFactor — creator or OWNER. A pre-factor the buyer never paid for
 * (INITIAL/FOLLOWING_UP) → CANCELED. Terminal, but reversible via reopenFactor.
 */
export async function cancelFactor(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id },
      select: { state: true, creatorId: true, number: true },
    });
    if (factor.creatorId !== user.id && !isOwner(user.role)) {
      throw new Error("اجازهٔ لغو این پیش‌فاکتور را ندارید.");
    }
    if (factor.state !== "INITIAL" && factor.state !== "FOLLOWING_UP") {
      throw new Error("فقط پیش‌فاکتور تأییدنشده یا در حال پیگیری قابل لغو است.");
    }

    // Conditional transition so a double-submit can't clobber a later state.
    const moved = await prisma.factor.updateMany({
      where: { id, state: { in: ["INITIAL", "FOLLOWING_UP"] } },
      data: { state: "CANCELED", canceledAt: new Date() },
    });
    if (moved.count === 0) throw new Error("این پیش‌فاکتور قابل لغو نیست.");

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
  } catch (e) {
    return formError(e);
  }
}

/** reopenFactor — creator or OWNER. Undo a cancel: CANCELED → FOLLOWING_UP. */
export async function reopenFactor(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id },
      select: { state: true, creatorId: true, confirmedAt: true },
    });
    if (factor.creatorId !== user.id && !isOwner(user.role)) {
      throw new Error("اجازهٔ بازگردانی این پیش‌فاکتور را ندارید.");
    }
    if (factor.state !== "CANCELED") throw new Error("این پیش‌فاکتور لغو نشده است.");

    // Restore to the pre-cancel state: a factor that was never owner-confirmed
    // goes back to INITIAL (still needs owner approval), not FOLLOWING_UP —
    // otherwise cancel→reopen would silently skip the owner's confirmation.
    const restoreState = factor.confirmedAt ? "FOLLOWING_UP" : "INITIAL";
    const moved = await prisma.factor.updateMany({
      where: { id, state: "CANCELED" },
      data: { state: restoreState, canceledAt: null },
    });
    if (moved.count === 0) throw new Error("این پیش‌فاکتور قابل بازگردانی نیست.");

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
  } catch (e) {
    return formError(e);
  }
}

/**
 * sendFactor — OWNER only. PAID → SENDING. Creates one FactorSourceEntry per
 * selected (enabled) source.
 */
export async function sendFactor(id: string, sources: SourceKind[]): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!isOwner(user.role)) throw new Error("فقط مالک می‌تواند فاکتور را ارسال کند.");
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id },
      select: { state: true },
    });
    if (factor.state !== "PAID") throw new Error("این فاکتور آمادهٔ ارسال نیست.");

    const allowed = await enabledSources();
    const unique = Array.from(new Set(sources));
    if (unique.length === 0) throw new Error("حداقل یک منبع را انتخاب کنید.");
    if (!unique.every((s) => allowed.includes(s))) {
      throw new Error("منبع انتخاب‌شده فعال نیست.");
    }

    // Conditional transition so two concurrent sends can't both add sources /
    // double-fire: only the write that still sees PAID wins.
    // Atomic: move to SENDING and create the source entries together, so a
    // failure can't leave the factor stuck in SENDING with zero sources (which
    // could never be checked out to EXIT).
    await prisma.$transaction(async (tx) => {
      const moved = await tx.factor.updateMany({
        where: { id, state: "PAID" },
        data: { state: "SENDING", sentAt: new Date() },
      });
      if (moved.count === 0) throw new Error("این فاکتور قبلاً ارسال شده است.");
      await tx.factorSourceEntry.createMany({
        data: unique.map((source) => ({ factorId: id, source })),
        skipDuplicates: true,
      });
    });

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
    revalidatePath("/factors/sent");
  } catch (e) {
    return formError(e);
  }
}

/**
 * checkSourceEntry — OWNER + ADMIN. Marks a source entry checked (آرشیو).
 * When all entries of the factor are checked, the factor moves to EXIT.
 */
export async function checkSourceEntry(entryId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) throw new Error("اجازهٔ این عملیات را ندارید.");
    const entry = await prisma.factorSourceEntry.findUniqueOrThrow({
      where: { id: entryId },
      select: { factorId: true },
    });

    await prisma.factorSourceEntry.update({
      where: { id: entryId },
      data: { checked: true, checkedAt: new Date(), checkedById: user.id },
    });

    const remaining = await prisma.factorSourceEntry.count({
      where: { factorId: entry.factorId, checked: false },
    });
    if (remaining === 0) {
      await prisma.factor.update({
        where: { id: entry.factorId },
        data: { state: "EXIT", archivedAt: new Date() },
      });
    }

    revalidatePath("/factors/sent");
    revalidatePath(`/factors/sent/${entry.factorId}`);
    revalidatePath(`/factors/${entry.factorId}`);
  } catch (e) {
    return formError(e);
  }
}

/** uncheckSourceEntry — OWNER + ADMIN (undo). Reverts EXIT back to SENDING. */
export async function uncheckSourceEntry(entryId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) throw new Error("اجازهٔ این عملیات را ندارید.");
    const entry = await prisma.factorSourceEntry.findUniqueOrThrow({
      where: { id: entryId },
      select: { factorId: true, factor: { select: { state: true } } },
    });

    await prisma.factorSourceEntry.update({
      where: { id: entryId },
      data: { checked: false, checkedAt: null, checkedById: null },
    });

    if (entry.factor.state === "EXIT") {
      await prisma.factor.update({
        where: { id: entry.factorId },
        data: { state: "SENDING", archivedAt: null },
      });
    }

    revalidatePath("/factors/sent");
    revalidatePath(`/factors/sent/${entry.factorId}`);
    revalidatePath(`/factors/${entry.factorId}`);
  } catch (e) {
    return formError(e);
  }
}

/** setSourceEnabled — OWNER only. Toggles an enabled sending source. */
export async function setSourceEnabled(
  key: SourceKind,
  enabled: boolean,
): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!isOwner(user.role)) throw new Error("فقط مالک می‌تواند منابع را تغییر دهد.");
    await ensureSourceOptions();
    await prisma.factorSourceOption.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    });
    revalidatePath("/factors/sent");
  } catch (e) {
    return formError(e);
  }
}

/**
 * updateFactor — the creator while it's still a pre-factor (INITIAL/FOLLOWING_UP),
 * or an OWNER/ADMIN in any state. Replaces all line items.
 */
export async function updateFactor(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const manager = canManageUsers(user.role);
    const d = parseFactorForm(formData);

    // Authorize INSIDE the write so a creator can't race an owner's state
    // transition and edit after the factor left pre-factor. A manager may edit
    // any state; a creator only while still INITIAL/FOLLOWING_UP.
    const where: Prisma.FactorWhereInput = manager
      ? { id }
      : { id, creatorId: user.id, state: { in: ["INITIAL", "FOLLOWING_UP"] } };

    await prisma.$transaction(async (tx) => {
      const res = await tx.factor.updateMany({
        where,
        data: {
          paymentKind: d.paymentKind as PaymentKind,
          contactId: d.contactId || null,
          buyerName: d.buyerName,
          buyerPhone: d.buyerPhone || null,
          buyerAddress: d.buyerAddress || null,
          buyerEconomicCode: d.buyerEconomicCode || null,
          buyerNationalId: d.buyerNationalId || null,
          buyerRegistrationNumber: d.buyerRegistrationNumber || null,
          buyerPostalCode: d.buyerPostalCode || null,
          discount: d.discount,
          vat: d.vat,
          notes: d.notes ?? undefined,
          ...sellerOverrides(d),
        },
      });
      if (res.count === 0) {
        throw new Error("این فاکتور قابل ویرایش نیست یا اجازه ندارید.");
      }
      await tx.factorItem.deleteMany({ where: { factorId: id } });
      await tx.factorItem.createMany({
        data: d.items.map((it, idx) => ({
          factorId: id,
          row: idx + 1,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          description: it.description || null,
        })),
      });
    });

    revalidatePath("/factors");
    revalidatePath(`/factors/${id}`);
  } catch (e) {
    return formError(e);
  }
}

/** deleteFactor — OWNER/ADMIN any state, or the creator while still INITIAL. */
export async function deleteFactor(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Only ADMIN/OWNER may delete factors — members can't delete anything.
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    const res = await prisma.factor.deleteMany({ where: { id } });
    if (res.count === 0) {
      throw new Error("این فاکتور قابل حذف نیست یا اجازه ندارید.");
    }
    revalidatePath("/factors");
    revalidatePath("/factors/sent");
  } catch (e) {
    return formError(e);
  }
}

/**
 * shareFactorToChannel — post a factor as a card into a chat channel/DM the
 * user belongs to. Snapshot summary in the body + a live link via factorId.
 * Members can't share a factor they aren't allowed to see (owner-only states).
 */
export async function shareFactorToChannel(
  factorId: string,
  channelId: string
): Promise<FormResult> {
  const user = await requireUser();
  try {
    const factor = await prisma.factor.findUniqueOrThrow({
      where: { id: factorId },
      select: {
        number: true,
        buyerName: true,
        state: true,
        paymentKind: true,
        discount: true,
        vat: true,
        items: { select: { quantity: true, unitPrice: true } },
      },
    });
    // Visibility: non-managers can't share paid-onward factors.
    if (!canManageUsers(user.role) && OWNER_ONLY_STATES.includes(factor.state)) {
      throw new Error("اجازهٔ اشتراک این فاکتور را ندارید.");
    }
    // The sharer must be a member of the target channel.
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!member) throw new Error("شما عضو این کانال نیستید.");

    const label = isPreFactor(factor.state) ? "پیش‌فاکتور" : "فاکتور";
    const total = factorPayable(factor);
    const lines = [
      `${label} شماره ${formatNumber(factor.number)}`,
      `خریدار: ${factor.buyerName}`,
      `نوع پرداخت: ${PAYMENT_KIND_LABEL[factor.paymentKind]}`,
      `مبلغ: ${formatNumber(total)} ریال`,
      `وضعیت: ${STATE_LABEL[factor.state]}`,
    ];

    await prisma.message.create({
      data: {
        channelId,
        senderId: user.id,
        kind: "FACTOR_SHARE",
        factorId,
        body: lines.join("\n"),
      },
    });
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });
    // Notify the other members.
    const others = await prisma.channelMember.findMany({
      where: { channelId, userId: { not: user.id } },
      select: { userId: true },
    });
    if (others.length) {
      await prisma.notification.createMany({
        data: others.map((o) => ({
          userId: o.userId,
          type: "MESSAGE" as const,
          title: user.name,
          body: `${label} شماره ${formatNumber(factor.number)} را به اشتراک گذاشت`,
          href: `/chat/${channelId}`,
        })),
      });
    }
    revalidatePath(`/chat/${channelId}`);
    revalidatePath("/chat");
  } catch (e) {
    return formError(e);
  }
}
