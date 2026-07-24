import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

// Wraps every /admin page except /admin/login (a sibling outside this
// route group, so it never redirects itself into a loop). A route group
// rather than checking the session inside every page individually --
// one guard, not one per page.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
