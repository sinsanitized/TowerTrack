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
  const initialBuilding =
    buildings.find((building) => building.id === initialBuildingId) ??
    buildings[0];
  const [buildingId, setBuildingId] = useState(initialBuilding?.id ?? "");
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
  useEffect(() => setReady(true), []);
  const building = useMemo(
    () => buildings.find((item) => item.id === buildingId),
    [buildingId, buildings],
  );
  const warning = cleaningGapMessage(addDate, cleaningDate);

  function chooseBuilding(id: string) {
    const next = buildings.find((item) => item.id === id);
    setBuildingId(id);
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
    <form action={createCleaningJobAction} className="space-y-5">
      <input type="hidden" name="scopeMode" value={scopeMode} />
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-4">
          <div className="font-black">1. Choose where</div>
          <p className="mt-1 text-sm text-slate-600">
            Select the building and towers included in this cleaning plan.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="schedule-building">
            Building
          </label>
          <select
            id="schedule-building"
            name="buildingId"
            className="input mt-2 w-full"
            value={buildingId}
            onChange={(event) => chooseBuilding(event.target.value)}
            required
          >
            {buildings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.address}
              </option>
            ))}
          </select>
          {building && (
            <p className="mt-2 text-sm font-bold text-slate-600">
              {building.address}
            </p>
          )}
        </div>

        <fieldset className="mt-4">
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
              onChange={(event) => setCleaningDate(event.target.value)}
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
  const proposedCleaningDate = shiftTogether
    ? shiftCleaningDate(initialAddDate, addDate, initialCleaningDate)
    : cleaningDate;
  const warning = cleaningGapMessage(addDate, proposedCleaningDate);

  return (
    <form
      action={updateCleaningJobAction}
      className="rounded-xl border border-slate-300 p-4"
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
        Shift Cleaning by the same number of days when Add moves.
      </label>
      <p className="mt-2 text-sm font-bold text-slate-700">
        Proposed dates: Add {addDate} → Cleaning {proposedCleaningDate}
      </p>
      {warning && (
        <div className="mt-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          Review timing: {warning}
        </div>
      )}
      <select
        name="assignedTechnicianId"
        className="input mt-3 w-full"
        defaultValue={initialTechnicianId ?? ""}
      >
        <option value="">Unassigned</option>
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.id}>
            {technician.name}
          </option>
        ))}
      </select>
      <textarea
        name="notes"
        className="input mt-3 min-h-20 w-full"
        defaultValue={initialNotes ?? ""}
      />
      <button className="btn btn-primary mt-3">Save schedule</button>
    </form>
  );
}
