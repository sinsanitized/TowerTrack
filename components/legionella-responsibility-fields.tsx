"use client";

import { useState } from "react";

const choices = [
  {
    value: "OUR_COMPANY",
    label: "Our company manages Legionella",
    description: "Show this work in our Action Center and deadlines.",
  },
  {
    value: "CUSTOMER",
    label: "Customer manages Legionella",
    description: "Keep the responsibility visible without assigning it to us.",
  },
  {
    value: "OTHER_VENDOR",
    label: "Another vendor manages Legionella",
    description: "Track the obligation as work completed outside our company.",
  },
  {
    value: "NOT_TRACKED",
    label: "Do not track Legionella in TowerTrack",
    description: "Keep this work out of operational deadlines.",
  },
] as const;

export function LegionellaResponsibilityFields() {
  const [responsibility, setResponsibility] = useState("");

  return (
    <fieldset className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:col-span-2">
      <legend className="label">Legionella responsibility</legend>
      <label className="block max-w-xl">
        <span className="label">Responsible party · Required</span>
        <select
          className="field mt-1 bg-white"
          name="legionellaResponsibility"
          value={responsibility}
          onChange={(event) => setResponsibility(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose who handles this work
          </option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm text-slate-600">
          {choices.find((choice) => choice.value === responsibility)
            ?.description ??
            "This determines whether the work appears in your Action Center."}
        </span>
      </label>
      {responsibility === "OTHER_VENDOR" && (
        <label className="max-w-xl">
          <span className="label">Legionella vendor name · Required</span>
          <input className="field mt-1" name="legionellaVendorName" required />
        </label>
      )}
    </fieldset>
  );
}
