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

  function setAll(next: ServiceResponsibility | "") {
    if (!next) return;
    setValues(
      Object.fromEntries(
        serviceResponsibilityFamilies.map(([key]) => [key, next]),
      ) as Record<ServiceResponsibilityFamilyKey, ServiceResponsibility | "">,
    );
  }

  return (
    <>
      <label className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
        <span className="label">Set all services at once (optional)</span>
        <select
          className="field mt-1 bg-white"
          defaultValue=""
          onChange={(event) =>
            setAll(event.target.value as ServiceResponsibility | "")
          }
        >
          <option value="">Choose only if one party handles everything</option>
          <option value="OUR_COMPANY">Our company handles all services</option>
          <option value="CUSTOMER">Customer handles all services</option>
          <option value="OTHER_VENDOR">
            Another vendor handles all services
          </option>
          <option value="NOT_TRACKED">Do not track any services</option>
        </select>
      </label>
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
