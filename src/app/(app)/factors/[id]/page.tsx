import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, isOwner, canManageUsers } from "@/lib/rbac";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import { FactorActions } from "../factor-actions";
import { FactorForm, type FactorInitial } from "../factor-form";
import { ShareFactor, type ShareChannel } from "../share-factor";
import { updateFactor } from "@/lib/actions/factors";
import {
  PAYMENT_KIND_LABEL,
  STATE_LABEL,
  isPreFactor,
  enabledSources,
} from "@/lib/factor";
import { factorSubtotal, factorPayable } from "@/lib/factor-total";
import { numberToPersianWords } from "@/lib/num-to-fa";
import { formatNumber, formatDate, toFa } from "@/lib/format";
import "../print.css";

export default async function FactorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const factor = await prisma.factor.findUnique({
    where: { id },
    include: {
      items: { orderBy: { row: "asc" } },
      creator: { select: { name: true } },
      confirmedBy: { select: { name: true } },
    },
  });
  if (!factor) notFound();

  // Non manager users cannot view a paid-onward factor.
  const manager = canManageUsers(user.role);
  const owner = isOwner(user.role);
  if (!manager && ["PAID", "SENDING", "EXIT"].includes(factor.state)) notFound();

  const isCreator = factor.creatorId === user.id;
  const preFactor = isPreFactor(factor.state);

  const perms = {
    canConfirm: owner && factor.state === "INITIAL",
    canPay: (isCreator || owner) && factor.state === "FOLLOWING_UP",
    canSend: owner && factor.state === "PAID",
    canCancel:
      (isCreator || owner) && ["INITIAL", "FOLLOWING_UP"].includes(factor.state),
    canReopen: (isCreator || owner) && factor.state === "CANCELED",
    canDelete: manager,
    canEdit: manager || (isCreator && preFactor),
  };

  const sources = perms.canSend ? await enabledSources() : [];

  // Channels the user belongs to — targets for sharing this factor.
  const memberships = await prisma.channelMember.findMany({
    where: { userId: user.id },
    include: {
      channel: {
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
        },
      },
    },
  });
  const shareChannels: ShareChannel[] = memberships.map((m) => {
    const other = m.channel.isDirect
      ? m.channel.members.find((mem) => mem.user.id !== user.id)?.user
      : undefined;
    return {
      id: m.channel.id,
      name: m.channel.isDirect ? other?.name ?? "پیام مستقیم" : m.channel.name,
      isDirect: m.channel.isDirect,
      otherColor: other?.avatarColor,
    };
  });

  const subtotal = factorSubtotal(factor.items);
  const payable = factorPayable(factor);

  const editInitial: FactorInitial = {
    buyerName: factor.buyerName,
    buyerPhone: factor.buyerPhone ?? "",
    buyerAddress: factor.buyerAddress ?? "",
    buyerEconomicCode: factor.buyerEconomicCode ?? "",
    buyerNationalId: factor.buyerNationalId ?? "",
    buyerRegistrationNumber: factor.buyerRegistrationNumber ?? "",
    buyerPostalCode: factor.buyerPostalCode ?? "",
    contactId: factor.contactId ?? undefined,
    paymentKind: factor.paymentKind,
    discount: String(Number(factor.discount)),
    vat: String(Number(factor.vat)),
    notes: factor.notes ?? "",
    sellerName: factor.sellerName,
    sellerAddress: factor.sellerAddress,
    sellerPhone: factor.sellerPhone,
    sellerMobile: factor.sellerMobile,
    sellerInstagram: factor.sellerInstagram,
    sellerWebsite: factor.sellerWebsite,
    items: factor.items.map((it) => ({
      name: it.name,
      metrage: String(Number(it.metrage)),
      quantity: String(Number(it.quantity)),
      unitPrice: String(Number(it.unitPrice)),
      description: it.description ?? "",
    })),
  };

  const docTitle = preFactor || factor.state === "CANCELED" ? "پیش‌فاکتور" : "فاکتور";

  return (
    <div className="p-4 sm:p-6">
      <AutoRefresh interval={20000} />
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/factors"
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-[var(--brand)]"
        >
          <ArrowRight size={16} aria-hidden="true" /> بازگشت به فاکتورها
        </Link>
        <div className="flex items-center gap-2">
          <ShareFactor factorId={factor.id} channels={shareChannels} />
          {perms.canEdit && (
            <FactorForm
              action={updateFactor.bind(null, factor.id)}
              initial={editInitial}
              title="ویرایش فاکتور"
              triggerLabel="ویرایش"
              triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
            />
          )}
        </div>
      </div>

      <div className="mb-4">
        <FactorActions
          factorId={factor.id}
          canConfirm={perms.canConfirm}
          canPay={perms.canPay}
          canSend={perms.canSend}
          canCancel={perms.canCancel}
          canReopen={perms.canReopen}
          canDelete={perms.canDelete}
          enabledSources={sources}
        />
      </div>

      {/* Printable invoice sheet */}
      <div
        id="factor-print"
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]"
        dir="rtl"
      >
        {/* Brand header band */}
        <header className="flex items-center justify-between gap-4 border-b-2 border-[color:var(--gold-hair)] bg-[var(--gold-tint)] px-6 py-5">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/spun-logo-bw.png"
              alt="اسپان هلدینگ"
              width={112}
              height={49}
              className="h-auto w-24 shrink-0 sm:w-28"
              priority
            />
            <div className="border-s border-[color:var(--gold-hair)] ps-4">
              <h1 className="text-lg font-black tracking-tight sm:text-xl">{factor.sellerName}</h1>
              <p className="mt-0.5 text-xs text-[color:var(--gold-ink)] sm:text-sm">
                صورتحساب فروش کالا / خدمات
              </p>
            </div>
          </div>
          <div className="text-end">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-sm font-bold text-[color:var(--gold-ink)]">
              {docTitle}
            </div>
            <div className="mt-1.5 space-y-0.5 text-xs text-muted">
              <div>
                شماره: <span className="tabular-nums font-medium text-text">{toFa(factor.number)}</span>
              </div>
              <div>تاریخ: {formatDate(factor.createdAt)}</div>
              <div className="text-faint">{STATE_LABEL[factor.state]}</div>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Seller / buyer blocks */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
              <h2 className="mb-2 inline-flex rounded-md bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-bold text-[color:var(--gold-ink)]">
                مشخصات فروشنده
              </h2>
              <p className="font-medium">{factor.sellerName}</p>
              <p className="mt-1 text-muted">{factor.sellerAddress}</p>
              <p className="mt-1 text-muted tabular-nums" dir="ltr">
                {toFa(factor.sellerPhone)} · {toFa(factor.sellerMobile)}
              </p>
              <p className="text-muted" dir="ltr">
                {factor.sellerInstagram} · {factor.sellerWebsite}
              </p>
            </section>
            <section className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
              <h2 className="mb-2 inline-flex rounded-md bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-bold text-[color:var(--gold-ink)]">
                مشخصات خریدار
              </h2>
              <p className="font-medium">{factor.buyerName}</p>
              {factor.buyerPhone && (
                <p className="mt-1 text-muted tabular-nums" dir="ltr">
                  {toFa(factor.buyerPhone)}
                </p>
              )}
              {factor.buyerAddress && (
                <p className="mt-1 text-muted [overflow-wrap:anywhere]">{factor.buyerAddress}</p>
              )}
              {(factor.buyerNationalId ||
                factor.buyerEconomicCode ||
                factor.buyerPostalCode ||
                factor.buyerRegistrationNumber) && (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted">
                  {factor.buyerNationalId && (
                    <div className="flex justify-between gap-2">
                      <dt>شناسه/کد ملی</dt>
                      <dd className="tabular-nums" dir="ltr">{toFa(factor.buyerNationalId)}</dd>
                    </div>
                  )}
                  {factor.buyerEconomicCode && (
                    <div className="flex justify-between gap-2">
                      <dt>شماره اقتصادی</dt>
                      <dd className="tabular-nums" dir="ltr">{toFa(factor.buyerEconomicCode)}</dd>
                    </div>
                  )}
                  {factor.buyerPostalCode && (
                    <div className="flex justify-between gap-2">
                      <dt>کد پستی</dt>
                      <dd className="tabular-nums" dir="ltr">{toFa(factor.buyerPostalCode)}</dd>
                    </div>
                  )}
                  {factor.buyerRegistrationNumber && (
                    <div className="flex justify-between gap-2">
                      <dt>شماره ثبت</dt>
                      <dd className="tabular-nums" dir="ltr">{toFa(factor.buyerRegistrationNumber)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          </div>

          {/* Line items — with a faint centered logo watermark behind the rows */}
          <div className="relative mt-5">
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"
              aria-hidden="true"
            >
              <Image
                src="/brand/spun-logo-black.png"
                alt=""
                width={360}
                height={157}
                className="h-auto w-2/3 max-w-sm"
              />
            </div>
            <div className="relative overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--gold-tint)] text-[color:var(--gold-ink)]">
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 font-bold">ردیف</th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 text-start font-bold">
                      نام کالا / خدمات
                    </th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 font-bold">متراژ</th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 font-bold">تعداد</th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 font-bold">بهای واحد</th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 font-bold">مبلغ کل</th>
                    <th className="border-b border-[color:var(--gold-hair)] px-3 py-2.5 text-start font-bold">شرح</th>
                  </tr>
                </thead>
                <tbody>
                  {factor.items.map((it, idx) => (
                    <tr key={it.id} className={idx % 2 === 1 ? "bg-surface-2/60" : undefined}>
                      <td className="border-b border-border px-3 py-2.5 text-center tabular-nums text-muted">
                        {toFa(it.row)}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 font-medium">{it.name}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center tabular-nums">
                        {formatNumber(Number(it.metrage))}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center tabular-nums">
                        {formatNumber(Number(it.quantity))}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center tabular-nums">
                        {formatNumber(Number(it.unitPrice))}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center font-medium tabular-nums">
                        {formatNumber(Math.round(Number(it.metrage) * Number(it.quantity) * Number(it.unitPrice)))}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-muted">
                        {it.description ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs rounded-xl border border-[color:var(--gold-hair)] bg-[var(--gold-tint)] p-3 text-xs text-[color:var(--gold-ink)]">
              <span className="font-bold">مبلغ به حروف:</span> {numberToPersianWords(payable)}
            </div>
            <div className="w-full max-w-xs shrink-0 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">جمع کل</span>
                <span className="tabular-nums">{formatNumber(subtotal)} ریال</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">تخفیف</span>
                <span className="tabular-nums">{formatNumber(Number(factor.discount))} ریال</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">مالیات</span>
                <span className="tabular-nums">{formatNumber(Number(factor.vat))} ریال</span>
              </div>
              <div className="mt-1 flex items-center justify-between rounded-lg bg-[var(--gold-tint)] px-3 py-2 font-bold text-[color:var(--gold-ink)]">
                <span>مبلغ قابل پرداخت</span>
                <span className="tabular-nums">{formatNumber(payable)} ریال</span>
              </div>
            </div>
          </div>

          {/* Meta + notes */}
          <div className="mt-5 border-t border-[color:var(--gold-hair)] pt-3 text-sm">
            {/* Internal meta — visible on-screen for staff, hidden from print/PDF. */}
            <div className="no-print flex flex-wrap gap-x-6 gap-y-1 text-muted">
              <span>نوع پرداخت: {PAYMENT_KIND_LABEL[factor.paymentKind]}</span>
              <span>صادرکننده: {factor.creator.name}</span>
              {factor.confirmedBy && <span>تأییدکننده: {factor.confirmedBy.name}</span>}
            </div>
            {factor.notes &&
              // The default note is about pre-factor validity — drop it once the
              // factor is finalized (unless the user replaced it with real text).
              !(
                !preFactor &&
                factor.notes.trim() ===
                  "اعتبار پیش فاکتور درصورت واریز نقدی حداکثر ۴۸ ساعت می‌باشد"
              ) && <p className="mt-2 text-muted">{factor.notes}</p>}
          </div>

          {/* Signature footer */}
          <div className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-muted">
            <div className="border-t border-dashed border-border pt-2">مهر و امضای فروشنده</div>
            <div className="border-t border-dashed border-border pt-2">مهر و امضای خریدار</div>
          </div>
        </div>
      </div>
    </div>
  );
}
