/**
 * Map a notification's href to the nav section it belongs under (Slack-style
 * per-section badges). Pure + isomorphic so both the client provider and the
 * API route agree on section membership.
 */
export function navKeyFor(href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/chat")) return "/chat";
  if (href.startsWith("/factors/sent")) return "/factors/sent";
  if (href.startsWith("/factors")) return "/factors";
  if (href.startsWith("/tasks")) return "/tasks";
  if (href.startsWith("/calendar")) return "/calendar";
  if (href.startsWith("/contacts")) return "/contacts";
  if (href.startsWith("/companies")) return "/companies";
  if (href.startsWith("/settings")) return "/settings/users";
  if (href === "/" || href.startsWith("/reports")) return "/";
  return null;
}
