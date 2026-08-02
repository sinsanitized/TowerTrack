// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { LegionellaResultInput } from "@/components/legionella-result-input";

function ResultInput({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <LegionellaResultInput value={value} onChange={setValue} />;
}

describe("Legionella result input", () => {
  it("presents a stored zero as None detected instead of a numeric zero", () => {
    const { container } = render(<ResultInput initialValue="0" />);

    expect(screen.getByLabelText("None detected")).toBeChecked();
    expect(screen.queryByLabelText("Result (CFU/mL)")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="cfuPerMl"]')).toHaveValue("0");
  });

  it("keeps detected results as numeric CFU/mL values", () => {
    render(<ResultInput />);

    const result = screen.getByLabelText(/Result \(CFU\/mL\)/);
    fireEvent.change(result, { target: { value: "25" } });
    expect(result).toHaveValue(25);
  });
});
