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
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
