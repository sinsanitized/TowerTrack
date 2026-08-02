import { describe, expect, it } from "vitest";
import {
  safeReturnPath,
  withReturnPath,
  withWorkflowNotice,
} from "@/lib/workflow-context";

describe("workflow return context", () => {
  it("accepts only local application paths", () => {
    expect(safeReturnPath("/deadlines?window=this-week")).toBe(
      "/deadlines?window=this-week",
    );
    expect(safeReturnPath("https://example.com")).toBeNull();
    expect(safeReturnPath("//example.com/path")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });

  it("preserves hashes while adding a return destination", () => {
    expect(
      withReturnPath(
        "/systems/tower-1?record=event#record-event",
        "/samples?status=action-needed",
      ),
    ).toBe(
      "/systems/tower-1?record=event&returnTo=%2Fsamples%3Fstatus%3Daction-needed#record-event",
    );
  });

  it("adds a visible completion notice to the original queue", () => {
    expect(withWorkflowNotice("/deadlines?window=this-week", "Saved")).toBe(
      "/deadlines?window=this-week&workflowNotice=Saved",
    );
  });
});
