import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/brand/Mark";
import { WorkbenchNav, type NavItem } from "@/components/workbench/WorkbenchNav";
import { signOut } from "@/features/auth/actions";
import { currentUser } from "@/server/auth/current-user";
import { can, ROLE_LABEL } from "@/server/authorization/policies";

// The Government Workbench (brief §13): authenticated, dynamic, never cached or indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Workbench", template: "%s · Workbench" }, robots: { index: false, follow: false } };

export default async function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const actor = { id: user.id, roles: user.roles };

  const items: NavItem[] = [
    { href: "/workbench", label: "My office" },
    ...(can(actor, "interest.read") ? [{ href: "/workbench/interest", label: "Registrations of interest" }] : []),
    ...(can(actor, "users.read") ? [{ href: "/workbench/users", label: "Users" }] : []),
    ...(can(actor, "audit.read") ? [{ href: "/workbench/audit", label: "Audit log" }] : []),
    { href: "/workbench/account", label: "Account and security" },
  ];

  return (
    <div className="min-h-screen bg-parchment-50 text-ink-900 lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#workbench-main" className="fixed left-4 top-4 z-[60] -translate-y-24 bg-parchment-50 px-4 py-3 font-semibold text-navy-800 focus:translate-y-0">
        Skip to content
      </a>
      <aside className="sea flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center gap-3 px-5 py-5">
          <Mark size={24} />
          <span className="flex flex-col leading-none">
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-gold-400">Government of Aletheia</span>
            <span className="mt-1 text-[1rem] font-medium tracking-[0.06em]">Workbench</span>
          </span>
        </div>
        <div className="px-1 pb-3 lg:flex-1">
          <WorkbenchNav items={items} />
        </div>
        <div className="hidden border-t border-[var(--rule-sea)] px-5 py-5 lg:block">
          <p className="text-[0.9375rem] font-medium text-parchment-50">{user.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-parchment-300">{user.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</p>
          <form action={signOut} className="mt-4">
            <button type="submit" className="text-[0.875rem] font-semibold text-gold-300 hover:text-parchment-50">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule-ledger)] bg-parchment-100 px-6 py-2.5 text-[0.8125rem] text-ink-700 lg:px-10">
          {user.twoStep ? (
            <p>
              <span className="font-semibold text-[#2f6b3f]">Two-step sign-in is on</span> for your account.
            </p>
          ) : (
            <p>
              You sign in with a password only. You can turn on two-step sign-in at any time in{" "}
              <Link href="/workbench/account#two-step" className="link-ledger">
                Account and security
              </Link>
              .
            </p>
          )}
          <div className="flex items-center gap-4">
            <Link href="/" className="link-ledger">
              Public site
            </Link>
            <form action={signOut} className="lg:hidden">
              <button type="submit" className="font-semibold text-navy-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <main id="workbench-main" tabIndex={-1} className="px-6 py-10 outline-none lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
