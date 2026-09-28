import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import {
  createRuleDefinitionAction,
  createCustomRuleProfileAction,
  cloneSharedRuleProfileAction,
  createUserAction,
  setUserActiveAction,
  updateUserRoleAction,
  updateRuleDefinitionAction,
  updateRuleProfileAction,
} from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { plainEnumLabel } from "@/lib/labels";
import { nycRuleDisplayValues } from "@/lib/rule-profile";
import { UserRole } from "@prisma/client";
import { todayDateOnly } from "@/lib/date";
import { SubmitButton } from "@/components/submit-button";

const authorities = [
  "REGULATORY",
  "GUIDANCE",
  "COMPANY_POLICY",
  "CONTRACT_REQUIREMENT",
  "PENDING_REGULATION",
  "UNKNOWN_REQUIRES_REVIEW",
] as const;
const requirementTypes = [
  "ROUTINE_LEGIONELLA_SAMPLE",
  "ROUTINE_BACTERIOLOGICAL_SAMPLE",
  "COMPLIANCE_INSPECTION",
  "PORTAL_SAMPLE_DATE",
  "NYS_REGISTRY_REPORTING",
  "ANNUAL_CERTIFICATION",
  "SUMMERTIME_HYPERHALOGENATION",
  "ANNUAL_CLEANING",
  "STARTUP_CLEANING_DISINFECTION",
  "STARTUP_SAMPLE",
  "SHUTDOWN_REQUIREMENT",
  "POST_CLEANING_SAMPLE",
  "POST_DISINFECTION_SAMPLE",
  "CUSTOMER_RECURRING_EVENT",
  "COMPANY_POLICY_OBLIGATION",
] as const;
const customTriggerActivities = [
  "ROUTINE_LEGIONELLA_SAMPLE",
  "ROUTINE_BACTERIOLOGICAL_SAMPLE",
  "COMPLIANCE_INSPECTION",
  "ROUTINE_CLEANING",
  "CLEANING",
  "STARTUP_CLEANING",
  "CLEANING_AND_DISINFECTION",
  "DISINFECTION",
  "CORRECTIVE_DISINFECTION",
  "FULL_REMEDIATION",
  "SUMMERTIME_HYPERHALOGENATION",
  "STARTUP",
  "SHUTDOWN",
  "OTHER",
] as const;
const nycRuleDisplay = nycRuleDisplayValues();
const userRoles = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SCHEDULER,
  UserRole.TECHNICIAN,
  UserRole.READ_ONLY,
] as const;
const userActionMessages: Record<string, string> = {
  created: "User account created successfully.",
  role: "User role updated successfully.",
  disabled: "User account disabled successfully.",
  reactivated: "User account reactivated successfully.",
};

type RuleSummary = {
  requirementType: string;
  frequencyDays: number | null;
  minimumDaysAfterTrigger: number | null;
  maximumDaysAfterTrigger: number | null;
  appliesWhenOperating: boolean;
  appliesWhenPartiallyOperating: boolean;
  appliesWhenSeasonal: boolean;
  appliesWhenShutdown: boolean;
};

const obligationNames: Record<string, string> = {
  ROUTINE_LEGIONELLA_SAMPLE: "Routine Legionella culture sample",
  ROUTINE_BACTERIOLOGICAL_SAMPLE: "Routine bacteriological sample",
  COMPLIANCE_INSPECTION: "Compliance inspection",
  PORTAL_SAMPLE_DATE: "Sample-date portal reporting",
  SUMMERTIME_HYPERHALOGENATION: "Summertime hyperhalogenation",
  ANNUAL_CLEANING: "Twice-yearly cooling tower cleaning",
};

function authorityForProfile(mode: string) {
  if (mode === "PENDING_REGULATION") return "PENDING_REGULATION" as const;
  if (mode === "OUT_OF_STATE_COMPANY_POLICY") return "COMPANY_POLICY" as const;
  if (mode === "OUT_OF_STATE_GUIDANCE") return "GUIDANCE" as const;
  if (mode === "CUSTOM_JURISDICTION") return "UNKNOWN_REQUIRES_REVIEW" as const;
  return "REGULATORY" as const;
}

