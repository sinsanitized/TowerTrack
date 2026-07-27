// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { StatusBadge } from "@/components/status-badge";
describe("StatusBadge", () => {
  it.each([
    ["GREEN", "Good"],
    ["YELLOW", "Needs scheduling"],
    ["RED", "Overdue"],
    ["BLUE", "Waiting on lab"],
    ["GRAY", "Inactive"],
    ["PURPLE", "Needs review"],
  ] as const)("renders %s with text", (color, label) => {
    render(<StatusBadge color={color} label={label} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute("data-color", color);
  });
});
