import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AdminUserManagement } from "@/components/admin-user-management";
import { AdminRuleProfiles } from "@/components/admin-rule-profiles";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

const userActionMessages: Record<string, string> = {
  created: "User account created successfully.",
  role: "User role updated successfully.",
  disabled: "User account disabled successfully.",
  reactivated: "User account reactivated successfully.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    savedProfile?: string;
    profileAction?: string;
    savedRule?: string;
    ruleAction?: string;
    userSaved?: string;
    userAction?: string;
    section?: string;
  }>;
}) {
  const user = await requireRole([UserRole.ADMIN]);
  const saved = await searchParams;
  const settingsSection =
    saved.savedProfile || saved.savedRule
      ? "rules"
      : saved.userSaved
        ? "users"
        : saved.section === "rules" || saved.section === "data"
          ? saved.section
          : "users";
  const [profiles, users] = await Promise.all([
    db.ruleProfile.findMany({
      where: {
        OR: [
          { organizationId: user.organizationId },
          {
            systems: {
              some: {
                building: { customer: { organizationId: user.organizationId } },
              },
            },
          },
        ],
      },
      include: {
        jurisdiction: true,
        rules: { orderBy: [{ requirementType: "asc" }, { ruleName: "asc" }] },
        _count: {
          select: {
            systems: {
              where: {
                building: { customer: { organizationId: user.organizationId } },
              },
            },
            rules: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Manage users, compliance rules, and data tools."
      />
      <nav
        className="panel mb-6 flex flex-wrap gap-2 p-3"
        aria-label="Settings sections"
      >
        <Link
          className={`btn min-h-10 ${settingsSection === "users" ? "btn-primary" : "btn-ghost"}`}
          href="/admin?section=users"
          aria-current={settingsSection === "users" ? "page" : undefined}
        >
          Users
        </Link>
        <Link
          className={`btn min-h-10 ${settingsSection === "rules" ? "btn-primary" : "btn-ghost"}`}
          href="/admin?section=rules"
          aria-current={settingsSection === "rules" ? "page" : undefined}
        >
          Compliance rules
        </Link>
        <Link
          className={`btn min-h-10 ${settingsSection === "data" ? "btn-primary" : "btn-ghost"}`}
          href="/admin?section=data"
          aria-current={settingsSection === "data" ? "page" : undefined}
        >
          Data tools
        </Link>
      </nav>
      {saved.userSaved && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          {userActionMessages[saved.userAction ?? ""] ??
            "User account updated successfully."}
        </div>
      )}
      {settingsSection === "users" && (
        <AdminUserManagement
          users={users}
          currentUserId={user.id}
          savedUserId={saved.userSaved}
        />
      )}
      {settingsSection === "rules" && (
        <AdminRuleProfiles
          profiles={profiles}
          savedProfileId={saved.savedProfile}
          savedRuleId={saved.savedRule}
          profileAction={saved.profileAction}
          ruleAction={saved.ruleAction}
        />
      )}
      {settingsSection === "data" && (
        <section className="panel mx-auto max-w-3xl p-5">
          <div className="label">Imports and exports</div>
          <h2 className="mt-1 text-xl font-black">Data tools</h2>
          <p className="mt-2 text-sm text-slate-600">
            Export current work or carefully import historical information.
            Imports are reviewed before they change TowerTrack.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a className="btn btn-primary" href="/api/export/planning">
              <Download size={17} />
              Export compliance queue
            </a>
            <a className="btn" href="/templates/systems-import.csv">
              <Download size={17} />
              Download CSV template
            </a>
            <Link className="btn sm:col-span-2" href="/admin/legacy-import">
              <Upload size={17} />
              Review a legacy Excel import
            </Link>
          </div>
          <details className="mt-5 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-black text-slate-800">
              Before importing data
            </summary>
            <p className="mt-3 text-sm text-slate-600">
              Preview and validate every row before confirming an import.
              Imported dates remain labeled so they cannot be confused with
              newly verified field records.
            </p>
          </details>
        </section>
      )}
    </>
  );
}
