"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  History,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { ComplianceTodayProvider } from "@/components/compliance-date";

const nav = [
  ["Action Center", "/", LayoutDashboard],
  ["Overdue & Problems", "/work/overdue-towers", AlertTriangle],
  ["All Deadlines", "/deadlines", CalendarRange],
  ["Towers", "/towers", Building2],
  ["Samples", "/samples", FlaskConical],
  ["History", "/history", History],
  ["Customers", "/customers", Building2],
  ["Settings", "/admin", Settings],
] as const;
export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; role: UserRole };
}) {
  const pathname = usePathname();
  const visibleNav = nav.filter(
    ([name]) =>
      name !== "Settings" ||
      ["ADMIN", "OPERATIONS_MANAGER"].includes(user.role),
  );
  const breadcrumb = pathname.startsWith("/systems/")
    ? [
        ["Towers", "/towers"],
        ["Tower details", pathname],
      ]
    : pathname.startsWith("/customers/")
      ? [
          ["Customers", "/customers"],
          ["Customer details", pathname],
        ]
      : [];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[238px_1fr]">
      <aside className="bg-[#173f31] text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 lg:block lg:p-5">
          <Link href="/" className="flex items-center gap-3 text-xl font-black">
            <span className="grid size-10 place-items-center rounded-xl bg-[#d9ef61] text-[#173f31]">
              <Map size={22} />
            </span>
            TowerTrack
          </Link>
          <span className="hidden rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase lg:mt-4 lg:inline-flex">
            Fictional demo
          </span>
          <details className="group relative lg:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-white/20 bg-white/10 hover:bg-white/15">
              <Menu size={21} aria-hidden />
              <span className="sr-only">Open navigation</span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#173f31] p-2 shadow-2xl">
              <nav aria-label="Mobile navigation" className="space-y-1">
                {visibleNav.map(([name, href, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={
                      pathname === href ||
                      (href !== "/" && pathname.startsWith(href))
                        ? "page"
                        : undefined
                    }
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${pathname === href || (href !== "/" && pathname.startsWith(href)) ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  >
                    <Icon className="shrink-0" size={18} aria-hidden />
                    {name}
                  </Link>
                ))}
              </nav>
              <div className="mt-2 border-t border-white/10 p-3">
                <div className="text-sm font-bold">{user.name}</div>
                <div className="text-xs text-white/60">
                  {user.role.replaceAll("_", " ")}
                </div>
                <form action={logoutAction}>
                  <button className="mt-3 flex min-h-10 items-center gap-2 text-xs font-bold text-white/80">
                    <LogOut size={15} aria-hidden />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
        <nav
          aria-label="Primary navigation"
          className="hidden px-3 pb-3 lg:block lg:space-y-1"
        >
          {visibleNav.map(([name, href, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href || (href !== "/" && pathname.startsWith(href))
                  ? "page"
                  : undefined
              }
              className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${pathname === href || (href !== "/" && pathname.startsWith(href)) ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="shrink-0" size={18} aria-hidden />
              {name}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-5 lg:block">
          <div className="text-sm font-bold">{user.name}</div>
          <div className="text-xs text-white/60">
            {user.role.replaceAll("_", " ")}
          </div>
          <form action={logoutAction}>
            <button className="mt-3 flex items-center gap-2 text-xs font-bold text-white/70">
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <div className="mb-1 hidden text-xs font-black uppercase tracking-wide text-slate-600 sm:block">
              Find a tower
            </div>
            <GlobalSearch />
          </div>
          <ThemeToggle />
        </header>
        <ComplianceTodayProvider>
          {breadcrumb.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-bold text-slate-600 lg:px-8"
            >
              <Link href="/">Action Center</Link>
              {breadcrumb.map(([label, href]) => (
                <span key={label}>
                  {" "}
                  <span aria-hidden>›</span> <Link href={href}>{label}</Link>
                </span>
              ))}
            </nav>
          )}
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-8">
            {children}
          </div>
        </ComplianceTodayProvider>
      </main>
    </div>
  );
}
