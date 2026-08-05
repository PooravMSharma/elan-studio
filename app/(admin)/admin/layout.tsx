import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import "../../admin.css";

const NAV = [
  { href: "/admin", label: "Today" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/staff", label: "Team" },
  { href: "/admin/customers", label: "Customers" },
];

export const metadata = { title: "Élan Studio · Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) return <>{children}</>;

  const tenant = await getTenant();

  return (
    <div className="admin">
      <aside className="admin__rail">
        <div className="admin__brand">
          <span className="admin__mark">{tenant.name}</span>
          <span className="admin__sub">Admin</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button type="submit" className="admin__signout">
            Sign out — {session.user.name}
          </button>
        </form>
      </aside>
      <main className="admin__main">{children}</main>
    </div>
  );
}