import { describe, expect, it } from "vitest";
import { buildSampleChoices } from "@/lib/sample-choices";

describe("sample choices", () => {
  it("distinguishes samples collected on the same date", () => {
    const choices = buildSampleChoices([
      { id: "one", date: "2026-11-01", notes: "North basin" },
      { id: "two", date: "2026-11-01", externalSource: "Lab B" },
      { id: "three", date: "2026-11-02" },
    ]);

    expect(choices).toEqual([
      {
        id: "one",
        date: "2026-11-01",
        context: "North basin",
        label: "Sample 1 of 2 · North basin",
      },
      {
        id: "two",
        date: "2026-11-01",
        context: "Lab B",
        label: "Sample 2 of 2 · Lab B",
      },
      {
        id: "three",
        date: "2026-11-02",
        context: null,
        label: "",
      },
    ]);
  });
});
