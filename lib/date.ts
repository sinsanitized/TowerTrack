import { companyHolidayName } from "@/lib/rule-definitions/company-work-calendar";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function dateOnly(value: string | Date): string {
  if (typeof value === "string") {
    if (!isValidDateOnly(value))
      throw new Error(`Invalid date-only value: ${value}`);
    return value;
  }
  if (Number.isNaN(value.getTime()))
    throw new Error("Invalid date-only value: Invalid Date");
  return value.toISOString().slice(0, 10);
}

export function asUtc(value: string): Date {
  if (!isValidDateOnly(value))
    throw new Error(`Invalid date-only value: ${value}`);
  return new Date(`${value}T12:00:00.000Z`);
}

export function todayDateOnly(now = new Date()): string {
  const fixedTestDate = process.env.TOWERTRACK_TEST_DATE;
  if (process.env.TOWERTRACK_TEST_CLOCK === "enabled" && fixedTestDate)
    return dateOnly(fixedTestDate);
  return todayInTimeZone("America/New_York", now);
}

export function todayInTimeZone(
  timeZone = "America/New_York",
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateTimeLocalValue(
  value: Date,
  timeZone = "America/New_York",
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
    second: number("second"),
  };
}

export function parseDateTimeInTimeZone(
  value: string,
  timeZone = "America/New_York",
) {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const absolute = new Date(value);
    if (Number.isNaN(absolute.getTime()))
      throw new Error("Invalid timestamp with time-zone offset.");
    return absolute;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) throw new Error("Timestamp must include a valid date and time.");
  const expected = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const wallTime = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second,
  );
  let instant = wallTime;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const displayedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant = wallTime - (displayedAsUtc - instant);
  }
  const result = new Date(instant);
  const actual = zonedParts(result, timeZone);
  if (
    Object.keys(expected).some(
      (key) =>
        actual[key as keyof typeof actual] !==
        expected[key as keyof typeof expected],
    )
  )
    throw new Error(
      "That local time does not exist in the selected time zone.",
    );
  return result;
}

export function addDays(value: string, days: number): string {
  const date = asUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

export function diffDays(from: string, to: string): number {
  return Math.round((asUtc(to).getTime() - asUtc(from).getTime()) / 86_400_000);
}

export function clampDate(value: string, min: string, max: string): string {
  return value < min ? min : value > max ? max : value;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtc(dateOnly(value)));
}

export function formatComplianceDate(value?: string | Date | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtc(dateOnly(value)));
}

export function formatLongDate(value?: string | Date | null): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asUtc(dateOnly(value)));
}

export function formatLongDateRange(
  start?: string | Date | null,
  end?: string | Date | null,
): string {
  if (!start && !end) return "Window unavailable";
  if (!start || !end) return formatLongDate(start ?? end);
  const startDate = dateOnly(start);
  const endDate = dateOnly(end);
  if (startDate === endDate) return formatLongDate(startDate);
  const startParts = startDate.split("-");
  const endParts = endDate.split("-");
  const sameYear = startParts[0] === endParts[0];
  const startText = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(asUtc(startDate));
  return `${startText} – ${formatLongDate(endDate)}`;
}

export function formatOperationalDate(value?: string | Date | null): string {
  if (!value) return "Not recorded";
  const date = dateOnly(value);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(asUtc(date));
  const [year, month, day] = date.split("-");
  return `${weekday} ${month}/${day}/${year}`;
}

export function formatComplianceDateTime(
  value?: string | Date | null,
  timeZone = "America/New_York",
) {
  if (!value) return "Not recorded";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Invalid date and time";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(date);
}

export function isWeekend(value: string | Date): boolean {
  const day = asUtc(dateOnly(value)).getUTCDay();
  return day === 0 || day === 6;
}

export function isCompanyHoliday(value: string | Date): boolean {
  return companyHolidayName(dateOnly(value)) != null;
}

export function isWorkingDay(value: string | Date): boolean {
  return !isWeekend(value) && !isCompanyHoliday(value);
}

