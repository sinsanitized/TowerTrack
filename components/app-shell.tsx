import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  History,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Map,
  Settings,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { ComplianceTodayProvider } from "@/components/compliance-date";

const nav = [
  ["Action Center", "/", LayoutDashboard],
  ["Compliance Issues", "/work/overdue-towers", AlertTriangle],
  ["All Tower Deadlines", "/deadlines", CalendarRange],
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
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[238px_1fr]">
      <aside className="bg-[#173f31] text-white lg:min-h-screen">
        <div className="flex items-center justify-between p-5 lg:block">
          <Link href="/" className="flex items-center gap-3 text-xl font-black">
            <span className="grid size-10 place-items-center rounded-xl bg-[#d9ef61] text-[#173f31]">
              <Map size={22} />
            </span>
            TowerTrack
          </Link>
          <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase">
            Fictional demo
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1">
          {nav.map(([name, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Icon size={18} />
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
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <GlobalSearch />
          <ThemeToggle />
        </header>
        <ComplianceTodayProvider>
          <div className="p-5 lg:p-8">{children}</div>
        </ComplianceTodayProvider>
      </main>
    </div>
  );
}
