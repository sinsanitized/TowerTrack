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
  const [startMonth, setStartMonth] = useState(5);
  const [startDay, setStartDay] = useState(1);
  const [endMonth, setEndMonth] = useState(10);
  const [endDay, setEndDay] = useState(31);

  return (
    <fieldset className="rounded-xl border border-blue-300 bg-blue-50/40 p-4 sm:col-span-2">
      <legend className="label px-1">Operating dates · Required</legend>
      <p className="mb-3 text-sm font-bold text-blue-950">
        Affects future deadlines: choose when this tower normally operates.
      </p>
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
            [
              "Start",
              "seasonStartMonth",
              "seasonStartDay",
              startMonth,
              startDay,
            ],
            ["End", "seasonEndMonth", "seasonEndDay", endMonth, endDay],
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
                  onChange={(event) =>
                    label === "Start"
                      ? setStartMonth(Number(event.target.value))
                      : setEndMonth(Number(event.target.value))
                  }
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
                  onChange={(event) =>
                    label === "Start"
                      ? setStartDay(Number(event.target.value))
                      : setEndDay(Number(event.target.value))
                  }
                  required
                />
              </label>
            </fieldset>
          ))}
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-950 sm:col-span-2">
            Seasonal schedule: {months[startMonth - 1]} {startDay} through{" "}
            {months[endMonth - 1]} {endDay} each year.
          </p>
        </div>
      )}
    </fieldset>
  );
}
