"use client";

import { useState } from "react";

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

export function OperatingScheduleFields() {
  const [schedule, setSchedule] = useState<"YEAR_ROUND" | "SEASONAL" | "">("");

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
      <legend className="label px-1">Operating schedule</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["YEAR_ROUND", "Year-round", "Operates throughout the year."],
          ["SEASONAL", "Seasonal", "Operates during a recurring season."],
        ].map(([value, label, description]) => (
          <label
            key={value}
            className={`cursor-pointer rounded-xl border-2 p-4 ${
              schedule === value
                ? "border-emerald-800 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="flex items-start gap-3">
              <input
                className="mt-1 size-5 accent-emerald-800"
                type="radio"
                name="operatingSchedule"
                value={value}
                checked={schedule === value}
                onChange={() => setSchedule(value as "YEAR_ROUND" | "SEASONAL")}
                required
              />
              <span>
                <span className="block font-black">{label}</span>
                <span className="mt-1 block text-sm text-slate-600">
                  {description}
                </span>
              </span>
            </span>
          </label>
        ))}
      </div>

      {schedule === "SEASONAL" && (
        <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          {[
            ["Start", "seasonStartMonth", "seasonStartDay", 5, 1],
            ["End", "seasonEndMonth", "seasonEndDay", 10, 31],
          ].map(([label, monthName, dayName, month, day]) => (
            <fieldset
              key={String(label)}
              className="grid grid-cols-[1fr_90px] gap-2"
            >
              <legend className="mb-2 font-black">Season {label}</legend>
              <label>
                <span className="label">Month</span>
                <select
                  className="field mt-1"
                  name={String(monthName)}
                  defaultValue={String(month)}
                  required
                >
                  {months.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Day</span>
                <input
                  className="field mt-1"
                  name={String(dayName)}
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={Number(day)}
                  required
                />
              </label>
            </fieldset>
          ))}
        </div>
      )}
    </fieldset>
  );
}
