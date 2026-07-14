import type { Prisma } from "@prisma/client";
import { STATE_LABEL, PAYMENT_KIND_LABEL } from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import type { InvoiceFactor } from "@/lib/factor-invoice-html";

type FactorWithItems = Prisma.FactorGetPayload<{ include: { items: true } }>;

/** Map a live Prisma factor (with items) to the print/PDF invoice shape. */
export function toInvoiceFactor(f: FactorWithItems): InvoiceFactor {
  return {
    number: f.number,
    stateLabel: STATE_LABEL[f.state],
    paymentKindLabel: PAYMENT_KIND_LABEL[f.paymentKind],
    buyerName: f.buyerName,
    buyerPhone: f.buyerPhone,
    buyerAddress: f.buyerAddress,
    buyerEconomicCode: f.buyerEconomicCode,
    buyerNationalId: f.buyerNationalId,
    buyerRegistrationNumber: f.buyerRegistrationNumber,
    buyerPostalCode: f.buyerPostalCode,
    sellerName: f.sellerName,
    sellerAddress: f.sellerAddress,
    sellerPhone: f.sellerPhone,
    sellerMobile: f.sellerMobile,
    sellerInstagram: f.sellerInstagram,
    sellerWebsite: f.sellerWebsite,
    discount: Number(f.discount),
    vat: Number(f.vat),
    payableRial: Math.round(factorPayable(f)),
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    items: f.items
      .slice()
      .sort((a, b) => a.row - b.row)
      .map((it) => ({
        row: it.row,
        name: it.name,
        metrage: Number(it.metrage),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        description: it.description,
      })),
  };
}
