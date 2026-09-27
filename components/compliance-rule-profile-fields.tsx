"use client";

import { useMemo, useState } from "react";
import type { TowerRuleConfiguration } from "@prisma/client";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationForJurisdiction,
} from "@/lib/tower-rule-configuration";

type ProfileChoice = {
  id: string;
  name: string;
  jurisdictionMode: string;
  jurisdictionId?: string | null;
  description?: string;
};

type JurisdictionChoice = {
  id: string;
  label: string;
  state: string;
  city?: string | null;
};

function preferredProfile(
  jurisdiction: JurisdictionChoice,
  profiles: ProfileChoice[],
) {
  const configuration = towerRuleConfigurationForJurisdiction(jurisdiction);
  const compatible = profiles.filter((profile) =>
    profileMatchesTowerConfiguration(configuration, profile.jurisdictionMode),
  );
  if (configuration === "NYC_AND_NYS" || configuration === "NYS_ONLY")
    return (
      compatible.find((profile) => profile.jurisdictionId === jurisdiction.id)
        ?.id ??
      compatible[0]?.id ??
      ""
    );
  if (jurisdiction.state === "NJ")
    return (
      compatible.find(
        (profile) =>
          profile.jurisdictionMode === "PENDING_REGULATION" &&
          (profile.jurisdictionId === jurisdiction.id ||
            profile.jurisdictionId == null),
      )?.id ?? ""
    );
  return (
    compatible.find(
      (profile) => profile.jurisdictionMode === "OUT_OF_STATE_COMPANY_POLICY",
    )?.id ??
    compatible.find((profile) => profile.jurisdictionId === jurisdiction.id)
      ?.id ??
    ""
  );
}

export function ComplianceRuleProfileFields({
  profiles,
  jurisdictions,
  initialConfiguration,
  initialProfileId = "",
  initialJurisdictionId = "",
}: {
  profiles: ProfileChoice[];
  jurisdictions: JurisdictionChoice[];
  initialConfiguration?: TowerRuleConfiguration;
  initialProfileId?: string;
  initialJurisdictionId?: string;
  legend?: string;
}) {
  const [jurisdictionId, setJurisdictionId] = useState(initialJurisdictionId);
  const selectedJurisdiction = jurisdictions.find(
    (item) => item.id === jurisdictionId,
  );
  const configuration = selectedJurisdiction
    ? towerRuleConfigurationForJurisdiction(selectedJurisdiction)
    : (initialConfiguration ?? "");
  const [profileId, setProfileId] = useState(initialProfileId);
  const compatibleProfiles = useMemo(
    () =>
      configuration
        ? profiles.filter((profile) =>
            profileMatchesTowerConfiguration(
              configuration,
              profile.jurisdictionMode,
            ),
          )
        : [],
    [configuration, profiles],
  );
  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  const isNyc = configuration === "NYC_AND_NYS";
  const isNys = configuration === "NYS_ONLY";
  const isNewJersey = selectedJurisdiction?.state === "NJ";

  function selectJurisdiction(nextId: string) {
    setJurisdictionId(nextId);
    const jurisdiction = jurisdictions.find((item) => item.id === nextId);
    setProfileId(jurisdiction ? preferredProfile(jurisdiction, profiles) : "");
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <label className="block max-w-xl">
        <span className="label">1. Tower jurisdiction · Required</span>
        <select
          className="field mt-1"
          name="jurisdictionId"
          value={jurisdictionId}
          onChange={(event) => selectJurisdiction(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose the tower location
          </option>
          {jurisdictions.map((jurisdiction) => (
            <option key={jurisdiction.id} value={jurisdiction.id}>
              {jurisdiction.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm text-slate-600">
          TowerTrack uses this location to determine the regulatory program.
        </span>
      </label>

      <input type="hidden" name="ruleConfiguration" value={configuration} />
      <input type="hidden" name="ruleProfileId" value={profileId} />

      {selectedJurisdiction ? (
        <section
          className={`rounded-xl border-2 p-4 ${
            isNewJersey
              ? "border-purple-300 bg-purple-50 text-purple-950"
              : isNyc || isNys
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-blue-300 bg-blue-50 text-blue-950"
          }`}
          aria-live="polite"
        >
          <div className="label">2. Applicable program</div>
          <h3 className="mt-1 text-lg font-black">
            {isNyc
              ? "New York City regulatory program"
              : isNys
                ? "New York State regulatory program"
                : isNewJersey
                  ? "New Jersey regulation monitoring"
                  : "Out-of-state operational program"}
          </h3>
          <p className="mt-2 text-sm font-bold">
            {isNyc
              ? "NYC Chapter 8 and NYS Part 4 apply."
              : isNys
                ? "NYS Part 4 applies. NYC Chapter 8 does not apply."
                : isNewJersey
                  ? "No verified active New Jersey cooling-tower rule is configured. TowerTrack will monitor the pending regulation and will not generate legal deadlines from it."
                  : "No state regulation is being claimed. TowerTrack will use the selected company or customer operational policy."}
          </p>
          {selectedProfile ? (
            <p className="mt-2 text-sm">
              <span className="font-black">Using:</span> {selectedProfile.name}
              {selectedProfile.description
                ? ` — ${selectedProfile.description}`
                : ""}
            </p>
          ) : (
            <p className="mt-2 font-black text-red-800">
              No compatible verified profile is available. An administrator must
              configure one before this tower can be saved.
            </p>
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Choose the tower jurisdiction to see the applicable program.
        </div>
      )}

      {selectedJurisdiction &&
        !isNewJersey &&
        compatibleProfiles.length > 1 && (
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-black text-emerald-900">
              Advanced administrator option · Profile revision
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              Change this only when an authorized administrator has verified a
              different effective profile for the selected jurisdiction.
            </p>
            <label className="mt-3 block max-w-xl">
              <span className="label">Profile revision</span>
              <select
                className="field mt-1"
                aria-label="Profile revision"
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
              >
                {compatibleProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </details>
        )}
    </div>
  );
}
