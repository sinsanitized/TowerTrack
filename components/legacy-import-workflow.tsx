"use client";

import { useMemo, useState } from "react";

type PreviewRow = {
  id: string;
  sourceRow: number;
  status: string;
  proposedData: {
    jobNumber: string;
    jobName: string;
    address: string;
    facilityName: string;
    systemName: string;
    systemType: string;
    tonnage: number | null;
    operationPeriodType: string;
    latestLegionellaDate: string | null;
    latestHyperhalogenationDate: string | null;
    duplicateJobNumber: boolean;
    eligible: boolean;
  };
  sourceCells: Record<string, string>;
  events: unknown[];
  ambiguousCells: unknown[];
  warnings: string[];
  errors: string[];
};

type Preview = {
  id: string;
  filename: string;
  status: string;
  counts: Record<string, number>;
  mapping: Array<{ columns: string; year: number; note: string }>;
  warnings: string[];
  existing: boolean;
  rows: PreviewRow[];
};

export function LegacyImportWorkflow({
  jurisdictions,
  profiles,
}: {
  jurisdictions: Array<{ id: string; label: string }>;
  profiles: Array<{ id: string; name: string; jurisdictionId: string | null }>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visibleRows = useMemo(() => {
    if (!preview) return [];
    if (filter === "ALL") return preview.rows;
    if (filter === "AMBIGUOUS")
      return preview.rows.filter((row) => row.ambiguousCells.length);
    if (filter === "DUPLICATE")
      return preview.rows.filter((row) => row.proposedData.duplicateJobNumber);
    if (filter === "ERROR")
      return preview.rows.filter((row) => row.errors.length);
    if (filter === "WARNING")
      return preview.rows.filter((row) => row.warnings.length);
    return preview.rows;
  }, [filter, preview]);

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/import/legacy-excel/analyze", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error ?? "Analysis failed.");
    setPreview(result);
    setSelected(
      new Set(
        result.rows
          .filter((row: PreviewRow) => row.proposedData.eligible)
          .map((row: PreviewRow) => row.id),
      ),
    );
    setMessage(
      result.existing
        ? "This workbook was analyzed previously. Existing batch loaded; no records were duplicated."
        : "Analysis complete. No operational records have been written.",
    );
  }

  async function confirm() {
    if (!preview || !selected.size) return;
    setBusy(true);
    const response = await fetch("/api/import/legacy-excel/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batchId: preview.id,
        selectedRowIds: [...selected],
      }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `Import ${result.status.toLowerCase()}: ${result.systemsCreated} systems and ${result.activitiesCreated} unverified activities created. Batch ${result.batchId}.`
        : (result.error ?? "Import failed."),
    );
    if (response.ok) setPreview({ ...preview, status: result.status });
  }

  async function rollback() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch("/api/import/legacy-excel/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId: preview.id }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `Rolled back ${result.rolledBack} untouched imported rows.${result.blocked.length ? ` ${result.blocked.length} rows were protected because they were edited or referenced.` : ""}`
        : (result.error ?? "Rollback failed."),
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={analyze} className="panel grid gap-4 p-5 md:grid-cols-3">
        <label className="md:col-span-3">
          <span className="label">Legacy Excel workbook</span>
          <input
            className="field mt-1"
            name="file"
            type="file"
            accept=".xlsx"
            required
          />
        </label>
        <label>
          <span className="label">Jurisdiction</span>
          <select className="field mt-1" name="jurisdictionId" required>
            {jurisdictions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Rule profile</span>
          <select className="field mt-1" name="ruleProfileId" required>
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Default route zone</span>
          <input
            className="field mt-1"
            name="routeZone"
            required
            defaultValue="NYC legacy import"
          />
        </label>
        <label>
          <span className="label">Default city</span>
          <input
            className="field mt-1"
            name="city"
            required
            defaultValue="New York"
          />
        </label>
        <label>
          <span className="label">Default state</span>
          <input
            className="field mt-1"
            name="state"
            required
            minLength={2}
            maxLength={2}
            defaultValue="NY"
          />
        </label>
        <label>
          <span className="label">Default ZIP code (optional)</span>
          <input
            className="field mt-1"
            name="postalCode"
            minLength={5}
            maxLength={10}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Leave blank to import the building with ZIP marked as needs review.
          </span>
        </label>
        <div className="md:col-span-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Analyzing…" : "Analyze workbook"}
          </button>
        </div>
      </form>

      {message && (
        <div
          className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-950"
          role="status"
        >
          {message}
        </div>
      )}

      {preview && (
        <>
          <section className="panel p-5">
            <h2 className="font-black">Preview summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(preview.counts).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <div className="label">
                    {label.replaceAll(/([A-Z])/g, " $1")}
                  </div>
                  <div className="mt-1 text-xl font-black">{value}</div>
                </div>
              ))}
            </div>
            <details className="mt-4 rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer font-bold">
                Detected year and month mapping
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {preview.mapping.map((item) => (
                  <li key={item.columns}>
                    <strong>
                      {item.columns} · {item.year}
                    </strong>{" "}
                    — {item.note}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-black">Proposed systems</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Only eligible checked rows will be imported.
                </p>
              </div>
              <select
                className="field max-w-52"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter preview rows"
              >
                <option value="ALL">All rows</option>
                <option value="ERROR">Errors</option>
                <option value="WARNING">Warnings</option>
                <option value="DUPLICATE">Duplicate job numbers</option>
                <option value="AMBIGUOUS">Ambiguous values</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Import",
                      "Row",
                      "Job",
                      "Facility / address",
                      "System",
                      "Schedule",
                      "Latest sample",
                      "Latest SHH",
                      "Events",
                      "Ambiguous",
                      "Status",
                    ].map((item) => (
                      <th key={item} className="px-3 py-3">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          disabled={
                            !row.proposedData.eligible ||
                            preview.status !== "PREVIEWED"
                          }
                          checked={selected.has(row.id)}
                          onChange={(event) => {
                            const next = new Set(selected);
                            if (event.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelected(next);
                          }}
                          aria-label={`Import source row ${row.sourceRow}`}
                        />
                      </td>
                      <td className="px-3 py-3 font-bold">{row.sourceRow}</td>
                      <td className="px-3 py-3">
                        {row.proposedData.jobNumber}
                        {row.proposedData.duplicateJobNumber && (
                          <div className="font-bold text-amber-800">
                            Repeated; kept separate
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold">
                          {row.proposedData.facilityName}
                        </div>
                        <div>{row.proposedData.address}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.proposedData.systemName}</div>
                        <div>
                          {row.proposedData.systemType} ·{" "}
                          {row.proposedData.tonnage ?? "No tonnage"} tons
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {row.proposedData.operationPeriodType}
                      </td>
                      <td className="px-3 py-3">
                        {row.proposedData.latestLegionellaDate ??
                          "None recognized"}
                      </td>
                      <td className="px-3 py-3">
                        {row.proposedData.latestHyperhalogenationDate ??
                          "None recognized"}
                      </td>
                      <td className="px-3 py-3">{row.events.length}</td>
                      <td className="px-3 py-3">{row.ambiguousCells.length}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold">
                          {row.status.replaceAll("_", " ")}
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-emerald-800">
                            Source details
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                            {JSON.stringify(
                              {
                                warnings: row.warnings,
                                errors: row.errors,
                                ambiguousCells: row.ambiguousCells,
                                sourceCells: row.sourceCells,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-200 p-5">
              {preview.status === "PREVIEWED" ? (
                <button
                  className="btn btn-primary"
                  disabled={busy || !selected.size}
                  onClick={confirm}
                >
                  Confirm import of {selected.size} rows
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={rollback}>
                  Rollback untouched imported records
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