export function nextWorkingDate(value: string): string {
  let next = addDays(value, 1);
  while (!isWorkingDay(next)) next = addDays(next, 1);
  return next;
}

function workingDaysForward(from: string, to: string): number {
  let cursor = from;
  let count = 0;
  while (cursor < to) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor)) count += 1;
  }
  return count;
}

export function calendarDaysRemaining(
  dueDate: string | Date,
  today = todayDateOnly(),
): number {
  return diffDays(today, dateOnly(dueDate));
}

export function workingDaysRemaining(
  dueDate: string | Date,
  today = todayDateOnly(),
): number {
  const due = dateOnly(dueDate);
  if (due === today) return 0;
  return due > today
    ? workingDaysForward(today, due)
    : -workingDaysForward(due, today);
}

export function formatRelativeDate(
  value: string | Date,
  today = todayDateOnly(),
): string {
  const date = dateOnly(value);
  const days = diffDays(today, date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0
    ? `In ${days} calendar days`
    : `Overdue by ${Math.abs(days)} calendar days`;
}

export function formatRelativeWorkingDate(
  value: string | Date,
  today = todayDateOnly(),
): string {
  const days = workingDaysRemaining(value, today);
  if (days === 0) return "0 working days";
  return days > 0
    ? `In ${days} working day${days === 1 ? "" : "s"}`
    : `Overdue by ${Math.abs(days)} working day${days === -1 ? "" : "s"}`;
}

export function formatWorkingDaysLeft(
  value: string | Date,
  today = todayDateOnly(),
): string {
  const due = dateOnly(value);
  if (due === today) return "Due today";
  const days = workingDaysRemaining(due, today);
  if (days === 0)
    return due > today
      ? "Due before the next working day"
      : "Overdue; no working days have elapsed";
  if (days > 0) return `${days} working day${days === 1 ? "" : "s"} left`;
  const overdue = Math.abs(days);
  return `Overdue by ${overdue} working day${overdue === 1 ? "" : "s"}`;
}

export function actionableWorkingDaysRemaining(
  dueDate: string | Date,
  today = todayDateOnly(),
): number | null {
  const due = dateOnly(dueDate);
  if (due < today) return null;
  return workingDaysRemaining(due, today);
}

export function lastWorkingDayBefore(value: string | Date): string {
  let cursor = addDays(dateOnly(value), -1);
  while (!isWorkingDay(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

export type WeekendDeadlineRisk = {
  kind: "DEADLINE_ON_WEEKEND" | "WEEKEND_BEFORE_DEADLINE";
  label: string;
  lastWorkingDay: string;
} | null;

export function weekendDeadlineRisk(value: string | Date): WeekendDeadlineRisk {
  const deadline = dateOnly(value);
  if (isWeekend(deadline))
    return {
      kind: "DEADLINE_ON_WEEKEND",
      label: "Compliance deadline falls on a weekend",
      lastWorkingDay: lastWorkingDayBefore(deadline),
    };
  if (isWeekend(addDays(deadline, -1)))
    return {
      kind: "WEEKEND_BEFORE_DEADLINE",
      label: "Weekend before deadline",
      lastWorkingDay: lastWorkingDayBefore(deadline),
    };
  return null;
}

export function weekendDatesInWindow(start: string, end: string): string[] {
  if (end < start) throw new Error("Window end cannot precede its start.");
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    if (isWeekend(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function complianceDateInfo(
  value: string | Date,
  today = todayDateOnly(),
) {
  const date = dateOnly(value);
  return {
    date,
    formatted: formatComplianceDate(date),
    relative: formatRelativeDate(date, today),
    calendarDays: calendarDaysRemaining(date, today),
    workingDays: workingDaysRemaining(date, today),
    workingRelative: formatRelativeWorkingDate(date, today),
    weekend: isWeekend(date),
    weekendRisk: weekendDeadlineRisk(date),
  };
}
