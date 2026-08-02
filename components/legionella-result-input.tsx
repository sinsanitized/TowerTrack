"use client";

export function LegionellaResultInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const noneDetected = value === "0";

  return (
    <fieldset>
      <legend className="label">Legionella result · Required</legend>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="legionellaResultMode"
            checked={noneDetected}
            onChange={() => onChange("0")}
          />
          None detected
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="legionellaResultMode"
            checked={!noneDetected}
            onChange={() => onChange("")}
          />
          Detected
        </label>
      </div>
      {noneDetected ? (
        <>
          <input type="hidden" name="cfuPerMl" value="0" />
          <p className="mt-2 text-sm font-medium text-emerald-700">
            None detected
          </p>
        </>
      ) : (
        <label className="mt-3 block">
          <span className="label">Result (CFU/mL) · Required</span>
          <input
            className="field mt-1"
            name="cfuPerMl"
            type="number"
            min="0.000001"
            step="any"
            required
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )}
    </fieldset>
  );
}
