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
    <fieldset className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:col-span-2">
      <legend className="label px-1">Operating dates</legend>
      <label className="block max-w-xl">
        <span className="label">Operating schedule · Required</span>
        <select
          className="field mt-1 bg-white"
          name="operatingSchedule"
          value={schedule}
          onChange={(event) =>
            setSchedule(event.target.value as "YEAR_ROUND" | "SEASONAL" | "")
          }
          required
        >
          <option value="" disabled>
            Choose a schedule
          </option>
          <option value="YEAR_ROUND">Year-round</option>
          <option value="SEASONAL">Seasonal</option>
        </select>
        <span className="mt-1 block text-sm text-slate-600">
          This choice controls which future deadlines are active.
        </span>
      </label>

      {schedule === "SEASONAL" && (
        <div className="mt-4 grid gap-3 border-t border-blue-200 pt-4 sm:grid-cols-2">
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
              className="grid grid-cols-[1fr_88px] gap-2"
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
          <p className="text-sm font-bold text-blue-950 sm:col-span-2">
            Seasonal schedule: {months[startMonth - 1]} {startDay} through{" "}
            {months[endMonth - 1]} {endDay} each year.
          </p>
        </div>
      )}
    </fieldset>
  );
}
