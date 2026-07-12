import type { Prisma } from "@prisma/client";

// Minimal shape needed to compute a factor's monetary totals.
type ItemLike = { quantity: Prisma.Decimal | number; unitPrice: Prisma.Decimal | number };
type FactorLike = {
  items: ItemLike[];
  discount: Prisma.Decimal | number;
  vat: Prisma.Decimal | number;
};

/**
 * Sum of quantity × unitPrice across all items (ریال). Each line is rounded to
 * an integer Rial before summing so fractional quantities can't leave float
 * dust that would throw off the printed total / «به حروف».
 */
export function factorSubtotal(items: ItemLike[]): number {
  return items.reduce(
    (sum, it) => sum + Math.round(Number(it.quantity) * Number(it.unitPrice)),
    0
  );
}

/** Payable total = subtotal − discount + vat, integer Rial, floored at zero. */
export function factorPayable(factor: FactorLike): number {
  const subtotal = factorSubtotal(factor.items);
  const payable = subtotal - Math.round(Number(factor.discount)) + Math.round(Number(factor.vat));
  return Math.max(0, Math.round(payable));
}
