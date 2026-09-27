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
  const [legionellaResponsibility, setLegionellaResponsibility] = useState<
    ServiceResponsibility | ""
  >(responsibilities.legionellaResponsibility ?? "");

  return (
    <>
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
            defaultValue={responsibilities[key] ?? ""}
            onChange={
              key === "legionellaResponsibility"
                ? (event) =>
                    setLegionellaResponsibility(
                      event.target.value as ServiceResponsibility,
                    )
                : undefined
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
