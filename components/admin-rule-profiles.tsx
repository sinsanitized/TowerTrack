import { createCustomRuleProfileAction } from "@/app/actions";
import {
  AdminRuleProfileCard,
  type AdminRuleProfile,
} from "@/components/admin-rule-profile-card";
import { SubmitButton } from "@/components/submit-button";

export function AdminRuleProfiles({
  profiles,
  savedProfileId,
  savedRuleId,
  profileAction,
  ruleAction,
}: {
  profiles: AdminRuleProfile[];
  savedProfileId?: string;
  savedRuleId?: string;
  profileAction?: string;
  ruleAction?: string;
}) {
  const saved = {
    savedProfile: savedProfileId,
    savedRule: savedRuleId,
    profileAction,
    ruleAction,
  };
  return (
    <>
      <details className="panel mb-6 overflow-hidden">
        <summary className="cursor-pointer list-none p-5 font-black text-emerald-900">
          Advanced: create a custom or out-of-state rule profile
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
          {profiles.map((profile) => (
            <AdminRuleProfileCard
              key={profile.id}
              profile={profile}
              savedProfileId={saved.savedProfile}
              savedRuleId={saved.savedRule}
            />
          ))}
        </div>
        <aside className="space-y-5">
          <div className="panel p-5">
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
        </aside>
      </div>
    </>
  );
}
