export const COMPANY_WORK_CALENDAR_RULESET_VERSION = "US_FEDERAL_2026.1";

export const COMPANY_HOLIDAY_POLICY = {
  excludesFederalHoliday: "Veterans Day",
  additionalHoliday: "Day after Thanksgiving",
  observesWeekendFederalHolidays: true,
} as const;

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function fixedHoliday(year: number, month: number, day: number) {
  const date = utcDate(year, month, day);
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
) {
  const first = utcDate(year, month, 1);
  const day =
    1 + ((7 + weekday - first.getUTCDay()) % 7) + 7 * (occurrence - 1);
  return isoDate(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = utcDate(year, month + 1, 0);
  const day = last.getUTCDate() - ((7 + last.getUTCDay() - weekday) % 7);
  return isoDate(year, month, day);
}

function holidaysForNominalYear(year: number) {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const thanksgivingDay = Number(thanksgiving.slice(-2));
  return new Map<string, string>([
    [fixedHoliday(year, 1, 1), "New Year's Day"],
    [nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day"],
    [nthWeekday(year, 2, 1, 3), "Washington's Birthday"],
    [lastWeekday(year, 5, 1), "Memorial Day"],
    [fixedHoliday(year, 6, 19), "Juneteenth National Independence Day"],
    [fixedHoliday(year, 7, 4), "Independence Day"],
    [nthWeekday(year, 9, 1, 1), "Labor Day"],
    [nthWeekday(year, 10, 1, 2), "Columbus Day"],
    [thanksgiving, "Thanksgiving Day"],
    [isoDate(year, 11, thanksgivingDay + 1), "Day after Thanksgiving"],
    [fixedHoliday(year, 12, 25), "Christmas Day"],
  ]);
}

export function companyHolidayName(value: string): string | null {
  const year = Number(value.slice(0, 4));
  for (const nominalYear of [year - 1, year, year + 1]) {
    const name = holidaysForNominalYear(nominalYear).get(value);
    if (name) return name;
  }
  return null;
}
