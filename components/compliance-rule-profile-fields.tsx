"use client";

import { useState } from "react";
import type { TowerRuleConfiguration } from "@prisma/client";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationLabel,
} from "@/lib/tower-rule-configuration";

const configurations: Array<{
  value: TowerRuleConfiguration;
  label: string;
  description: string;
}> = [
  {
    value: "NYC_AND_NYS",
    label: "NYC Chapter 8 and NYS Part 4",
    description: "Both New York City and state requirements apply.",
  },
  {
    value: "NYS_ONLY",
    label: "NYS Part 4 only",
    description: "Only New York State requirements apply.",
  },
  {
    value: "CUSTOM",
    label: "Custom or out-of-state",
    description: "Use a verified custom profile for another jurisdiction.",
  },
];

type ProfileChoice = {
  id: string;
  name: string;
  jurisdictionMode: string;
};

export function ComplianceRuleProfileFields({
  profiles,
  initialConfiguration,
  initialProfileId = "",
  legend = "Compliance rules · Required",
}: {
  profiles: ProfileChoice[];
  initialConfiguration?: TowerRuleConfiguration;
  initialProfileId?: string;
  legend?: string;
}) {
  const [configuration, setConfiguration] = useState<
    TowerRuleConfiguration | ""
  >(initialConfiguration ?? "");
  const initialProfileIsCompatible = profiles.some(
    (profile) =>
      profile.id === initialProfileId &&
      initialConfiguration &&
      profileMatchesTowerConfiguration(
        initialConfiguration,
        profile.jurisdictionMode,
      ),
  );
  const [profileId, setProfileId] = useState(
    initialProfileIsCompatible ? initialProfileId : "",
  );
  const compatibleProfiles = configuration
    ? profiles.filter((profile) =>
        profileMatchesTowerConfiguration(
          configuration,
          profile.jurisdictionMode,
        ),
      )
    : [];
  const selectedProfile = compatibleProfiles.find(
    (profile) => profile.id === profileId,
  );

  function selectConfiguration(value: TowerRuleConfiguration) {
    setConfiguration(value);
    const currentStillMatches = profiles.some(
      (profile) =>
        profile.id === profileId &&
        profileMatchesTowerConfiguration(value, profile.jurisdictionMode),
    );
    if (!currentStillMatches) setProfileId("");
  }

  return (
    <>
      <fieldset className="sm:col-span-2">
        <legend className="label">{legend}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {configurations.map((choice) => (
            <label
              key={choice.value}
              className={`cursor-pointer rounded-xl border-2 p-4 ${
                configuration === choice.value
                  ? "border-emerald-800 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  className="mt-1 size-5 accent-emerald-800"
                  type="radio"
                  name="ruleConfiguration"
                  value={choice.value}
                  checked={configuration === choice.value}
                  onChange={() => selectConfiguration(choice.value)}
                  required
                />
                <span>
                  <span className="block font-black">{choice.label}</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {choice.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span className="label">Assigned profile version · Required</span>
        <select
          className="field mt-1"
          name="ruleProfileId"
          aria-label="Profile version"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          disabled={!configuration}
          required
        >
          <option value="" disabled>
            {configuration
              ? "Choose a compatible profile"
              : "Choose compliance rules first"}
          </option>
          {compatibleProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 sm:col-span-2"
        aria-live="polite"
      >
        <span className="font-black">Selected rule assignment: </span>
        {configuration && selectedProfile
          ? `${towerRuleConfigurationLabel(configuration)} — ${selectedProfile.name}`
          : configuration
            ? "Choose one of the compatible profiles above."
            : "Choose the compliance rules, then the matching profile."}
      </div>
    </>
  );
}
