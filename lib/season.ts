import { dateOnly, todayDateOnly } from "@/lib/date";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type SeasonalFields = {
  seasonal: boolean;
  seasonStartMonth: number;
  seasonStartDay: number;
  seasonEndMonth: number;
  seasonEndDay: number;
  actualStartupDate?: Date | string | null;
  actualShutdownDate?: Date | string | null;
};

function monthDay(month: number, day: number) {
  return `${monthNames[Math.max(1, Math.min(12, month)) - 1]} ${day}`;
}

export function seasonLabel(system: SeasonalFields) {
  if (!system.seasonal) return "Year-Round Tower";
  return `Seasonal Tower · ${monthDay(
    system.seasonStartMonth,
    system.seasonStartDay,
  )}–${monthDay(system.seasonEndMonth, system.seasonEndDay)}`;
}

export function seasonalStatus(
  system: SeasonalFields,
  today = todayDateOnly(),
) {
  if (!system.seasonal) return "Continuous operation";
  const year = today.slice(0, 4);
  const start = `${year}-${String(system.seasonStartMonth).padStart(2, "0")}-${String(
    system.seasonStartDay,
  ).padStart(2, "0")}`;
  const end = `${year}-${String(system.seasonEndMonth).padStart(2, "0")}-${String(
    system.seasonEndDay,
  ).padStart(2, "0")}`;
  const startup = system.actualStartupDate
    ? dateOnly(system.actualStartupDate)
    : null;
  const shutdown = system.actualShutdownDate
    ? dateOnly(system.actualShutdownDate)
    : null;
  if (shutdown && shutdown >= start && today > shutdown)
    return "Season shut down";
  if (startup && startup <= today && today <= end) return "Operating season";
  if (today < start) return "Pre-season";
  if (today > end) return "Off season";
  return "Expected operating season";
}