function obligationName(type: string) {
  return obligationNames[type] ?? plainEnumLabel(type);
}

function hardTiming(rule: RuleSummary) {
  if (
    rule.minimumDaysAfterTrigger != null &&
    rule.maximumDaysAfterTrigger != null
  )
    return `Day ${rule.minimumDaysAfterTrigger} through day ${rule.maximumDaysAfterTrigger} after the triggering event`;
  if (rule.frequencyDays != null) {
    if (rule.requirementType === "ROUTINE_LEGIONELLA_SAMPLE")
      return `No more than ${rule.frequencyDays} days between qualifying samples`;
    if (rule.requirementType === "COMPLIANCE_INSPECTION")
      return `At least once every ${rule.frequencyDays} days`;
    return `Due within ${rule.frequencyDays} days of the triggering event`;
  }
  if (rule.requirementType === "SUMMERTIME_HYPERHALOGENATION")
    return `Once each year between ${nycRuleDisplay.summertimeStart} and ${nycRuleDisplay.summertimeEnd}`;
  if (rule.requirementType === "ANNUAL_CLEANING")
    return "At least two completed cleanings per calendar year, including startup cleaning";
  return "No numeric deadline configured; review the rule details";
}

function sampleTiming(rule: RuleSummary, internalTargetDays: number | null) {
  if (rule.requirementType === "ROUTINE_LEGIONELLA_SAMPLE")
    return rule.frequencyDays == null
      ? "No verified Legionella sampling interval is configured."
      : `The compliance deadline is day ${rule.frequencyDays} after the last qualifying sample.${internalTargetDays ? ` The recommended service date is day ${internalTargetDays}.` : " No earlier recommended service date is set."}`;
  if (rule.requirementType === "SUMMERTIME_HYPERHALOGENATION") {
    const minimum =
      rule.minimumDaysAfterTrigger ?? nycRuleDisplay.hyperSampleMinimumDays;
    const maximum =
      rule.maximumDaysAfterTrigger ?? nycRuleDisplay.hyperSampleMaximumDays;
    return `Collect the associated Legionella culture sample from day ${minimum} through day ${maximum} after hyperhalogenation.`;
  }
  if (rule.requirementType === "COMPLIANCE_INSPECTION")
    return "The inspection does not create a separate Legionella sample. Combine it with routine sampling only when both actions may legally be performed on the same dates.";
  if (rule.requirementType === "PORTAL_SAMPLE_DATE")
    return "This reports a completed sample; it does not create another Legionella sample.";
  if (rule.requirementType === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return "This is a separate bacteriological monitoring requirement and does not replace the Legionella culture schedule.";
  if (rule.requirementType === "ANNUAL_CLEANING")
    return "Cleaning is separate from sampling. Startup sampling is valid only 3–14 days after startup; cleaning and routine sampling may share a completion date only when both are valid on that date.";
  if (
    rule.minimumDaysAfterTrigger != null &&
    rule.maximumDaysAfterTrigger != null
  )
    return `Collect the associated Legionella sample from day ${rule.minimumDaysAfterTrigger} through day ${rule.maximumDaysAfterTrigger} after the trigger.`;
  return "No separate Legionella sample is generated by this rule.";
}

function appliesWhen(rule: RuleSummary) {
  const states = [
    rule.appliesWhenOperating && "operating",
    rule.appliesWhenPartiallyOperating && "partially operating",
    rule.appliesWhenSeasonal && "seasonal",
    rule.appliesWhenShutdown && "shut down",
  ].filter(Boolean);
  return states.length ? states.join(", ") : "No operating state selected";
}

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
  }>;
}) {
  const user = await requireRole([UserRole.ADMIN]);
  const saved = await searchParams;
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
        description="Set the compliance interval and the earlier recommended service date, then review each requirement in plain English. Every save is audited and recalculates affected towers."
      />
      <nav
        className="panel mb-6 flex flex-wrap gap-2 p-3"
        aria-label="Settings sections"
      >
        <a className="btn btn-ghost min-h-10" href="#users">
          Users
        </a>
        <a className="btn btn-ghost min-h-10" href="#compliance-rules">
          Compliance rules
        </a>
        <a className="btn btn-ghost min-h-10" href="#data-exchange">
          Imports and exports
        </a>
      </nav>
      <details className="panel mb-6 overflow-hidden">
        <summary className="cursor-pointer list-none p-5 font-black text-emerald-900">
          Create custom or out-of-state profile
        </summary>
        <form
          action={createCustomRuleProfileAction}
          className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-2"
        >
          <label>
            <span className="label">Profile name</span>
            <input className="field mt-1" name="name" required />
          </label>
          <label>
            <span className="label">Effective date</span>
            <input
              className="field mt-1"
              name="effectiveDate"
              type="date"
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Description</span>
            <input
              className="field mt-1"
              name="description"
              defaultValue="Company or customer policy — verify all applicable local requirements"
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Reason</span>
            <input
              className="field mt-1"
              name="reason"
              defaultValue="Create reviewed custom compliance profile"
              required
            />
          </label>
          <p className="text-sm font-bold text-amber-900 sm:col-span-2">
            Safe default: the new profile starts with no enabled requirements
            and never inherits NYC rules.
          </p>
          <SubmitButton
            className="sm:col-span-2"
            pendingLabel="Creating custom profile…"
          >
            Create empty custom profile
          </SubmitButton>
        </form>
      </details>
      {(saved.savedProfile || saved.savedRule) && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          {saved.savedRule
            ? saved.ruleAction === "created"
              ? "Jurisdiction rule added and affected towers recalculated."
              : `Rule ${saved.savedRule} revised and affected towers recalculated.`
            : saved.profileAction === "cloned"
              ? "Organization-owned rule copy created, tower assignments updated, and deadlines recalculated."
              : `Routine timing for ${saved.savedProfile} updated and affected towers recalculated.`}
        </div>
      )}
      {saved.userSaved && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          {userActionMessages[saved.userAction ?? ""] ??
            "User account updated successfully."}
        </div>
      )}
      <section
        id="users"
        className="panel mb-6 p-5"
        aria-labelledby="user-management-title"
      >
        <div>
          <div className="label">Access control</div>
          <h2 id="user-management-title" className="mt-1 text-xl font-black">
            User management
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create accounts, assign permissions, and remove access. Every change
            is recorded in the audit log.
          </p>
        </div>

        <form
          action={createUserAction}
          className="mt-5 grid gap-4 lg:grid-cols-4"
        >
          <label>
            <span className="label">Full name</span>
            <input className="field mt-1" name="name" required minLength={2} />
          </label>
          <label>
            <span className="label">Email address</span>
            <input className="field mt-1" name="email" type="email" required />
          </label>
          <label>
            <span className="label">Initial password</span>
            <input
              className="field mt-1"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
            <span className="mt-1 block text-xs text-slate-500">
              At least 12 characters
            </span>
          </label>
          <label>
            <span className="label">Role</span>
            <select
              className="field mt-1"
              name="role"
              defaultValue={UserRole.TECHNICIAN}
            >
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {plainEnumLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end lg:col-span-4">
            <SubmitButton pendingLabel="Creating user…">
              Create user
            </SubmitButton>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((account) => (
                <tr
                  key={account.id}
                  className={!account.active ? "text-slate-500" : undefined}
                >
                  <td className="px-3 py-4">
                    <div className="font-bold text-slate-900">
                      {account.name}
                    </div>
                    <div>{account.email}</div>
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={
                        account.active
                          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800"
                          : "inline-flex rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-700"
                      }
                    >
                      {account.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <form
                      action={updateUserRoleAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={account.id} />
                      <select
                        className="field max-w-56"
                        name="role"
                        defaultValue={account.role}
                      >
                        {userRoles.map((role) => (
                          <option key={role} value={role}>
                            {plainEnumLabel(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn"
                        type="submit"
                        disabled={account.id === user.id}
                        title={
                          account.id === user.id
                            ? "Another administrator must change your role"
                            : undefined
                        }
                      >
                        Save role
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="userId" value={account.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={account.active ? "false" : "true"}
                      />
                      <button
                        className="btn"
                        type="submit"
                        disabled={account.id === user.id && account.active}
                        title={
                          account.id === user.id && account.active
                            ? "You cannot disable your own account"
                            : undefined
                        }
                      >
                        {account.active ? "Disable" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div
        id="compliance-rules"
        className="scroll-mt-6 grid gap-6 xl:grid-cols-[1fr_300px]"
      >
        <div className="space-y-5">
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="label text-amber-900">
              Advanced · Administrators only
            </div>
            <p className="mt-1 text-sm font-bold">
              Changing a verified rule recalculates affected tower deadlines.
              Open a profile only when you have the governing source in front of
              you.
            </p>
          </div>
          {profiles.map((profile) => {
            const routineRule = profile.rules.find(
              (rule) => rule.requirementType === "ROUTINE_LEGIONELLA_SAMPLE",
            );
            const hyperRule = profile.rules.find(
              (rule) => rule.requirementType === "SUMMERTIME_HYPERHALOGENATION",
            );
            const isNyc =
              profile.jurisdictionMode === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4";
            const hardInterval =
              routineRule?.frequencyDays ?? profile.legionellaIntervalDays;
            return (
              <details
                key={profile.id}
                className="panel overflow-hidden"
                open={
                  saved.savedProfile === profile.id ||
                  profile.rules.some((rule) => rule.id === saved.savedRule)
                }
              >
                <summary className="cursor-pointer list-none p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black">{profile.name}</h2>
                        <SourceBadge
                          authority={authorityForProfile(
                            profile.jurisdictionMode,
                          )}
                        />
                        {profile.organizationId == null && (
                          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                            Shared · read-only
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {profile.jurisdiction
                          ? [
                              profile.jurisdiction.city,
                              profile.jurisdiction.county,
                              profile.jurisdiction.state,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : plainEnumLabel(profile.jurisdictionMode)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-black">
                        {hardInterval
                          ? `${hardInterval}-day hard interval`
                          : "Hard interval needs review"}
                      </div>
                      <div className="mt-1 font-bold text-slate-600">
                        {profile.internalTargetIntervalDays
                          ? `${profile.internalTargetIntervalDays}-day internal target`
                          : "No internal target set"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {profile._count.systems} towers · {profile._count.rules}{" "}
                        requirement rules
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="space-y-5 border-t border-slate-200 p-5">
                  {profile.organizationId == null && (
                    <section className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 text-blue-950">
                      <div className="label text-blue-900">
                        Protected regulatory baseline
                      </div>
                      <h3 className="mt-1 text-lg font-black">
                        Create your organization copy before making changes
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm">
                        This shared profile cannot be edited. Creating a copy
                        preserves the baseline, moves only your organization’s
                        towers to the copy, records an effective-dated
                        assignment, recalculates deadlines, and writes an audit
                        record.
                      </p>
                      <form
                        action={cloneSharedRuleProfileAction}
                        className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                      >
                        <input
                          type="hidden"
                          name="profileId"
                          value={profile.id}
                        />
                        <label>
                          <span className="label">
                            Reason for customization
                          </span>
                          <input
                            className="field mt-1"
                            name="reason"
                            minLength={8}
                            defaultValue="Create organization-owned rule revision"
                            required
                          />
                        </label>
                        <SubmitButton pendingLabel="Creating organization copy…">
                          Create editable copy
                        </SubmitButton>
                      </form>
                    </section>
                  )}
                  <fieldset
                    className="contents disabled:opacity-60"
                    disabled={profile.organizationId == null}
                  >
                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="label">Routine Legionella timing</div>
                      <h3 className="mt-1 text-lg font-black">
                        Compliance deadline and recommended service date
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        The hard interval is the maximum permitted gap between
                        qualifying samples. The internal target should be
                        earlier so a late or missed completion does not
                        immediately create a compliance risk.
                      </p>
                      <form
                        action={updateRuleProfileAction}
                        className="mt-4 grid gap-4 sm:grid-cols-2"
                      >
                        <input
                          type="hidden"
                          name="profileId"
                          value={profile.id}
                        />
                        <label>
                          <span className="label">Hard interval (days)</span>
                          <input
                            className="field mt-1"
                            name="hardIntervalDays"
                            type="number"
                            min="1"
                            max="3650"
                            defaultValue={hardInterval ?? undefined}
                            placeholder="Needs verified rule"
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            Legal latest: day {hardInterval ?? "not set"} after
                            the last qualifying sample
                          </span>
                        </label>
                        <label>
                          <span className="label">
                            Internal target interval (days)
                          </span>
                          <input
                            className="field mt-1"
                            name="internalTargetIntervalDays"
                            type="number"
                            min="1"
                            max="3650"
                            defaultValue={
                              profile.internalTargetIntervalDays ?? undefined
                            }
                            placeholder="Optional earlier target"
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            Operational goal; this never replaces the hard
                            deadline
                          </span>
                        </label>
                        <label className="sm:col-span-2">
                          <span className="label">
                            Reason for timing change
                          </span>
                          <input
                            className="field mt-1"
                            name="reason"
                            minLength={8}
                            defaultValue="Update verified Legionella timing rule"
                            required
                          />
                        </label>
                        <div className="sm:col-span-2">
                          <SubmitButton pendingLabel="Saving routine timing…">
                            Save routine timing
                          </SubmitButton>
                        </div>
                      </form>
                    </section>

                    {isNyc && (
                      <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <div className="label">
                          Legionella sample date ranges
                        </div>
                        <h3 className="mt-1 text-lg font-black">
                          Records that create a sampling requirement
                        </h3>
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[620px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-sky-200 text-xs uppercase tracking-wide text-slate-500">
                                <th className="pb-2 pr-4">Trigger</th>
                                <th className="pb-2 pr-4">
                                  Legionella sample range
                                </th>
                                <th className="pb-2">What the rule means</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-200">
                              <tr>
                                <th className="py-3 pr-4">Routine operation</th>
                                <td className="py-3 pr-4 font-bold">
                                  No later than day {hardInterval ?? "not set"}
                                </td>
                                <td className="py-3">
                                  Measured from the last qualifying culture
                                  sample
                                </td>
                              </tr>
                              <tr>
                                <th className="py-3 pr-4">Tower startup</th>
                                <td className="py-3 pr-4 font-bold">
                                  Day {nycRuleDisplay.startupSampleMinimumDays}–
                                  {nycRuleDisplay.startupSampleMaximumDays}
                                </td>
                                <td className="py-3">
                                  Measured from startup, not from the cleaning
                                  date
                                </td>
                              </tr>
                              <tr>
                                <th className="py-3 pr-4">
                                  Summertime hyperhalogenation
                                </th>
                                <td className="py-3 pr-4 font-bold">
                                  Day{" "}
                                  {hyperRule?.minimumDaysAfterTrigger ??
                                    nycRuleDisplay.hyperSampleMinimumDays}
                                  –
                                  {hyperRule?.maximumDaysAfterTrigger ??
                                    nycRuleDisplay.hyperSampleMaximumDays}
                                </td>
                                <td className="py-3">
                                  Measured from completed hyperhalogenation
                                </td>
                              </tr>
                              <tr>
                                <th className="py-3 pr-4">
                                  Legionella Level 2, 3, or 4 result
                                </th>
                                <td className="py-3 pr-4 font-bold">
                                  Retest day {nycRuleDisplay.retestMinimumDays}–
                                  {nycRuleDisplay.retestMaximumDays}
                                </td>
                                <td className="py-3">
                                  Continue the retest chain until a Level 1
                                  result
                                </td>
                              </tr>
                              <tr>
                                <th className="py-3 pr-4">
                                  Emergency condition
                                </th>
                                <td className="py-3 pr-4 font-bold">
                                  Collect immediately
                                </td>
                                <td className="py-3">
                                  No invented fixed legal date range
                                </td>
                              </tr>
                              <tr>
                                <th className="py-3 pr-4">
                                  Twice-yearly cleaning or inspection
                                </th>
                                <td className="py-3 pr-4 font-bold">
                                  No separate sample
                                </td>
                                <td className="py-3">
                                  Bundle with a routine sample only when its
                                  window is open
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    <section>
                      <div className="label">Requirement rules</div>
                      <h3 className="mt-1 text-lg font-black">
                        What is required and when
                      </h3>
                      {requirementTypes.some(
                        (type) =>
                          !profile.rules.some(
                            (rule) => rule.requirementType === type,
                          ),
                      ) && (
                        <details className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50">
                          <summary className="cursor-pointer list-none p-4 font-black text-emerald-900">
                            Add jurisdiction rule · Advanced
                          </summary>
                          <div className="border-t border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700">
                            Use a hard interval for repeating work (for example,
                            31 means no later than 31 days). Use minimum and
                            maximum days together for a window after a trigger
                            (for example, 3–7 means day 3 through day 7).
                          </div>
                          <form
                            action={createRuleDefinitionAction}
                            className="grid gap-4 border-t border-emerald-200 p-4 sm:grid-cols-2 xl:grid-cols-3"
                          >
                            <input
                              type="hidden"
                              name="profileId"
                              value={profile.id}
                            />
                            <label>
                              <span className="label">Requirement type</span>
                              <select
                                className="field mt-1"
                                name="requirementType"
                                required
                              >
                                {requirementTypes
                                  .filter(
                                    (type) =>
                                      !profile.rules.some(
                                        (rule) => rule.requirementType === type,
                                      ),
                                  )
                                  .map((type) => (
                                    <option key={type} value={type}>
                                      {obligationName(type)}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label className="sm:col-span-1 xl:col-span-2">
                              <span className="label">Rule name</span>
                              <input
                                className="field mt-1"
                                name="ruleName"
                                minLength={3}
                                required
                              />
                            </label>
                            {profile.jurisdictionMode ===
                              "CUSTOM_JURISDICTION" && (
                              <label>
                                <span className="label">Trigger activity</span>
                                <select
                                  className="field mt-1"
                                  name="triggerActivityType"
                                  defaultValue=""
                                >
                                  <option value="">
                                    Not created by a record
                                  </option>
                                  {customTriggerActivities.map((activity) => (
                                    <option key={activity} value={activity}>
                                      {plainEnumLabel(activity)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <label>
                              <span className="label">Authority</span>
                              <select
                                className="field mt-1"
                                name="sourceAuthority"
                                defaultValue={
                                  profile.jurisdictionMode ===
                                  "CUSTOM_JURISDICTION"
                                    ? "COMPANY_POLICY"
                                    : undefined
                                }
                                required
                              >
                                {authorities.map((authority) => (
                                  <option key={authority} value={authority}>
                                    {plainEnumLabel(authority)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="sm:col-span-1 xl:col-span-2">
                              <span className="label">Source citation</span>
                              <input
                                className="field mt-1"
                                name="sourceCitation"
                                minLength={3}
                                required
                              />
                            </label>
                            <label>
                              <span className="label">
                                Hard interval (days)
                              </span>
                              <input
                                className="field mt-1"
                                name="frequencyDays"
                                type="number"
                                min="1"
                                max="3650"
                              />
                              <span className="mt-1 block text-xs text-slate-600">
                                Required for recurring sample, inspection, and
                                reporting rules
                              </span>
                            </label>
                            <label>
                              <span className="label">
                                Minimum days after trigger
                              </span>
                              <input
                                className="field mt-1"
                                name="minimumDaysAfterTrigger"
                                type="number"
                                min="0"
                                max="3650"
                              />
                            </label>
                            <label>
                              <span className="label">
                                Maximum days after trigger
                              </span>
                              <input
                                className="field mt-1"
                                name="maximumDaysAfterTrigger"
                                type="number"
                                min="0"
                                max="3650"
                              />
                              <span className="mt-1 block text-xs text-slate-600">
                                Both trigger offsets are required for
                                hyperhalogenation rules
                              </span>
                            </label>
                            <label className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm font-bold">
                              <input
                                name="enabled"
                                type="checkbox"
                                defaultChecked
                              />
                              Enable immediately
                            </label>
                            <label className="sm:col-span-2 xl:col-span-3">
                              <span className="label">Notes</span>
                              <textarea
                                className="field mt-1 min-h-20"
                                name="notes"
                              />
                            </label>
                            <label className="sm:col-span-2 xl:col-span-3">
                              <span className="label">
                                Reason for adding rule
                              </span>
                              <input
                                className="field mt-1"
                                name="reason"
                                minLength={8}
                                defaultValue="Add rule from verified source"
                                required
                              />
                            </label>
                            <div className="sm:col-span-2 xl:col-span-3">
                              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                                Final check: verify the authority, citation, and
                                timing above. Saving adds the rule immediately
                                and recalculates affected towers.
                              </div>
                              <SubmitButton pendingLabel="Adding rule…">
                                Add rule and recalculate towers
                              </SubmitButton>
                            </div>
                          </form>
                        </details>
                      )}
                      <div className="mt-3 space-y-4">
                        {profile.rules.map((rule) => (
                          <article
                            key={rule.id}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-black">
                                  {obligationName(rule.requirementType)}
                                </h4>
                                <p className="mt-1 text-sm text-slate-600">
                                  {rule.ruleName}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <SourceBadge authority={rule.sourceAuthority} />
                                <span className="text-sm font-bold">
                                  {rule.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </div>
                            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                              <div className="rounded-lg bg-slate-50 p-3">
                                <dt className="label">Hard timing rule</dt>
                                <dd className="mt-1 font-bold">
                                  {hardTiming(rule)}
                                </dd>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
                                <dt className="label">
                                  Associated Legionella sample
                                </dt>
                                <dd className="mt-1 font-bold">
                                  {sampleTiming(
                                    rule,
                                    profile.internalTargetIntervalDays,
                                  )}
                                </dd>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-3">
                                <dt className="label">Applies while</dt>
                                <dd className="mt-1 font-bold">
                                  {appliesWhen(rule)}
                                </dd>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
                                <dt className="label">Source</dt>
                                <dd className="mt-1 font-bold">
                                  {rule.sourceCitation}
                                </dd>
                              </div>
                            </dl>

                            <details
                              className="mt-4 rounded-lg border border-slate-200"
                              open={saved.savedRule === rule.id}
                            >
                              <summary className="cursor-pointer list-none p-3 text-sm font-black text-emerald-800">
                                Edit rule details · Revision {rule.revision}
                              </summary>
                              <form
                                action={updateRuleDefinitionAction}
                                className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-3"
                              >
                                <input
                                  type="hidden"
                                  name="ruleId"
                                  value={rule.id}
                                />
                                {profile.jurisdictionMode ===
                                  "CUSTOM_JURISDICTION" &&
                                  profile._count.systems > 0 && (
                                    <label>
                                      <span className="label">
                                        New version effective date
                                      </span>
                                      <input
                                        className="field mt-1"
                                        name="effectiveDate"
                                        type="date"
                                        defaultValue={todayDateOnly()}
                                        required
                                      />
                                    </label>
                                  )}
                                <label className="sm:col-span-2 xl:col-span-2">
                                  <span className="label">Rule name</span>
                                  <input
                                    className="field mt-1"
                                    name="ruleName"
                                    defaultValue={rule.ruleName}
                                    required
                                  />
                                </label>
                                <label>
                                  <span className="label">Authority</span>
                                  <select
                                    className="field mt-1"
                                    name="sourceAuthority"
                                    defaultValue={rule.sourceAuthority}
                                    required
                                  >
                                    {authorities.map((authority) => (
                                      <option key={authority} value={authority}>
                                        {plainEnumLabel(authority)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="sm:col-span-2 xl:col-span-3">
                                  <span className="label">Source citation</span>
                                  <input
                                    className="field mt-1"
                                    name="sourceCitation"
                                    defaultValue={rule.sourceCitation}
                                    required
                                  />
                                </label>
                                {[
                                  "ROUTINE_LEGIONELLA_SAMPLE",
                                  "ROUTINE_BACTERIOLOGICAL_SAMPLE",
                                  "PORTAL_SAMPLE_DATE",
                                  "NYS_REGISTRY_REPORTING",
                                  "COMPLIANCE_INSPECTION",
                                ].includes(rule.requirementType) && (
                                  <label>
                                    <span className="label">
                                      Hard interval (days)
                                    </span>
                                    <input
                                      className="field mt-1"
                                      name="frequencyDays"
                                      type="number"
                                      min="0"
                                      max="3650"
                                      defaultValue={
                                        rule.frequencyDays ?? undefined
                                      }
                                    />
                                  </label>
                                )}
                                {rule.requirementType ===
                                  "SUMMERTIME_HYPERHALOGENATION" && (
                                  <>
                                    <label>
                                      <span className="label">
                                        Minimum days after trigger before
                                        sampling
                                      </span>
                                      <input
                                        className="field mt-1"
                                        name="minimumDaysAfterTrigger"
                                        type="number"
                                        min="0"
                                        max="3650"
                                        defaultValue={
                                          rule.minimumDaysAfterTrigger ??
                                          undefined
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span className="label">
                                        Maximum days after trigger to collect
                                        sample
                                      </span>
                                      <input
                                        className="field mt-1"
                                        name="maximumDaysAfterTrigger"
                                        type="number"
                                        min="0"
                                        max="3650"
                                        defaultValue={
                                          rule.maximumDaysAfterTrigger ??
                                          undefined
                                        }
                                      />
                                    </label>
                                  </>
                                )}
                                <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2 xl:col-span-2">
                                  <div className="label">Operating scope</div>
                                  <div className="mt-1 font-bold">
                                    {appliesWhen(rule)}
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Scope is displayed for audit clarity; only
                                    rule timing supported by TowerTrack is
                                    editable here.
                                  </p>
                                </div>
                                <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold">
                                  <input
                                    name="enabled"
                                    type="checkbox"
                                    defaultChecked={rule.enabled}
                                  />
                                  Enabled
                                </label>
                                <label className="sm:col-span-2 xl:col-span-3">
                                  <span className="label">Notes</span>
                                  <textarea
                                    className="field mt-1 min-h-20"
                                    name="notes"
                                    defaultValue={rule.notes || ""}
                                  />
                                </label>
                                <label className="sm:col-span-2 xl:col-span-3">
                                  <span className="label">
                                    Reason for revision
                                  </span>
                                  <input
                                    className="field mt-1"
                                    name="reason"
                                    minLength={8}
                                    defaultValue="Update rule from verified source"
                                    required
                                  />
                                </label>
                                <div className="sm:col-span-2 xl:col-span-3">
                                  <SubmitButton pendingLabel="Saving rule revision…">
                                    Save as revision {rule.revision + 1}
                                  </SubmitButton>
                                </div>
                              </form>
                            </details>
                          </article>
                        ))}
                      </div>
                    </section>
                  </fieldset>
                </div>
              </details>
            );
          })}
        </div>
        <aside className="space-y-5">
          <div id="data-exchange" className="panel scroll-mt-6 p-5">
            <h2 className="font-black">Before changing a rule</h2>
            <p className="mt-2 text-sm text-slate-600">
              Verify the legal or policy source. Saving changes recalculates
              current requirements for every tower using that jurisdiction.
            </p>
            <p className="mt-3 text-sm font-bold text-amber-900">
              The internal target is operational guidance. It never extends the
              hard compliance deadline.
            </p>
            <p className="mt-3 text-sm font-bold text-amber-900">
              NYC is never made the global default by this screen.
            </p>
          </div>
          <div className="panel p-5">
            <h2 className="font-black">CSV data exchange</h2>
            <p className="mt-2 text-sm text-slate-600">
              Preview and validate imports before commit. Imported dates are
              labeled Imported CSV.
            </p>
            <div className="mt-4 grid gap-2">
              <a className="btn btn-primary" href="/api/export/planning">
                <Download size={17} />
                Export compliance queue
              </a>
              <a className="btn" href="/templates/systems-import.csv">
                <Download size={17} />
                Download template
              </a>
              <Link className="btn" href="/admin/legacy-import">
                <Upload size={17} />
                Import legacy Excel workbook
              </Link>
              <label className="btn cursor-not-allowed opacity-60">
                <Upload size={17} />
                Import preview (admin)
              </label>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
