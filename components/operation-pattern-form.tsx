"use client";

import { useState } from "react";
import { updateSeasonalSettingsAction } from "@/app/actions";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function OperationPatternForm({
  systemId,
  seasonal,
  seasonStartMonth,
  seasonStartDay,
  seasonEndMonth,
  seasonEndDay,
  currentLabel,
  currentStatus,
}: {
  systemId: string;
  seasonal: boolean;
  seasonStartMonth: number;
  seasonStartDay: number;
  seasonEndMonth: number;
  seasonEndDay: number;
  currentLabel: string;
  currentStatus: string;
}) {
  const [operationPattern, setOperationPattern] = useState<
    "YEAR_ROUND" | "SEASONAL"
  >(seasonal ? "SEASONAL" : "YEAR_ROUND");
  const [startMonth, setStartMonth] = useState(seasonStartMonth);
  const [startDay, setStartDay] = useState(seasonStartDay);
  const [endMonth, setEndMonth] = useState(seasonEndMonth);
  const [endDay, setEndDay] = useState(seasonEndDay);
  const isSeasonal = operationPattern === "SEASONAL";

  return (
    <form action={updateSeasonalSettingsAction} className="mt-4 space-y-4">
      <input type="hidden" name="systemId" value={systemId} />
      <fieldset>
        <legend className="label">Choose one operation pattern</legend>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <label
            className={`cursor-pointer rounded-xl border-2 p-4 ${
              !isSeasonal
                ? "border-emerald-800 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="operationPattern"
                value="YEAR_ROUND"
                checked={!isSeasonal}
                onChange={() => setOperationPattern("YEAR_ROUND")}
                className="mt-1 size-5 accent-emerald-800"
              />
              <span>
                <span className="block font-black">Year-Round Tower</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Operates throughout the year. Routine compliance clocks remain
                  active.
                </span>
              </span>
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-xl border-2 p-4 ${
              isSeasonal
                ? "border-emerald-800 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="operationPattern"
                value="SEASONAL"
                checked={isSeasonal}
                onChange={() => setOperationPattern("SEASONAL")}
                className="mt-1 size-5 accent-emerald-800"
              />
              <span>
                <span className="block font-black">Seasonal Tower</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Operates during a recurring part of the year. Configure the
                  expected season below.
                </span>
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {isSeasonal && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="label">Recurring operating season</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <fieldset className="grid grid-cols-[1fr_90px] gap-2">
              <legend className="mb-2 font-black">Season starts</legend>
              <label>
                <span className="label">Month</span>
                <select
                  className="field mt-1"
                  name="seasonStartMonth"
                  aria-label="Season start month"
                  value={startMonth}
                  onChange={(event) =>
                    setStartMonth(Number(event.target.value))
                  }
                  required
                >
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Day</span>
                <input
                  className="field mt-1"
                  name="seasonStartDay"
                  aria-label="Season start day"
                  type="number"
                  min="1"
                  max="31"
                  value={startDay}
                  onChange={(event) => setStartDay(Number(event.target.value))}
                  required
                />
              </label>
            </fieldset>
            <fieldset className="grid grid-cols-[1fr_90px] gap-2">
              <legend className="mb-2 font-black">Season ends</legend>
              <label>
                <span className="label">Month</span>
                <select
                  className="field mt-1"
                  name="seasonEndMonth"
                  aria-label="Season end month"
                  value={endMonth}
                  onChange={(event) => setEndMonth(Number(event.target.value))}
                  required
                >
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Day</span>
                <input
                  className="field mt-1"
                  name="seasonEndDay"
                  aria-label="Season end day"
                  type="number"
                  min="1"
                  max="31"
                  value={endDay}
                  onChange={(event) => setEndDay(Number(event.target.value))}
                  required
                />
              </label>
            </fieldset>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700">
            Seasonal Tower · {months[startMonth - 1]} {startDay} through{" "}
            {months[endMonth - 1]} {endDay}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
        <div className="font-black">
          Current saved setup: {currentLabel} · {currentStatus}
        </div>
        <p className="mt-1">
          Changing this configuration does not prove the tower started or shut
          down. Record the actual change with <b>Add startup</b> or{" "}
          <b>Add shutdown</b>; those audited events generate or pause compliance
          obligations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label>
          <span className="label">Reason for change</span>
          <input
            className="field mt-1"
            name="reason"
            required
            minLength={8}
            defaultValue="Update tower operation pattern"
          />
        </label>
        <button className="btn btn-primary">Save operation pattern</button>
      </div>
    </form>
  );
}
