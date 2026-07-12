// Reassign ALL contacts, companies, and deals to the single OWNER account.
// Policy: members and admins own nothing — everything belongs to the owner.
// New records already do this (createContact/Company/Deal); this backfills
// existing rows. Idempotent. Run: node scripts/reassign-ownership.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const owner = await prisma.user.findFirst({
  where: { role: "OWNER", isActive: true },
  orderBy: { createdAt: "asc" },
  select: { id: true, name: true },
});
if (!owner) {
  console.error("No active OWNER found — aborting.");
  process.exit(1);
}

const [c, co, d] = await Promise.all([
  prisma.contact.updateMany({ where: { ownerId: { not: owner.id } }, data: { ownerId: owner.id } }),
  prisma.company.updateMany({ where: { ownerId: { not: owner.id } }, data: { ownerId: owner.id } }),
  prisma.deal.updateMany({ where: { ownerId: { not: owner.id } }, data: { ownerId: owner.id } }),
]);

console.log(`Reassigned to ${owner.name}: contacts ${c.count}, companies ${co.count}, deals ${d.count}`);
await prisma.$disconnect();
