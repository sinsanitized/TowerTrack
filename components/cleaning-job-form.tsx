"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCleaningJobAction,
  updateCleaningJobAction,
} from "@/app/actions/scheduling";
import {
  cleaningGapMessage,
  defaultCleaningDate,
  shiftCleaningDate,
} from "@/lib/cleaning-schedule";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";

type BuildingOption = {
  id: string;
  name: string;
  address: string;
  towers: { id: string; name: string }[];
};

export function CleaningJobForm({
  buildings,
  technicians,
  initialDate,
  initialBuildingId,
  initialTowerId,
}: {
  buildings: BuildingOption[];
  technicians: { id: string; name: string }[];
  initialDate: string;
  initialBuildingId?: string;
  initialTowerId?: string;
}) {
  const initialBuilding = buildings.find(
    (building) => building.id === initialBuildingId,
  );
  const [buildingId, setBuildingId] = useState(initialBuilding?.id ?? "");
  const [buildingQuery, setBuildingQuery] = useState(
    initialBuilding
      ? `${initialBuilding.name} — ${initialBuilding.address}`
      : "",
  );
  const [scopeMode, setScopeMode] = useState<"ALL_TOWERS" | "SELECTED_TOWERS">(
    initialTowerId ? "SELECTED_TOWERS" : "ALL_TOWERS",
  );
  const [selectedTowerIds, setSelectedTowerIds] = useState<string[]>(
    initialTowerId
      ? [initialTowerId]
      : (initialBuilding?.towers.map((tower) => tower.id) ?? []),
  );
  const [ready, setReady] = useState(false);
  const [addDate, setAddDate] = useState(initialDate);
  const [cleaningDate, setCleaningDate] = useState(
    defaultCleaningDate(initialDate),
  );
  const [cleaningDateWasEdited, setCleaningDateWasEdited] = useState(false);
  const { dirty, markDirty, clearDirty } = useUnsavedChanges();
  useEffect(() => setReady(true), []);
  const building = useMemo(
    () => buildings.find((item) => item.id === buildingId),
    [buildingId, buildings],
  );
  const warning = cleaningGapMessage(addDate, cleaningDate);
  const matchingBuildings = useMemo(() => {
    const query = buildingQuery.trim().toLocaleLowerCase();
    if (!query) return buildings.slice(0, 8);
    return buildings
      .filter((item) =>
        `${item.name} ${item.address}`.toLocaleLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [buildingQuery, buildings]);

  function chooseBuilding(id: string) {
    const next = buildings.find((item) => item.id === id);
    markDirty();
    setBuildingId(id);
    setBuildingQuery(next ? `${next.name} — ${next.address}` : "");
    setScopeMode("ALL_TOWERS");
    setSelectedTowerIds(next?.towers.map((tower) => tower.id) ?? []);
  }

  function chooseScope(mode: "ALL_TOWERS" | "SELECTED_TOWERS") {
    setScopeMode(mode);
    setSelectedTowerIds(
      mode === "ALL_TOWERS"
        ? (building?.towers.map((tower) => tower.id) ?? [])
        : [],
    );
  }

  return (
    <form
      action={createCleaningJobAction}
      className="space-y-5"
      onChangeCapture={markDirty}
      onSubmitCapture={clearDirty}
    >
      <input type="hidden" name="buildingId" value={buildingId} />
      <input type="hidden" name="scopeMode" value={scopeMode} />
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-4">
          <div className="font-black">1. Choose where</div>
          <p className="mt-1 text-sm text-slate-600">
            Select the building and towers included in this cleaning plan.
          </p>
        </div>
        <div className="relative">
          <label className="label" htmlFor="schedule-building">
            Find a building · Required
          </label>
          <input
            id="schedule-building"
            className="input mt-2 w-full"
            role="combobox"
            aria-expanded={!buildingId}
            aria-controls="schedule-building-options"
            autoComplete="off"
            placeholder="Type a building name or address"
            value={buildingQuery}
            disabled={!ready}
            onChange={(event) => {
              setBuildingQuery(event.target.value);
              setBuildingId("");
              setSelectedTowerIds([]);
            }}
          />
          {ready && !buildingId && (
            <div
              id="schedule-building-options"
              role="listbox"
              className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1 shadow-lg"
            >
              {matchingBuildings.length ? (
                matchingBuildings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="block w-full rounded-lg px-3 py-3 text-left hover:bg-sky-50 focus:bg-sky-50"
                    onClick={() => chooseBuilding(item.id)}
                  >
                    <span className="block font-black">{item.name}</span>
                    <span className="block text-sm text-slate-600">
                      {item.address}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-3 text-sm font-bold text-slate-600">
                  No building matches that search.
                </p>
              )}
            </div>
          )}
          {building && (
            <p className="mt-2 text-sm font-bold text-slate-600">
              {building.address}
            </p>
          )}
        </div>

        <fieldset className="mt-4" disabled={!building}>
          <legend className="label">Towers included</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-3 ${scopeMode === "ALL_TOWERS" ? "border-sky-500 bg-sky-50" : "border-slate-300"}`}
            >
              <input
                type="radio"
                checked={scopeMode === "ALL_TOWERS"}
                onChange={() => chooseScope("ALL_TOWERS")}
              />
              <span className="ml-2 font-black">
                All towers at this building
              </span>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-3 ${scopeMode === "SELECTED_TOWERS" ? "border-sky-500 bg-sky-50" : "border-slate-300"}`}
            >
              <input
                type="radio"
                checked={scopeMode === "SELECTED_TOWERS"}
                onChange={() => chooseScope("SELECTED_TOWERS")}
              />
              <span className="ml-2 font-black">Choose specific towers</span>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {building?.towers.map((tower) => {
              const checked = selectedTowerIds.includes(tower.id);
              return (
                <label
                  key={tower.id}
                  className="flex min-h-11 items-center rounded-lg border border-slate-200 px-3 py-2 font-bold"
                >
                  <input
                    type="checkbox"
                    name="towerIds"
                    value={tower.id}
                    checked={checked}
                    disabled={scopeMode === "ALL_TOWERS"}
                    onChange={(event) =>
                      setSelectedTowerIds((current) =>
                        event.target.checked
                          ? [...current, tower.id]
                          : current.filter((id) => id !== tower.id),
                      )
                    }
                  />
                  {scopeMode === "ALL_TOWERS" && (
                    <input type="hidden" name="towerIds" value={tower.id} />
                  )}
                  <span className="ml-2">{tower.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-4">
          <div className="font-black">2. Choose dates</div>
          <p className="mt-1 text-sm text-slate-600">
            Treatment chemicals must be added before cleaning so they have time
            to circulate.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Chemical addition date</span>
            <input
              className="input mt-2 w-full"
              type="date"
              name="addDate"
              value={addDate}
              onChange={(event) => {
                setAddDate(event.target.value);
                if (!cleaningDateWasEdited)
                  setCleaningDate(defaultCleaningDate(event.target.value));
              }}
              disabled={!ready}
              required
            />
          </label>
          <label>
            <span className="label">Cleaning date</span>
            <input
              className="input mt-2 w-full"
              type="date"
              name="cleaningDate"
              value={cleaningDate}
              onChange={(event) => {
                setCleaningDate(event.target.value);
                setCleaningDateWasEdited(true);
              }}
              disabled={!ready}
              required
            />
          </label>
        </div>
        {warning && (
          <div
            role="alert"
            className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-950"
          >
            Review timing: {warning}
          </div>
        )}
      </section>

      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer list-none font-black text-sky-900">
          3. Optional assignment and notes
        </summary>
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          {technicians.length > 0 && (
            <label className="block">
              <span className="label">Technician (optional)</span>
              <select name="assignedTechnicianId" className="input mt-2 w-full">
                <option value="">Unassigned</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="label">Notes (optional)</span>
            <textarea
              name="notes"
              className="input mt-2 min-h-24 w-full"
              placeholder="Access, timing, or site instructions"
            />
          </label>
        </div>
      </details>
      <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
        <strong>Saving creates two linked visits.</strong> It does not record
        completed cleaning or change a compliance deadline.
      </div>
      <button
        className="btn btn-primary min-h-12 w-full"
        disabled={!ready || !building || selectedTowerIds.length === 0}
      >
        Schedule chemical addition and cleaning
      </button>
      {dirty && (
        <p
          className="text-center text-sm font-bold text-amber-800"
          role="status"
        >
          Unsaved changes
        </p>
      )}
    </form>
  );
}

export function CleaningJobEditForm({
  jobId,
  initialAddDate,
  initialCleaningDate,
  initialTechnicianId,
  initialNotes,
  technicians,
}: {
  jobId: string;
  initialAddDate: string;
  initialCleaningDate: string;
  initialTechnicianId?: string;
  initialNotes?: string;
  technicians: { id: string; name: string }[];
}) {
  const [addDate, setAddDate] = useState(initialAddDate);
  const [cleaningDate, setCleaningDate] = useState(initialCleaningDate);
  const [shiftTogether, setShiftTogether] = useState(false);
  const { dirty, markDirty, clearDirty } = useUnsavedChanges();
  const proposedCleaningDate = shiftTogether
    ? shiftCleaningDate(initialAddDate, addDate, initialCleaningDate)
    : cleaningDate;
  const warning = cleaningGapMessage(addDate, proposedCleaningDate);

  return (
    <form
      action={updateCleaningJobAction}
      className="rounded-xl border border-slate-300 p-4"
      onChangeCapture={markDirty}
      onSubmitCapture={clearDirty}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input
        type="hidden"
        name="shiftCleaning"
        value={shiftTogether ? "yes" : "no"}
      />
      <h3 className="font-black">Edit schedule</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Chemical addition date</span>
          <input
            className="input mt-1 w-full"
            type="date"
            name="addDate"
            value={addDate}
            onChange={(event) => setAddDate(event.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">Cleaning date</span>
          <input
            className="input mt-1 w-full"
            type="date"
            name="cleaningDate"
            value={proposedCleaningDate}
            disabled={shiftTogether}
            onChange={(event) => setCleaningDate(event.target.value)}
            required
          />
          {shiftTogether && (
            <input
              type="hidden"
              name="cleaningDate"
              value={proposedCleaningDate}
            />
          )}
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={shiftTogether}
          onChange={(event) => setShiftTogether(event.target.checked)}
        />
        Move the cleaning date by the same number of days when the chemical
        addition date moves.
      </label>
      <p className="mt-2 text-sm font-bold text-slate-700">
        Proposed dates: Chemical addition {addDate} → Cleaning{" "}
        {proposedCleaningDate}
      </p>
      {warning && (
        <div className="mt-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          Review timing: {warning}
        </div>
      )}
      <label className="mt-3 block">
        <span className="label">Assigned technician (optional)</span>
        <select
          name="assignedTechnicianId"
          className="input mt-1 w-full"
          defaultValue={initialTechnicianId ?? ""}
        >
          <option value="">Unassigned</option>
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="label">Notes (optional)</span>
        <textarea
          name="notes"
          className="input mt-1 min-h-20 w-full"
          defaultValue={initialNotes ?? ""}
          placeholder="Access, timing, or site instructions"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">Save schedule</button>
        {dirty && (
          <span className="text-sm font-bold text-amber-800" role="status">
            Unsaved changes
          </span>
        )}
      </div>
    </form>
  );
}
