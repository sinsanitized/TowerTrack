// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("requires an explicit report result before showing the numeric field", () => {
    const { container } = render(<ResultInput />);
    const resultInput = within(container);

    expect(
      resultInput.getByText(
        "Choose the result shown on the laboratory report.",
      ),
    ).toBeInTheDocument();
    expect(
      resultInput.queryByLabelText(/Result \(CFU\/mL\)/),
    ).not.toBeInTheDocument();

    fireEvent.click(resultInput.getByLabelText("Detected"));
    const result = resultInput.getByLabelText(/Result \(CFU\/mL\)/);
    fireEvent.change(result, { target: { value: "25" } });
    expect(result).toHaveValue(25);
  });
});
