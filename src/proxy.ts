import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users to the entry panel.
  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  // NOTE: we intentionally do NOT redirect logged-in users away from /login here.
  // The token-only edge check can't tell if the account still exists/is active;
  // that authoritative check (and any redirect to the app) happens on the login
  // page itself (DB-validated), which avoids a /login <-> / redirect loop when a
  // user's account has been deleted or disabled mid-session.
});

export const config = {
  // Run on everything except the auth API, the cron endpoints (which enforce
  // their own x-cron-secret and must NOT be redirected to /login), Next
  // internals, public brand assets, and static image files.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|brand|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico)).*)",
  ],
};
