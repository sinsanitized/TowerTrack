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
    <fieldset className="grid gap-3 rounded-xl border border-blue-300 bg-blue-50/40 p-4 sm:col-span-2">
      <legend className="label">Legionella responsibility · Required</legend>
      <p className="text-sm font-bold text-blue-950">
        Affects the Action Center: choose who must complete and report this
        work.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`cursor-pointer rounded-xl border-2 p-4 ${
              responsibility === choice.value
                ? "border-emerald-800 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <span className="flex items-start gap-3">
              <input
                className="mt-1 size-5 accent-emerald-800"
                type="radio"
                name="legionellaResponsibility"
                value={choice.value}
                checked={responsibility === choice.value}
                onChange={() => setResponsibility(choice.value)}
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
      {responsibility === "OTHER_VENDOR" && (
        <label className="max-w-xl">
          <span className="label">Legionella vendor name · Required</span>
          <input className="field mt-1" name="legionellaVendorName" required />
        </label>
      )}
    </fieldset>
  );
}
