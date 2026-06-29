/**
 * Idempotently creates/updates the first admin user from env vars.
 * Used on container start when ADMIN_EMAIL + ADMIN_PASSWORD are set.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Administrator";

  if (!email || !password) {
    console.log("[bootstrap] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping.");
    return;
  }

  const prisma = new PrismaClient();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't overwrite the password on every restart — only ensure the account
    // stays an active owner. Use the in-app password reset to change it.
    await prisma.user.update({
      where: { email },
      data: { role: "OWNER", isActive: true },
    });
    console.log(`[bootstrap] Admin exists; password left unchanged: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, name, passwordHash, role: "OWNER", avatarColor: "#6366f1" },
    });
    console.log(`[bootstrap] Admin user created: ${email}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[bootstrap] failed:", e);
  process.exit(1);
});
