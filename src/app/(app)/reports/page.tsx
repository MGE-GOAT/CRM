import { redirect } from "next/navigation";

/**
 * Reports were merged into the dashboard (one single report page). Keep this
 * route as a permanent redirect so old links/bookmarks still land correctly.
 */
export default function ReportsPage() {
  redirect("/");
}
