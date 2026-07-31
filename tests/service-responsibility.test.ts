import { describe, expect, it } from "vitest";
import {
  canRecordExternalLegionella,
  canRecordLegionellaFieldWork,
  isOurOperationalResponsibility,
  responsibilityForObligation,
  serviceResponsibilityLabel,
} from "@/lib/service-responsibility";
import { previewEventImpact } from "@/lib/obligation-engine";

describe("service responsibility", () => {
  it.each([
    ["OUR_COMPANY", true, false, "Our company"],
    ["CUSTOMER", false, true, "Customer managed"],
    ["OTHER_VENDOR", false, true, "Managed by another vendor"],
    ["NOT_TRACKED", false, false, "Reference only"],
  ] as const)(
    "classifies %s independently",
    (value, field, external, label) => {
      expect(canRecordLegionellaFieldWork(value)).toBe(field);
      expect(canRecordExternalLegionella(value)).toBe(external);
      expect(serviceResponsibilityLabel(value)).toBe(label);
    },
  );

  it("keeps non-Legionella services with our company", () => {
    expect(
      isOurOperationalResponsibility(
        "QUARTERLY_COMPLIANCE_INSPECTION",
        "CUSTOMER",
      ),
    ).toBe(true);
    expect(
      responsibilityForObligation("ROUTINE_OPERATING_SAMPLE", "CUSTOMER"),
    ).toBe("CUSTOMER");
    expect(
      isOurOperationalResponsibility("ROUTINE_OPERATING_SAMPLE", "CUSTOMER"),
    ).toBe(false);
  });

  it("treats an unconfirmed migrated assignment as review work, not our field work", () => {
    expect(
      responsibilityForObligation("ROUTINE_OPERATING_SAMPLE", null),
    ).toBeNull();
    expect(
      isOurOperationalResponsibility("ROUTINE_OPERATING_SAMPLE", null),
    ).toBe(false);
    expect(serviceResponsibilityLabel(null)).toMatch(/must be confirmed/i);
  });

  it("attributes external work in the compliance preview", () => {
    const impact = previewEventImpact({
      proposedEvent: {
        id: "preview",
        type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        date: "2026-07-10",
      },
      ruleConfig: {
        isNyc: false,
        includesNys: true,
        operating: true,
        monthlyTargetStartDay: 20,
        monthlyTargetEndDay: 25,
      },
      openSampleObligations: [],
      performedByResponsibility: "OTHER_VENDOR",
    });
    expect(impact.messages.join(" ")).toMatch(/another vendor/i);
    expect(impact.messages.join(" ")).toMatch(/not by our company/i);
  });

  it("describes customer-managed samples as external reference information", () => {
    const impact = previewEventImpact({
      proposedEvent: {
        id: "preview",
        type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
        date: "2026-07-10",
      },
      ruleConfig: {
        isNyc: false,
        includesNys: true,
        operating: true,
        monthlyTargetStartDay: 20,
        monthlyTargetEndDay: 25,
      },
      openSampleObligations: [],
      performedByResponsibility: "CUSTOMER",
    });
    expect(impact.messages).toContain(
      "This external sample will be recorded for reference. Legionella remains customer managed.",
    );
  });
});
