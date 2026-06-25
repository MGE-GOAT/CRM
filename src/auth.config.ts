import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe auth config (no Node-only deps like bcrypt/prisma).
 * Shared between middleware and the full server-side auth instance.
 */
export const authConfig = {
  // 8-hour sessions limit the blast radius of a stolen token. Role/active-status
  // changes are enforced immediately server-side via requireUser() (see rbac.ts).
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  // Trust X-Forwarded-Host only when explicitly enabled (behind a trusted proxy).
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // role/avatarColor attached by the credentials authorize()
        if (user.role) token.role = user.role;
        if (user.avatarColor) token.avatarColor = user.avatarColor;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.avatarColor = token.avatarColor as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
