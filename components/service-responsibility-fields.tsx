"use client";

import { useState } from "react";
import {
  serviceResponsibilityFamilies,
  type ServiceResponsibility,
  type ServiceResponsibilityFamilyKey,
  type TowerServiceResponsibilities,
} from "@/lib/service-responsibility";

export function ServiceResponsibilityFields({
  responsibilities,
  focusedResponsibility,
  legionellaVendorName,
}: {
  responsibilities: TowerServiceResponsibilities;
  focusedResponsibility?: ServiceResponsibilityFamilyKey;
  legionellaVendorName?: string | null;
}) {
  const [values, setValues] = useState<
    Record<ServiceResponsibilityFamilyKey, ServiceResponsibility | "">
  >(
    Object.fromEntries(
      serviceResponsibilityFamilies.map(([key]) => [
        key,
        responsibilities[key] ?? "",
      ]),
    ) as Record<ServiceResponsibilityFamilyKey, ServiceResponsibility | "">,
  );
  const legionellaResponsibility = values.legionellaResponsibility;
  const [preset, setPreset] = useState<ServiceResponsibility | "">("");
  const [previousValues, setPreviousValues] = useState<typeof values | null>(
    null,
  );

  function applyPreset() {
    if (!preset) return;
    setPreviousValues(values);
    setValues(
      Object.fromEntries(
        serviceResponsibilityFamilies.map(([key]) => [key, preset]),
      ) as Record<ServiceResponsibilityFamilyKey, ServiceResponsibility | "">,
    );
  }

  return (
    <>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
        <span className="label">Optional shortcut for all services</span>
        <p className="mt-1 text-sm text-slate-600">
          Choose a preset, then apply it. You can still change each service
          below before saving.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            className="field grow bg-white"
            value={preset}
            onChange={(event) =>
              setPreset(event.target.value as ServiceResponsibility | "")
            }
          >
            <option value="">Choose a preset</option>
            <option value="OUR_COMPANY">Our company handles all</option>
            <option value="CUSTOMER">Customer handles all</option>
            <option value="OTHER_VENDOR">Another vendor handles all</option>
            <option value="NOT_TRACKED">Do not track any services</option>
          </select>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={applyPreset}
            disabled={!preset}
          >
            Apply preset
          </button>
          {previousValues && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setValues(previousValues);
                setPreviousValues(null);
              }}
            >
              Undo preset
            </button>
          )}
        </div>
      </div>
      {serviceResponsibilityFamilies.map(([key, label]) => (
        <label
          key={key}
          className={
            focusedResponsibility === key
              ? "rounded-lg border-2 border-blue-400 bg-blue-50 p-3"
              : undefined
          }
        >
          <span className="label">{label}</span>
          <select
            className="field mt-1"
            name={key}
            value={values[key]}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [key]: event.target.value as ServiceResponsibility,
              }))
            }
            autoFocus={focusedResponsibility === key}
            required
          >
            <option value="" disabled>
              Select responsible party
            </option>
            <option value="OUR_COMPANY">Our company</option>
            <option value="CUSTOMER">Customer</option>
            <option value="OTHER_VENDOR">Another vendor</option>
            <option value="NOT_TRACKED">
              Do not track this work in TowerTrack
            </option>
          </select>
        </label>
      ))}
      {legionellaResponsibility === "OTHER_VENDOR" && (
        <label>
          <span className="label">Legionella vendor name · Required</span>
          <input
            className="field mt-1"
            name="legionellaVendorName"
            defaultValue={legionellaVendorName ?? ""}
            required
          />
        </label>
      )}
    </>
  );
}
