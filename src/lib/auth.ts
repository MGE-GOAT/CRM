import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// Fail loud at runtime in production if the secret is missing or left as an
// example value. Skipped during `next build` (page-data collection), where
// AUTH_SECRET is intentionally absent from the build environment.
if (
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.NODE_ENV === "production" &&
  (!process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET === "replace-with-a-long-random-secret" ||
    process.env.AUTH_SECRET === "generate-with-openssl-rand-base64-32")
) {
  throw new Error(
    "AUTH_SECRET is not configured — set a unique value (openssl rand -base64 32)."
  );
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Current bcrypt cost. DUMMY_HASH MUST use this same cost so a real compare and
// the no-such-user compare take the same time (timing-equalizer correctness).
const BCRYPT_COST = 12;

// A valid cost-12 bcrypt hash used to equalize response time when the account
// doesn't exist or is disabled, so an attacker can't distinguish "no such user"
// from "wrong password" by timing (user-enumeration side-channel).
const DUMMY_HASH = "$2b$12$TZ9zPnhtOz/WAvIDdrKob.qMWVOqwphmEcCNZbi.S0XGT9yVDzZr6";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        // Always run a bcrypt compare (against a dummy hash when there's no
        // active user) so the response time is the same whether or not the
        // account exists — defeats user enumeration by timing.
        const hash = user && user.isActive ? user.passwordHash : DUMMY_HASH;
        const valid = await bcrypt.compare(password, hash);
        if (!user || !user.isActive || !valid) return null;

        // Transparently upgrade any legacy lower-cost hash (e.g. the cost-10
        // seed / bootstrap admin) to the current cost. This keeps real-login
        // timing matched to the cost-12 dummy hash and strengthens stored
        // hashes over time. A rehash failure must never block a valid login.
        try {
          if (bcrypt.getRounds(user.passwordHash) < BCRYPT_COST) {
            const upgraded = await bcrypt.hash(password, BCRYPT_COST);
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash: upgraded },
            });
          }
        } catch {
          /* ignore — login already validated */
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarColor: user.avatarColor,
        };
      },
    }),
  ],
});
